// Self-contained mount: builds its own express() app (cookie-parser + express.json())
// and mounts equipmentRouter directly at '/api/equipment', independent of
// buildApp()/mountRoutes(). GET /get uses the REAL requireSession middleware + a REAL
// JWT (via createJWT) set as the `verified` cookie, mirroring _tests/server.battle.test.ts.
// POST /equip and /unequip use the REAL requireAuthProof middleware; its lower-level
// dependencies (getServerWallet, authServer.verifyAuthProof, consumeNonce) are mocked,
// mirroring _tests/server.challenge.test.ts. connectToMongo is mocked per test.
// @/lib/loot-table is NOT mocked — it is pure data, so real lookups are used.

jest.mock('@/lib/serverWallet', () => ({ getServerWallet: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/authProof', () => ({ authServer: { verifyAuthProof: jest.fn() } }));
jest.mock('@/lib/authNonceStore', () => ({ consumeNonce: jest.fn() }));

const playerStatsFindOne = jest.fn();
const playerStatsUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const userInventoryFindOne = jest.fn();
let inventoryFindResults: any[] = [];
const userInventoryFind = jest.fn(() => ({ toArray: async () => inventoryFindResults }));

jest.mock('@/lib/mongodb', () => ({
  connectToMongo: jest.fn(async () => ({
    playerStatsCollection: { findOne: playerStatsFindOne, updateOne: playerStatsUpdateOne },
    userInventoryCollection: { findOne: userInventoryFindOne, find: userInventoryFind },
  })),
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ObjectId } from 'mongodb';
import { equipmentRouter } from '@server/routes/equipment';
import { createJWT } from '@/utils/jwt';
import { authServer } from '@/lib/authProof';

const mockVerify = (authServer as unknown as { verifyAuthProof: jest.Mock }).verifyAuthProof;

function appWithEquipmentRouter() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/equipment', equipmentRouter);
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

describe('GET /api/equipment/get', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    inventoryFindResults = [];
  });

  it('401s with no verified cookie', async () => {
    const res = await request(appWithEquipmentRouter()).get('/api/equipment/get');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('404s when player stats are missing', async () => {
    playerStatsFindOne.mockResolvedValueOnce(null);

    const res = await request(appWithEquipmentRouter())
      .get('/api/equipment/get')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Player stats not found' });
  });

  it('200s with an empty object when no items are equipped', async () => {
    playerStatsFindOne.mockResolvedValueOnce({ userId: 'user-123' });

    const res = await request(appWithEquipmentRouter())
      .get('/api/equipment/get')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it('200s and maps equipped items back to their slots (happy path)', async () => {
    const weaponId = new ObjectId();
    playerStatsFindOne.mockResolvedValueOnce({
      userId: 'user-123',
      equippedItems: { weapon: weaponId },
    });
    inventoryFindResults = [
      { _id: weaponId, lootTableId: 'common_dagger', tier: 2 },
    ];

    const res = await request(appWithEquipmentRouter())
      .get('/api/equipment/get')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(200);
    expect(res.body.equippedWeapon).toMatchObject({
      inventoryId: weaponId.toString(),
      lootTableId: 'common_dagger',
      tier: 2,
    });
  });
});

describe('POST /api/equipment/equip', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no proof present in the body', async () => {
    const res = await request(appWithEquipmentRouter())
      .post('/api/equipment/equip')
      .set('Cookie', await authCookie())
      .send({ inventoryId: '507f1f77bcf86cd799439011', slot: 'weapon' }); // no `proof` field

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Auth proof required' });
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });

  it('400s when inventoryId or slot is missing (valid proof, reaches handler)', async () => {
    seedValidProof();

    const res = await request(appWithEquipmentRouter())
      .post('/api/equipment/equip')
      .set('Cookie', await authCookie())
      .send({ proof: {}, slot: 'weapon' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing inventoryId or slot' });
  });

  it('400s on an invalid slot', async () => {
    seedValidProof();

    const res = await request(appWithEquipmentRouter())
      .post('/api/equipment/equip')
      .set('Cookie', await authCookie())
      .send({ proof: {}, inventoryId: '507f1f77bcf86cd799439011', slot: 'helmet' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid slot' });
  });

  it('404s when the item is not found in the inventory', async () => {
    seedValidProof();
    userInventoryFindOne.mockResolvedValueOnce(null);

    const res = await request(appWithEquipmentRouter())
      .post('/api/equipment/equip')
      .set('Cookie', await authCookie())
      .send({ proof: {}, inventoryId: '507f1f77bcf86cd799439011', slot: 'weapon' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Item not found in inventory' });
  });

  it('200s and equips the item (happy path, valid proof)', async () => {
    seedValidProof();
    userInventoryFindOne.mockResolvedValueOnce({
      _id: new ObjectId('507f1f77bcf86cd799439011'),
      userId: 'user-123',
      lootTableId: 'common_dagger', // real loot-table entry, type: 'weapon'
    });

    const res = await request(appWithEquipmentRouter())
      .post('/api/equipment/equip')
      .set('Cookie', await authCookie())
      .send({ proof: {}, inventoryId: '507f1f77bcf86cd799439011', slot: 'weapon' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      slot: 'weapon',
      inventoryId: '507f1f77bcf86cd799439011',
      lootTableId: 'common_dagger',
    });
    expect(playerStatsUpdateOne).toHaveBeenCalledWith(
      { userId: 'user-123' },
      { $set: { 'equippedItems.weapon': expect.anything() } },
    );
  });
});

describe('POST /api/equipment/unequip', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no proof present in the body', async () => {
    const res = await request(appWithEquipmentRouter())
      .post('/api/equipment/unequip')
      .set('Cookie', await authCookie())
      .send({ slot: 'weapon' }); // no `proof` field

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Auth proof required' });
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });

  it('400s when slot is missing (valid proof, reaches handler)', async () => {
    seedValidProof();

    const res = await request(appWithEquipmentRouter())
      .post('/api/equipment/unequip')
      .set('Cookie', await authCookie())
      .send({ proof: {} });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing slot' });
  });

  it('200s and unequips the slot (happy path, valid proof)', async () => {
    seedValidProof();

    const res = await request(appWithEquipmentRouter())
      .post('/api/equipment/unequip')
      .set('Cookie', await authCookie())
      .send({ proof: {}, slot: 'weapon' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, slot: 'weapon' });
    expect(playerStatsUpdateOne).toHaveBeenCalledWith(
      { userId: 'user-123' },
      { $unset: { 'equippedItems.weapon': '' } },
    );
  });
});
