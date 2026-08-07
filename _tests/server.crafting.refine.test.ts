// Self-contained mount: builds its own express() app (cookie-parser + express.json())
// and mounts craftingRouter directly at '/api/crafting', independent of
// buildApp()/mountRoutes(). Uses the REAL requireAuthProof middleware (Layer 1: real
// requireSession cookie check via getUserIdFromCookie/createJWT; Layer 2: mocked
// getServerWallet/authServer.verifyAuthProof/consumeNonce), mirroring
// _tests/server.challenge.test.ts — this gives a genuine no-proof 401 through real code.
// connectToMongo + getClient are mocked with the transactional harness from
// _tests/server.marketplace.purchase.test.ts (withTransaction runs its callback inline).

jest.mock('@server/lib/serverWallet', () => ({ getServerWallet: jest.fn().mockResolvedValue({}) }));
jest.mock('@shared/authProof', () => ({ authServer: { verifyAuthProof: jest.fn() } }));
jest.mock('@server/lib/authNonceStore', () => ({ consumeNonce: jest.fn() }));

const targetFindOne = jest.fn();
const refineStoneFindOne = jest.fn();
const userInventoryFindOne = jest.fn(async (query: any) => {
  if (String(query._id) === String(TARGET_ID)) return targetFindOne();
  if (String(query._id) === String(STONE_ID)) return refineStoneFindOne();
  return null;
});
const deleteOne = jest.fn(async () => ({ deletedCount: 1 }));
const updateOne = jest.fn(async () => ({ modifiedCount: 1 }));

const endSession = jest.fn(async () => {});
const startSession = jest.fn(() => ({
  withTransaction: async (fn: () => Promise<void>) => fn(),
  endSession,
}));
const getClient = jest.fn(async () => ({ startSession }));

jest.mock('@server/lib/mongodb', () => ({
  connectToMongo: jest.fn(async () => ({
    userInventoryCollection: { findOne: userInventoryFindOne, deleteOne, updateOne },
  })),
  getClient,
}));

jest.mock('@shared/loot-table', () => ({
  getLootItemById: jest.fn((lootTableId: string) => {
    if (lootTableId === 'iron_sword') {
      return { lootId: 'iron_sword', name: 'Iron Sword', equipmentStats: { damageBonus: 10, critChance: 5 } };
    }
    return undefined;
  }),
}));

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { ObjectId } from 'mongodb';
import { craftingRouter } from '@server/routes/crafting';
import { createJWT } from '@server/lib/jwt';
import { authServer } from '@shared/authProof';

const mockVerify = (authServer as unknown as { verifyAuthProof: jest.Mock }).verifyAuthProof;

const TARGET_ID = new ObjectId();
const STONE_ID = new ObjectId();

function appWithCraftingRouter() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/crafting', craftingRouter);
  return app;
}

async function authCookie(userId = 'user-123') {
  const token = await createJWT({ userId, username: 'alice' });
  return `verified=${token}`;
}

/** Auth proof that verifies successfully for `user-123` (the requireAuthProof identity check). */
function seedValidProof() {
  mockVerify.mockResolvedValue({ valid: true, identityKey: 'user-123' });
}

function craftedTargetItem(overrides: Record<string, any> = {}) {
  return {
    _id: TARGET_ID,
    userId: 'user-123',
    lootTableId: 'iron_sword',
    crafted: true,
    statRoll: 1.0,
    rolledStats: { damageBonus: 10, critChance: 5 },
    ...overrides,
  };
}

function refineStoneItem(overrides: Record<string, any> = {}) {
  return {
    _id: STONE_ID,
    userId: 'user-123',
    lootTableId: 'refine_stone',
    ...overrides,
  };
}

describe('POST /api/crafting/refine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    targetFindOne.mockResolvedValue(craftedTargetItem());
    refineStoneFindOne.mockResolvedValue(refineStoneItem());
  });

  it('401s with no proof present in the body (real requireAuthProof, real cookie)', async () => {
    const res = await request(appWithCraftingRouter())
      .post('/api/crafting/refine')
      .set('Cookie', await authCookie())
      .send({ targetItemId: TARGET_ID.toString(), refineStoneId: STONE_ID.toString() }); // no `proof` field

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Auth proof required' });
    expect(getClient).not.toHaveBeenCalled();
  });

  it('401s with no verified cookie at all', async () => {
    const res = await request(appWithCraftingRouter())
      .post('/api/crafting/refine')
      .send({ proof: {}, targetItemId: TARGET_ID.toString(), refineStoneId: STONE_ID.toString() });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('400s when target/refine stone IDs are missing (valid proof, reaches handler)', async () => {
    seedValidProof();

    const res = await request(appWithCraftingRouter())
      .post('/api/crafting/refine')
      .set('Cookie', await authCookie())
      .send({ proof: {} });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Target item ID and refine stone ID required' });
    expect(getClient).not.toHaveBeenCalled();
  });

  it('500s with the exact message when the refine stone is not owned / not found', async () => {
    seedValidProof();
    refineStoneFindOne.mockResolvedValueOnce(null);

    const res = await request(appWithCraftingRouter())
      .post('/api/crafting/refine')
      .set('Cookie', await authCookie())
      .send({ proof: {}, targetItemId: TARGET_ID.toString(), refineStoneId: STONE_ID.toString() });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Refine stone not found or does not belong to you' });
    expect(deleteOne).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
    expect(endSession).toHaveBeenCalledTimes(1);
  });

  it('500s with the exact message when the target item is not crafted equipment', async () => {
    seedValidProof();
    targetFindOne.mockResolvedValueOnce(craftedTargetItem({ crafted: false }));

    const res = await request(appWithCraftingRouter())
      .post('/api/crafting/refine')
      .set('Cookie', await authCookie())
      .send({ proof: {}, targetItemId: TARGET_ID.toString(), refineStoneId: STONE_ID.toString() });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Target item is not crafted equipment' });
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('200s, deletes the refine stone, and upgrades the target item in the transaction (happy path)', async () => {
    seedValidProof();
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(1); // rolledStatRoll = 1.2 (guaranteed upgrade)

    const res = await request(appWithCraftingRouter())
      .post('/api/crafting/refine')
      .set('Cookie', await authCookie())
      .send({ proof: {}, targetItemId: TARGET_ID.toString(), refineStoneId: STONE_ID.toString() });

    randomSpy.mockRestore();

    expect(res.status).toBe(200);
    expect(res.body.rolledStatRoll).toBeCloseTo(1.2);
    expect(res.body).toEqual({
      success: true,
      targetItem: { _id: TARGET_ID.toString(), name: 'Iron Sword' },
      oldStatRoll: 1.0,
      rolledStatRoll: res.body.rolledStatRoll,
      finalStatRoll: 1.2,
      wasUpgraded: true,
      newRolledStats: { damageBonus: 12, critChance: 6 },
    });

    // Finalize ran inside the withTransaction session.
    expect(getClient).toHaveBeenCalledTimes(1);
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledTimes(1);

    expect(deleteOne).toHaveBeenCalledTimes(1);
    expect(deleteOne).toHaveBeenCalledWith({ _id: STONE_ID }, expect.anything());

    expect(updateOne).toHaveBeenCalledTimes(1);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: TARGET_ID },
      { $set: { statRoll: 1.2, rolledStats: { damageBonus: 12, critChance: 6 } } },
      expect.anything(),
    );
  });
});
