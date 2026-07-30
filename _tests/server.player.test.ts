// Self-contained mount (Task 5 owns the real index.ts wiring): this test builds its own
// express() app (cookie-parser + express.json()) and mounts playerRouter directly at
// '/api', independent of buildApp()/mountRoutes(). Auth uses the REAL requireSession
// middleware + a REAL JWT (via createJWT) set as the `verified` cookie, mirroring
// _tests/server.battle.test.ts. connectToMongo is mocked per test.

const playerStatsFindOne = jest.fn();
const playerStatsUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const playerStatsInsertOne = jest.fn(async () => ({ insertedId: 'STATS_OID' }));

jest.mock('@/lib/mongodb', () => ({
  connectToMongo: jest.fn(async () => ({
    playerStatsCollection: {
      findOne: playerStatsFindOne,
      updateOne: playerStatsUpdateOne,
      insertOne: playerStatsInsertOne,
    },
  })),
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { playerRouter } from '@server/routes/player';
import { createJWT } from '@/utils/jwt';

function appWithPlayerRouter() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', playerRouter);
  return app;
}

async function authCookie(userId = 'user-123') {
  const token = await createJWT({ userId, username: 'alice' });
  return `verified=${token}`;
}

function baseStats(overrides: Record<string, any> = {}) {
  return {
    _id: 'STATS_OID',
    userId: 'user-123',
    level: 3,
    experience: 50,
    coins: 100,
    maxHealth: 100,
    currentHealth: 100,
    equippedItems: {},
    equippedConsumables: ['empty', 'empty', 'empty', 'empty'],
    baseDamage: 1,
    critChance: 5,
    attackSpeed: 1.0,
    currentZone: 0,
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
    },
    ...overrides,
  };
}

describe('GET /api/player-stats', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no verified cookie', async () => {
    const res = await request(appWithPlayerRouter()).get('/api/player-stats');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('200s with existing stats (legacy weapon fields absent, _id stringified)', async () => {
    const existing = baseStats();
    playerStatsFindOne.mockResolvedValueOnce(existing);

    const res = await request(appWithPlayerRouter())
      .get('/api/player-stats')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.playerStats._id).toBe('STATS_OID');
    expect(res.body.playerStats.equippedWeapon).toBeUndefined();
    expect(res.body.playerStats.equippedArmor).toBeUndefined();
    expect(res.body.playerStats.equippedAccessory1).toBeUndefined();
    expect(res.body.playerStats.equippedAccessory2).toBeUndefined();
    expect(res.body.playerStats.level).toBe(3);
  });

  it('200s and back-fills equippedConsumables when missing/malformed', async () => {
    const existing = baseStats({ equippedConsumables: undefined });
    playerStatsFindOne.mockResolvedValueOnce(existing);

    const res = await request(appWithPlayerRouter())
      .get('/api/player-stats')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(200);
    expect(playerStatsUpdateOne).toHaveBeenCalledTimes(1);
    expect(playerStatsUpdateOne).toHaveBeenCalledWith(
      { userId: 'user-123' },
      { $set: { equippedConsumables: ['empty', 'empty', 'empty', 'empty'] } }
    );
    expect(res.body.playerStats.equippedConsumables).toEqual(['empty', 'empty', 'empty', 'empty']);
    // Only one findOne (no legacy-equipment refetch needed for this branch).
    expect(playerStatsFindOne).toHaveBeenCalledTimes(1);
  });

  it('200s and migrates legacy equipment fields into equippedItems, then unsets them', async () => {
    const legacyDoc = baseStats({
      equippedItems: undefined,
      equippedWeapon: 'legacy-weapon-id',
      equippedArmor: 'legacy-armor-id',
    });
    const migratedDoc = baseStats({
      equippedItems: { weapon: 'legacy-weapon-id', armor: 'legacy-armor-id' },
    });
    playerStatsFindOne.mockResolvedValueOnce(legacyDoc); // initial fetch
    playerStatsFindOne.mockResolvedValueOnce(migratedDoc); // refetch after migration

    const res = await request(appWithPlayerRouter())
      .get('/api/player-stats')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(200);
    expect(playerStatsUpdateOne).toHaveBeenCalledTimes(2);
    expect(playerStatsUpdateOne).toHaveBeenNthCalledWith(
      1,
      { userId: 'user-123' },
      { $set: { equippedItems: { weapon: 'legacy-weapon-id', armor: 'legacy-armor-id' } } }
    );
    expect(playerStatsUpdateOne).toHaveBeenNthCalledWith(
      2,
      { userId: 'user-123' },
      { $unset: { equippedWeapon: 1, equippedArmor: 1, equippedAccessory1: 1, equippedAccessory2: 1 } }
    );
    expect(playerStatsFindOne).toHaveBeenCalledTimes(2);
    expect(res.body.playerStats.equippedItems).toEqual({ weapon: 'legacy-weapon-id', armor: 'legacy-armor-id' });
    expect(res.body.playerStats.equippedWeapon).toBeUndefined();
    expect(res.body.playerStats.equippedArmor).toBeUndefined();
  });

  it('500s when the post-migration refetch returns null', async () => {
    const legacyDoc = baseStats({
      equippedItems: undefined,
      equippedWeapon: 'legacy-weapon-id',
    });
    playerStatsFindOne.mockResolvedValueOnce(legacyDoc); // initial fetch
    playerStatsFindOne.mockResolvedValueOnce(null); // refetch fails

    const res = await request(appWithPlayerRouter())
      .get('/api/player-stats')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to refetch player stats after migration' });
    expect(playerStatsUpdateOne).toHaveBeenCalledTimes(2);
  });

  it('200s and creates default stats when none exist', async () => {
    playerStatsFindOne.mockResolvedValueOnce(null); // no existing stats
    playerStatsFindOne.mockResolvedValueOnce(baseStats({
      _id: 'NEW_OID',
      level: 1,
      experience: 0,
      coins: 0,
      unlockedZones: ['forest-1'],
    })); // refetch after insertOne

    const res = await request(appWithPlayerRouter())
      .get('/api/player-stats')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(playerStatsInsertOne).toHaveBeenCalledTimes(1);
    expect(res.body.playerStats.unlockedZones).toEqual(['forest-1']);
    expect(res.body.playerStats.level).toBe(1);
  });
});

describe('PATCH /api/player-stats', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400s when the body sanitizes to nothing', async () => {
    const res = await request(appWithPlayerRouter())
      .patch('/api/player-stats')
      .set('Cookie', await authCookie())
      .send({ updates: { level: 99 } }); // level is not client-writable

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No permitted fields to update (only currentHealth is client-writable)' });
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });

  it('200s and updates currentHealth (happy path)', async () => {
    playerStatsFindOne.mockResolvedValueOnce(baseStats({ currentHealth: 50 }));

    const res = await request(appWithPlayerRouter())
      .patch('/api/player-stats')
      .set('Cookie', await authCookie())
      .send({ updates: { currentHealth: 50 } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.playerStats._id).toBe('STATS_OID');
    expect(res.body.playerStats.currentHealth).toBe(50);
    expect(playerStatsUpdateOne).toHaveBeenCalledWith(
      { userId: 'user-123' },
      { $set: { currentHealth: 50 } }
    );
  });

  it('404s when updateOne matches no document', async () => {
    playerStatsUpdateOne.mockResolvedValueOnce({ matchedCount: 0 } as any);

    const res = await request(appWithPlayerRouter())
      .patch('/api/player-stats')
      .set('Cookie', await authCookie())
      .send({ updates: { currentHealth: 50 } });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Player stats not found' });
    expect(playerStatsFindOne).not.toHaveBeenCalled();
  });
});
