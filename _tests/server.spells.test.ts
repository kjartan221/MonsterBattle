// Self-contained mount (Task 5 owns the real index.ts wiring): this test builds its own
// express() app (cookie-parser + express.json()) and mounts spellsRouter directly at
// '/api/spells'. Auth uses the REAL requireSession middleware + a REAL JWT (via createJWT)
// set as the `verified` cookie, mirroring _tests/server.battle.test.ts. connectToMongo is
// mocked per test; getLootItemById is NOT mocked (pure lookup against the real loot table).

const userInventoryFindOne = jest.fn();
const userInventoryFind = jest.fn();
const userInventoryDeleteMany = jest.fn(async () => ({ deletedCount: 1 }));
const userInventoryUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const playerStatsFindOne = jest.fn();
const playerStatsUpdateOne = jest.fn(async () => ({ matchedCount: 1 }));

jest.mock('@/lib/mongodb', () => ({
  connectToMongo: jest.fn(async () => ({
    userInventoryCollection: {
      findOne: userInventoryFindOne,
      find: userInventoryFind,
      deleteMany: userInventoryDeleteMany,
      updateOne: userInventoryUpdateOne,
    },
    playerStatsCollection: {
      findOne: playerStatsFindOne,
      updateOne: playerStatsUpdateOne,
    },
  })),
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ObjectId } from 'mongodb';
import { spellsRouter } from '@server/routes/spells';
import { createJWT } from '@/utils/jwt';

function appWithSpellsRouter() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/spells', spellsRouter);
  return app;
}

async function authCookie(userId = 'user-123') {
  const token = await createJWT({ userId, username: 'alice' });
  return `verified=${token}`;
}

describe('POST /api/spells/equip', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no verified cookie', async () => {
    const res = await request(appWithSpellsRouter()).post('/api/spells/equip').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('200s and equips the spell (happy path)', async () => {
    const inventoryId = new ObjectId().toString();
    userInventoryFindOne.mockResolvedValueOnce({
      _id: new ObjectId(inventoryId),
      userId: 'user-123',
      lootTableId: 'spell_scroll_spark',
    });
    playerStatsUpdateOne.mockResolvedValueOnce({ matchedCount: 1 });

    const res = await request(appWithSpellsRouter())
      .post('/api/spells/equip')
      .set('Cookie', await authCookie())
      .send({ inventoryId });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Spell equipped successfully',
      spellName: 'Spark Scroll',
    });
  });

  it('404s when the item is not found in inventory', async () => {
    const inventoryId = new ObjectId().toString();
    userInventoryFindOne.mockResolvedValueOnce(null);

    const res = await request(appWithSpellsRouter())
      .post('/api/spells/equip')
      .set('Cookie', await authCookie())
      .send({ inventoryId });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Item not found in inventory' });
  });
});

describe('POST /api/spells/unequip', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no verified cookie', async () => {
    const res = await request(appWithSpellsRouter()).post('/api/spells/unequip').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('200s and unequips the spell (happy path)', async () => {
    playerStatsUpdateOne.mockResolvedValueOnce({ matchedCount: 1 });

    const res = await request(appWithSpellsRouter())
      .post('/api/spells/unequip')
      .set('Cookie', await authCookie())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Spell unequipped successfully',
    });
  });

  it('404s when player stats are not found', async () => {
    playerStatsUpdateOne.mockResolvedValueOnce({ matchedCount: 0 });

    const res = await request(appWithSpellsRouter())
      .post('/api/spells/unequip')
      .set('Cookie', await authCookie())
      .send({});

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Player stats not found' });
  });
});

describe('POST /api/spells/cast', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no verified cookie', async () => {
    const res = await request(appWithSpellsRouter()).post('/api/spells/cast').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('200s and casts the spell off cooldown (happy path)', async () => {
    const inventoryId = new ObjectId();
    playerStatsFindOne.mockResolvedValueOnce({
      userId: 'user-123',
      equippedSpell: inventoryId,
      lastSpellCast: 0, // long ago -> no cooldown remaining
    });
    userInventoryFindOne.mockResolvedValueOnce({
      _id: inventoryId,
      userId: 'user-123',
      lootTableId: 'spell_scroll_spark', // cooldown 10, damage 15
      tier: 1,
    });

    const res = await request(appWithSpellsRouter())
      .post('/api/spells/cast')
      .set('Cookie', await authCookie())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      spellName: 'Spark',
      damage: 15,
      healing: 0,
      effect: 'Lightning damage',
    });
    expect(playerStatsUpdateOne).toHaveBeenCalledWith(
      { userId: 'user-123' },
      { $set: { lastSpellCast: expect.any(Number) } },
    );
  });

  it('400s with cooldownRemaining when the spell is still on cooldown', async () => {
    const inventoryId = new ObjectId();
    playerStatsFindOne.mockResolvedValueOnce({
      userId: 'user-123',
      equippedSpell: inventoryId,
      lastSpellCast: Date.now(), // just cast -> full cooldown remaining
    });
    userInventoryFindOne.mockResolvedValueOnce({
      _id: inventoryId,
      userId: 'user-123',
      lootTableId: 'spell_scroll_spark', // cooldown 10
      tier: 1,
    });

    const res = await request(appWithSpellsRouter())
      .post('/api/spells/cast')
      .set('Cookie', await authCookie())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Spell on cooldown' });
    expect(res.body).toHaveProperty('cooldownRemaining');
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });
});

describe('POST /api/spells/upgrade', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no verified cookie', async () => {
    const res = await request(appWithSpellsRouter()).post('/api/spells/upgrade').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('200s and upgrades the spell (happy path)', async () => {
    const targetId = new ObjectId();
    const duplicateId = new ObjectId();
    playerStatsFindOne.mockResolvedValueOnce({ userId: 'user-123', coins: 1000 });
    userInventoryFindOne.mockResolvedValueOnce({
      _id: targetId,
      userId: 'user-123',
      lootTableId: 'spell_scroll_spark',
      tier: 1,
    });
    userInventoryFind.mockReturnValueOnce({
      toArray: jest.fn(async () => [{ _id: duplicateId }]),
    });

    const res = await request(appWithSpellsRouter())
      .post('/api/spells/upgrade')
      .set('Cookie', await authCookie())
      .send({ inventoryId: targetId.toString() });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      previousTier: 1,
      newTier: 2,
      duplicatesConsumed: 1,
      goldSpent: 500,
    });
    expect(userInventoryDeleteMany).toHaveBeenCalledWith({ _id: { $in: [duplicateId] } });
    expect(playerStatsUpdateOne).toHaveBeenCalledWith(
      { userId: 'user-123' },
      { $set: { coins: 500 } },
    );
  });

  it('400s when there are not enough tier-1 duplicates', async () => {
    const targetId = new ObjectId();
    playerStatsFindOne.mockResolvedValueOnce({ userId: 'user-123', coins: 1000 });
    userInventoryFindOne.mockResolvedValueOnce({
      _id: targetId,
      userId: 'user-123',
      lootTableId: 'spell_scroll_spark',
      tier: 1,
    });
    userInventoryFind.mockReturnValueOnce({
      toArray: jest.fn(async () => []), // no duplicates, need 1
    });

    const res = await request(appWithSpellsRouter())
      .post('/api/spells/upgrade')
      .set('Cookie', await authCookie())
      .send({ inventoryId: targetId.toString() });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Need 1 tier 1 duplicates, have 0',
      required: 1,
      available: 0,
    });
    expect(userInventoryDeleteMany).not.toHaveBeenCalled();
  });
});
