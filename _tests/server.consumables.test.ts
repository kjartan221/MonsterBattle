// Self-contained mount (Task 9 owns the real index.ts wiring): this test builds its own
// express() app (cookie-parser + express.json()) and mounts consumablesRouter directly at
// '/api/consumables', independent of buildApp()/mountRoutes(). Auth uses the REAL
// requireSession middleware + a REAL JWT (via createJWT) set as the `verified` cookie,
// mirroring _tests/server.battle.test.ts. connectToMongo/getClient are mocked per test.
// getLootItemById is the REAL implementation (pure lookup, no DB) — 'common_potion' /
// 'common_bone' are real loot-table entries used to exercise the consumable-type checks.

const userInventoryFindToArray = jest.fn();
const userInventoryFind = jest.fn(() => ({ toArray: userInventoryFindToArray }));
const userInventoryFindOne = jest.fn();
const userInventoryDeleteOne = jest.fn(async () => ({ deletedCount: 1 }));
const userInventoryDeleteMany = jest.fn(async () => ({ deletedCount: 4 }));
const userInventoryCountDocuments = jest.fn();
const userInventoryUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const playerStatsFindOne = jest.fn();
const playerStatsUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));

const endSession = jest.fn(async () => {});
const startSession = jest.fn(() => ({
  withTransaction: async (fn: () => Promise<void>) => fn(),
  endSession,
}));
const getClient = jest.fn(async () => ({ startSession }));

jest.mock('@server/lib/mongodb', () => ({
  connectToMongo: jest.fn(async () => ({
    userInventoryCollection: {
      find: userInventoryFind,
      findOne: userInventoryFindOne,
      deleteOne: userInventoryDeleteOne,
      deleteMany: userInventoryDeleteMany,
      countDocuments: userInventoryCountDocuments,
      updateOne: userInventoryUpdateOne,
    },
    playerStatsCollection: { findOne: playerStatsFindOne, updateOne: playerStatsUpdateOne },
  })),
  getClient,
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { consumablesRouter } from '@server/routes/consumables';
import { createJWT } from '@server/lib/jwt';

function appWithConsumablesRouter() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/consumables', consumablesRouter);
  return app;
}

async function authCookie(userId = 'user-123') {
  const token = await createJWT({ userId, username: 'alice' });
  return `verified=${token}`;
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/consumables/get', () => {
  it('401s with no verified cookie', async () => {
    const res = await request(appWithConsumablesRouter()).get('/api/consumables/get');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('200s and returns only consumable items (happy path)', async () => {
    userInventoryFindToArray.mockResolvedValueOnce([
      { _id: 'inv-1', lootTableId: 'common_potion', enhanced: false },
      { _id: 'inv-2', lootTableId: 'common_bone' }, // material, filtered out
    ]);

    const res = await request(appWithConsumablesRouter())
      .get('/api/consumables/get')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(200);
    expect(res.body.consumables).toHaveLength(1);
    expect(res.body.consumables[0]).toMatchObject({
      _id: 'inv-1',
      lootTableId: 'common_potion',
      name: 'Health Potion',
      enhanced: false,
    });
  });
});

describe('POST /api/consumables/equip', () => {
  it('401s with no verified cookie', async () => {
    const res = await request(appWithConsumablesRouter()).post('/api/consumables/equip').send({});
    expect(res.status).toBe(401);
  });

  it('200s and equips a consumable to the given slot (happy path)', async () => {
    userInventoryFindOne.mockResolvedValueOnce({ _id: 'inv-1', lootTableId: 'common_potion' });
    playerStatsFindOne.mockResolvedValueOnce({ equippedConsumables: ['empty', 'empty', 'empty', 'empty'] });

    const res = await request(appWithConsumablesRouter())
      .post('/api/consumables/equip')
      .set('Cookie', await authCookie())
      .send({ inventoryId: '507f1f77bcf86cd799439011', slotIndex: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, slotIndex: 1 });
    expect(playerStatsUpdateOne).toHaveBeenCalledTimes(1);
  });

  it('400s when the item is not a consumable (key branch)', async () => {
    userInventoryFindOne.mockResolvedValueOnce({ _id: 'inv-1', lootTableId: 'common_bone' });

    const res = await request(appWithConsumablesRouter())
      .post('/api/consumables/equip')
      .set('Cookie', await authCookie())
      .send({ inventoryId: '507f1f77bcf86cd799439011', slotIndex: 0 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Item is not a consumable' });
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });
});

describe('POST /api/consumables/unequip', () => {
  it('401s with no verified cookie', async () => {
    const res = await request(appWithConsumablesRouter()).post('/api/consumables/unequip').send({});
    expect(res.status).toBe(401);
  });

  it('200s and unequips the given slot (happy path)', async () => {
    playerStatsFindOne.mockResolvedValueOnce({ equippedConsumables: ['inv-1', 'empty', 'empty', 'empty'] });

    const res = await request(appWithConsumablesRouter())
      .post('/api/consumables/unequip')
      .set('Cookie', await authCookie())
      .send({ slotIndex: 0 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, slotIndex: 0 });
    expect(playerStatsUpdateOne).toHaveBeenCalledWith(
      { userId: 'user-123' },
      { $set: { equippedConsumables: ['empty', 'empty', 'empty', 'empty'] } },
    );
  });

  it('404s when player stats are missing (key branch)', async () => {
    playerStatsFindOne.mockResolvedValueOnce(null);

    const res = await request(appWithConsumablesRouter())
      .post('/api/consumables/unequip')
      .set('Cookie', await authCookie())
      .send({ slotIndex: 0 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Player stats not found' });
  });
});

describe('POST /api/consumables/use', () => {
  it('401s with no verified cookie', async () => {
    const res = await request(appWithConsumablesRouter()).post('/api/consumables/use').send({});
    expect(res.status).toBe(401);
  });

  it('200s, deletes the item, and unequips when no copies remain (happy path, transactional)', async () => {
    playerStatsFindOne.mockResolvedValueOnce({ equippedConsumables: ['inv-1', 'empty', 'empty', 'empty'] });
    userInventoryFindOne.mockResolvedValueOnce({ _id: 'inv-1', userId: 'user-123', lootTableId: 'common_potion', enhanced: false });
    userInventoryCountDocuments.mockResolvedValueOnce(0);

    const res = await request(appWithConsumablesRouter())
      .post('/api/consumables/use')
      .set('Cookie', await authCookie())
      .send({ slotIndex: 0 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      remainingQuantity: 0,
      shouldUnequip: true,
      lootTableId: 'common_potion',
    });

    // Transactional writes happened inside the withTransaction callback.
    expect(getClient).toHaveBeenCalledTimes(1);
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(userInventoryDeleteOne).toHaveBeenCalledWith(
      { _id: 'inv-1', userId: 'user-123' },
      { session: expect.anything() },
    );
    expect(playerStatsUpdateOne).toHaveBeenCalledWith(
      { userId: 'user-123' },
      { $set: { equippedConsumables: ['empty', 'empty', 'empty', 'empty'] } },
      { session: expect.anything() },
    );
  });

  it('500s when no item is equipped in the slot (key branch)', async () => {
    playerStatsFindOne.mockResolvedValueOnce({ equippedConsumables: ['empty', 'empty', 'empty', 'empty'] });

    const res = await request(appWithConsumablesRouter())
      .post('/api/consumables/use')
      .set('Cookie', await authCookie())
      .send({ slotIndex: 0 });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'No item equipped in slot' });
    expect(userInventoryDeleteOne).not.toHaveBeenCalled();
  });
});

describe('POST /api/consumables/enhance', () => {
  it('401s with no verified cookie', async () => {
    const res = await request(appWithConsumablesRouter()).post('/api/consumables/enhance').send({});
    expect(res.status).toBe(401);
  });

  it('200s and enhances the item, consuming gold + 4 duplicates (happy path)', async () => {
    const targetId = '507f1f77bcf86cd799439011';
    userInventoryFindOne.mockResolvedValueOnce({
      _id: { toString: () => targetId },
      userId: 'user-123',
      itemType: 'consumable',
      lootTableId: 'common_potion',
      enhanced: false,
    });
    playerStatsFindOne.mockResolvedValueOnce({ coins: 1000 });
    userInventoryFindToArray.mockResolvedValueOnce([
      { _id: { toString: () => targetId } },
      { _id: { toString: () => 'd1' } },
      { _id: { toString: () => 'd2' } },
      { _id: { toString: () => 'd3' } },
      { _id: { toString: () => 'd4' } },
    ]);

    const res = await request(appWithConsumablesRouter())
      .post('/api/consumables/enhance')
      .set('Cookie', await authCookie())
      .send({ targetItemId: targetId });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      itemName: 'Health Potion',
      goldCost: 500,
      duplicatesConsumed: 4,
      remainingGold: 500,
    });
    expect(userInventoryDeleteMany).toHaveBeenCalledTimes(1);
    expect(playerStatsUpdateOne).toHaveBeenCalledWith({ userId: 'user-123' }, { $inc: { coins: -500 } });
    expect(userInventoryUpdateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { enhanced: true } },
    );
  });

  it('400s when the player has insufficient gold (key branch)', async () => {
    const targetId = '507f1f77bcf86cd799439011';
    userInventoryFindOne.mockResolvedValueOnce({
      _id: { toString: () => targetId },
      userId: 'user-123',
      itemType: 'consumable',
      lootTableId: 'common_potion',
      enhanced: false,
    });
    playerStatsFindOne.mockResolvedValueOnce({ coins: 10 });

    const res = await request(appWithConsumablesRouter())
      .post('/api/consumables/enhance')
      .set('Cookie', await authCookie())
      .send({ targetItemId: targetId });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Insufficient gold. Need 500 gold to enhance this consumable.',
      goldCost: 500,
      currentGold: 10,
    });
    expect(userInventoryDeleteMany).not.toHaveBeenCalled();
  });
});
