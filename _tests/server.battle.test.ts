// Self-contained mount (Task 5 owns the real index.ts wiring): this test builds its own
// express() app (cookie-parser + express.json()) and mounts battleRouter directly at
// '/api', independent of buildApp()/mountRoutes(). Auth uses the REAL requireSession
// middleware + a REAL JWT (via createJWT) set as the `verified` cookie, mirroring
// _tests/server.requireSession.test.ts. connectToMongo is mocked per test.

const battleSessionsFindOne = jest.fn();
const battleSessionsFindOneAndUpdate = jest.fn();
const battleSessionsUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const battleSessionsInsertOne = jest.fn(async () => ({ insertedId: 'SESSION_OID' }));
const battleHistoryUpdateOne = jest.fn(async () => ({ upsertedCount: 1 }));
const playerStatsFindOne = jest.fn();
const playerStatsUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const userInventoryFindOne = jest.fn();
const userInventoryInsertOne = jest.fn(async () => ({ insertedId: 'INV_OID' }));

jest.mock('@server/lib/mongodb', () => ({
  connectToMongo: jest.fn(async () => ({
    battleSessionsCollection: {
      findOne: battleSessionsFindOne,
      findOneAndUpdate: battleSessionsFindOneAndUpdate,
      updateOne: battleSessionsUpdateOne,
      insertOne: battleSessionsInsertOne,
    },
    battleHistoryCollection: { updateOne: battleHistoryUpdateOne },
    playerStatsCollection: { findOne: playerStatsFindOne, updateOne: playerStatsUpdateOne },
    userInventoryCollection: { findOne: userInventoryFindOne, insertOne: userInventoryInsertOne },
  })),
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { battleRouter } from '@server/routes/battle';
import { createJWT } from '@server/lib/jwt';

function appWithBattleRouter() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', battleRouter);
  return app;
}

async function authCookie(userId = 'user-123') {
  const token = await createJWT({ userId, username: 'alice' });
  return `verified=${token}`;
}

function basePlayerStats(overrides: Record<string, any> = {}) {
  return {
    userId: 'user-123',
    level: 3,
    experience: 50,
    coins: 100,
    maxHealth: 100,
    currentHealth: 100,
    baseDamage: 10,
    critChance: 5,
    attackSpeed: 0,
    currentZone: 1,
    currentTier: 1,
    unlockedZones: ['forest-1'],
    stats: {
      battlesWon: 0,
      battlesWonStreak: 0,
      monstersDefeated: 0,
      bossesDefeated: 0,
      totalDamageDealt: 0,
      itemsCollected: 0,
      legendariesFound: 0,
      battlesWonStreaks: undefined,
    },
    ...overrides,
  };
}

describe('POST /api/start-battle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no verified cookie', async () => {
    const res = await request(appWithBattleRouter()).post('/api/start-battle').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('200s and resumes an active session', async () => {
    const activeSession = {
      _id: 'SESSION_OID',
      userId: 'user-123',
      isDefeated: false,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      monster: { name: 'Forest Wolf', clicksRequired: 5, attackDamage: 3 },
    };
    battleSessionsFindOne.mockResolvedValueOnce(activeSession);

    const res = await request(appWithBattleRouter())
      .post('/api/start-battle')
      .set('Cookie', await authCookie())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.isNewSession).toBe(false);
    expect(res.body.session._id).toBe('SESSION_OID');
    expect(res.body.monster.name).toBe('Forest Wolf');
  });

  it('200s and creates a new session when none is active', async () => {
    battleSessionsFindOne.mockResolvedValueOnce(null);
    playerStatsFindOne.mockResolvedValueOnce(basePlayerStats());

    const res = await request(appWithBattleRouter())
      .post('/api/start-battle')
      .set('Cookie', await authCookie())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.isNewSession).toBe(true);
    expect(battleSessionsInsertOne).toHaveBeenCalledTimes(1);
  });

  it('404s when player stats are missing and there is no active session', async () => {
    battleSessionsFindOne.mockResolvedValueOnce(null);
    playerStatsFindOne.mockResolvedValueOnce(null);

    const res = await request(appWithBattleRouter())
      .post('/api/start-battle')
      .set('Cookie', await authCookie())
      .send({});

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Player stats not found. Please refresh the page.' });
  });
});

describe('POST /api/start-battle-timer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200s and updates actualBattleStartedAt', async () => {
    battleSessionsFindOne.mockResolvedValueOnce({ _id: 'SESSION_OID', userId: 'user-123' });

    const res = await request(appWithBattleRouter())
      .post('/api/start-battle-timer')
      .set('Cookie', await authCookie())
      .send({ sessionId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(battleSessionsUpdateOne).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/attack-monster', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no verified cookie', async () => {
    const res = await request(appWithBattleRouter()).post('/api/attack-monster').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('200s on a successful defeat (happy path)', async () => {
    const startedAt = new Date(Date.now() - 10000); // 10s ago
    const session = {
      _id: 'SESSION_OID',
      userId: 'user-123',
      isDefeated: false,
      biome: 'forest',
      tier: 1,
      monsterTemplateName: 'Forest Wolf',
      startedAt,
      monster: {
        name: 'Forest Wolf',
        rarity: 'common',
        isBoss: false,
        clicksRequired: 5,
        attackDamage: 5,
      },
    };
    battleSessionsFindOne.mockResolvedValueOnce(session);
    playerStatsFindOne.mockResolvedValueOnce(basePlayerStats());
    battleSessionsFindOneAndUpdate.mockResolvedValueOnce({ _id: 'SESSION_OID' });

    const res = await request(appWithBattleRouter())
      .post('/api/attack-monster')
      .set('Cookie', await authCookie())
      .send({ sessionId: '507f1f77bcf86cd799439011', clickCount: 5, totalDamage: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.monster.name).toBe('Forest Wolf');
    expect(Array.isArray(res.body.lootOptions)).toBe(true);
    expect(playerStatsUpdateOne).toHaveBeenCalledTimes(1);
  });

  it('200s with cheatingDetected when claimed damage exceeds the plausible ceiling', async () => {
    // timeInSeconds floors to 1s (startedAt ~now, MIN_BATTLE_DURATION_MS_FOR_VALIDATION=1000ms).
    // dmgMaxPerClickNoBuff = floor((baseDamage=10 + 0) * 2.0) = 20
    // dmgMaxManualClicks = ceil(1 * 20 * 1.2) = 24 -> dmgMaxPlausibleNoBuff = 24 * 20 = 480
    // DMG_CEILING_TOLERANCE = 5 -> ceiling = 2400. totalDamage=3000 exceeds it, while
    // expectedHP stays well above the death threshold so the HP-cheat branch is NOT hit first.
    const session = {
      _id: 'SESSION_OID',
      userId: 'user-123',
      isDefeated: false,
      biome: 'forest',
      tier: 1,
      monsterTemplateName: 'Forest Wolf',
      startedAt: new Date(),
      monster: {
        name: 'Forest Wolf',
        rarity: 'common',
        isBoss: false,
        clicksRequired: 5,
        attackDamage: 5,
      },
    };
    battleSessionsFindOne.mockResolvedValueOnce(session);
    playerStatsFindOne.mockResolvedValueOnce(basePlayerStats());

    const res = await request(appWithBattleRouter())
      .post('/api/attack-monster')
      .set('Cookie', await authCookie())
      .send({ sessionId: '507f1f77bcf86cd799439011', clickCount: 5, totalDamage: 3000 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      cheatingDetected: true,
      message: 'That was more damage than possible for this battle.',
      newClicksRequired: 10, // monster.clicksRequired (5) * 2
      clickRate: expect.any(String),
    });
    // Short-circuits before the completion claim / reward writes.
    expect(battleSessionsFindOneAndUpdate).not.toHaveBeenCalled();
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });

  it('200s with hpCheatDetected and applies the death penalty when the player should have died', async () => {
    // startedAt 100s ago -> timeInSeconds=100, numberOfAttacks=100, damagePerHit=5 (defense 0)
    // -> expectedDamage=500 against maxHP=100, well past the (tolerant) death threshold.
    // totalDamage=10 stays far under the damage-ceiling check so that branch doesn't fire first.
    const startedAt = new Date(Date.now() - 100_000);
    const session = {
      _id: 'SESSION_OID',
      userId: 'user-123',
      isDefeated: false,
      biome: 'forest',
      tier: 1,
      monsterTemplateName: 'Forest Wolf',
      startedAt,
      monster: {
        name: 'Forest Wolf',
        rarity: 'common',
        isBoss: false,
        clicksRequired: 5,
        attackDamage: 5,
      },
    };
    battleSessionsFindOne.mockResolvedValueOnce(session);
    playerStatsFindOne.mockResolvedValueOnce(basePlayerStats({ coins: 100 }));

    const res = await request(appWithBattleRouter())
      .post('/api/attack-monster')
      .set('Cookie', await authCookie())
      .send({ sessionId: '507f1f77bcf86cd799439011', clickCount: 5, totalDamage: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      hpCheatDetected: true,
      message: 'You should have been defeated by the monster!\n\nYour battle session has been ended.',
      goldLost: 10, // round(coins=100 * 0.10)
      streakLost: 0, // no battlesWonStreaks recorded for this zone
    });
    expect(res.body).toHaveProperty('expectedDamage');
    expect(res.body).toHaveProperty('totalHealing');
    expect(res.body).toHaveProperty('expectedHP');
    // Ends the session (defeated, no loot) and deducts the gold penalty.
    expect(battleSessionsUpdateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { isDefeated: true, completedAt: expect.any(Date) } },
    );
    expect(playerStatsUpdateOne).toHaveBeenCalledTimes(2); // gold $inc + streak reset $set
    // Short-circuits before the completion claim.
    expect(battleSessionsFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('200s with cheatingDetected when the claimed click count exceeds the max click potential', async () => {
    // startedAt 10s ago -> timeInSeconds=10; damagePerHit=5, numberOfAttacks=10 -> expectedDamage=50
    // against maxHP=100, so the player plausibly survives (HP branch does not fire).
    // dmgMaxPlausibleNoBuff = (ceil(10*20*1.2) + 0) * 20 = 240*20 = 4800, ceiling = 24000;
    // totalDamage=10 stays far under it. clickCount=500 vastly exceeds
    // maxAllowedTotal = ceil(10*20*1.2) = 240, tripping the click-potential check.
    const startedAt = new Date(Date.now() - 10_000);
    const session = {
      _id: 'SESSION_OID',
      userId: 'user-123',
      isDefeated: false,
      biome: 'forest',
      tier: 1,
      monsterTemplateName: 'Forest Wolf',
      startedAt,
      monster: {
        name: 'Forest Wolf',
        rarity: 'common',
        isBoss: false,
        clicksRequired: 5,
        attackDamage: 5,
      },
    };
    battleSessionsFindOne.mockResolvedValueOnce(session);
    playerStatsFindOne.mockResolvedValueOnce(basePlayerStats());

    const res = await request(appWithBattleRouter())
      .post('/api/attack-monster')
      .set('Cookie', await authCookie())
      .send({ sessionId: '507f1f77bcf86cd799439011', clickCount: 500, totalDamage: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      cheatingDetected: true,
      message: 'That was quite fast for a human, are you cheating?',
      newClicksRequired: 10, // monster.clicksRequired (5) * 2
      clickRate: expect.any(String),
    });
    // Short-circuits before the completion claim / reward writes.
    expect(battleSessionsFindOneAndUpdate).not.toHaveBeenCalled();
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });
});

describe('POST /api/end-battle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200s and applies the death penalty (happy path)', async () => {
    const closedSession = {
      _id: 'SESSION_OID',
      userId: 'user-123',
      biome: 'forest',
      tier: 1,
      monsterTemplateName: 'Forest Wolf',
      startedAt: new Date(),
    };
    battleSessionsFindOneAndUpdate.mockResolvedValueOnce(closedSession);
    playerStatsFindOne.mockResolvedValueOnce(basePlayerStats({ coins: 100 }));

    const res = await request(appWithBattleRouter())
      .post('/api/end-battle')
      .set('Cookie', await authCookie())
      .send({ sessionId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.goldLost).toBe(10);
    expect(playerStatsUpdateOne).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/select-loot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200s and adds the selected item to inventory (happy path)', async () => {
    const session = {
      _id: 'SESSION_OID',
      userId: 'user-123',
      isDefeated: true,
      tier: 1,
      lootOptions: ['common_coin'],
      monster: { isCorrupted: false },
      monsterTemplateName: 'Forest Wolf',
    };
    battleSessionsFindOne.mockResolvedValueOnce(session);
    battleSessionsFindOneAndUpdate.mockResolvedValueOnce({ ...session, selectedLootId: 'common_coin' });

    const res = await request(appWithBattleRouter())
      .post('/api/select-loot')
      .set('Cookie', await authCookie())
      .send({ sessionId: '507f1f77bcf86cd799439011', lootId: 'common_coin' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      selectedLootId: 'common_coin',
      inventoryItemId: 'INV_OID',
    });
    expect(userInventoryInsertOne).toHaveBeenCalledTimes(1);
  });
});
