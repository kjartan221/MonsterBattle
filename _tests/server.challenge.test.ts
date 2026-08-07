// Self-contained mount: builds its own express() app (cookie-parser + express.json())
// and mounts challengeRouter directly at '/api/challenge', independent of
// buildApp()/mountRoutes(). GET uses the REAL requireSession middleware + a REAL JWT
// (via createJWT) set as the `verified` cookie, mirroring _tests/server.battle.test.ts.
// POST /update uses the REAL requireAuthProof middleware; its lower-level dependencies
// (getServerWallet, authServer.verifyAuthProof, consumeNonce) are mocked, mirroring
// _tests/server.requireAuthProof.test.ts. connectToMongo is mocked per test.

jest.mock('@server/lib/serverWallet', () => ({ getServerWallet: jest.fn().mockResolvedValue({}) }));
jest.mock('@shared/authProof', () => ({ authServer: { verifyAuthProof: jest.fn() } }));
jest.mock('@server/lib/authNonceStore', () => ({ consumeNonce: jest.fn() }));

const playerStatsFindOne = jest.fn();
const playerStatsUpdateOne = jest.fn(async () => ({ matchedCount: 1 }));

jest.mock('@server/lib/mongodb', () => ({
  connectToMongo: jest.fn(async () => ({
    playerStatsCollection: { findOne: playerStatsFindOne, updateOne: playerStatsUpdateOne },
  })),
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { challengeRouter } from '@server/routes/challenge';
import { createJWT } from '@server/lib/jwt';
import { authServer } from '@shared/authProof';

const mockVerify = (authServer as unknown as { verifyAuthProof: jest.Mock }).verifyAuthProof;

function appWithChallengeRouter() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/challenge', challengeRouter);
  return app;
}

async function authCookie(userId = 'user-123') {
  const token = await createJWT({ userId, username: 'alice' });
  return `verified=${token}`;
}

function validConfig(overrides: Record<string, any> = {}) {
  return {
    forceShield: false,
    forceSpeed: false,
    damageMultiplier: 1.0,
    hpMultiplier: 1.0,
    dotIntensity: 1.0,
    corruptionRate: 0,
    escapeTimerSpeed: 1.0,
    buffStrength: 1.0,
    ...overrides,
  };
}

/** Auth proof that verifies successfully for `user-123` (the requireAuthProof identity check). */
function seedValidProof() {
  mockVerify.mockResolvedValue({ valid: true, identityKey: 'user-123' });
}

describe('GET /api/challenge/get', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no verified cookie', async () => {
    const res = await request(appWithChallengeRouter()).get('/api/challenge/get');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('404s when player stats are missing', async () => {
    playerStatsFindOne.mockResolvedValueOnce(null);

    const res = await request(appWithChallengeRouter())
      .get('/api/challenge/get')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Player stats not found' });
  });

  it('200s and returns default config when none is stored (happy path)', async () => {
    playerStatsFindOne.mockResolvedValueOnce({ userId: 'user-123' });

    const res = await request(appWithChallengeRouter())
      .get('/api/challenge/get')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      config: {
        forceShield: false,
        forceSpeed: false,
        damageMultiplier: 1.0,
        hpMultiplier: 1.0,
        dotIntensity: 1.0,
        corruptionRate: 0,
        escapeTimerSpeed: 1.0,
        buffStrength: 1.0,
        bossSpawnRate: 1.0,
        skillshotCircles: 0,
        skillshotSpeed: 1.0,
      },
    });
  });

  it('200s and merges a stored (legacy, partial) config over the defaults', async () => {
    playerStatsFindOne.mockResolvedValueOnce({
      userId: 'user-123',
      battleChallengeConfig: { forceShield: true, damageMultiplier: 2.0 },
    });

    const res = await request(appWithChallengeRouter())
      .get('/api/challenge/get')
      .set('Cookie', await authCookie());

    expect(res.status).toBe(200);
    expect(res.body.config).toMatchObject({
      forceShield: true,
      damageMultiplier: 2.0,
      // Legacy config lacked these newer fields; defaults fill in.
      bossSpawnRate: 1.0,
      skillshotCircles: 0,
      skillshotSpeed: 1.0,
    });
  });
});

describe('POST /api/challenge/update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no proof present in the body', async () => {
    const res = await request(appWithChallengeRouter())
      .post('/api/challenge/update')
      .set('Cookie', await authCookie())
      .send({ config: validConfig() }); // no `proof` field

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Auth proof required' });
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });

  it('400s when config is missing (valid proof, reaches handler)', async () => {
    seedValidProof();

    const res = await request(appWithChallengeRouter())
      .post('/api/challenge/update')
      .set('Cookie', await authCookie())
      .send({ proof: {} });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Config required' });
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });

  it('400s when a config field has the wrong type', async () => {
    seedValidProof();

    const res = await request(appWithChallengeRouter())
      .post('/api/challenge/update')
      .set('Cookie', await authCookie())
      .send({ proof: {}, config: validConfig({ forceShield: 'yes' }) });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid config format' });
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });

  it('400s when a multiplier value is not in the allowed set', async () => {
    seedValidProof();

    const res = await request(appWithChallengeRouter())
      .post('/api/challenge/update')
      .set('Cookie', await authCookie())
      .send({ proof: {}, config: validConfig({ damageMultiplier: 1.75 }) });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid damage multiplier' });
    expect(playerStatsUpdateOne).not.toHaveBeenCalled();
  });

  it('404s when player stats are not found', async () => {
    seedValidProof();
    playerStatsUpdateOne.mockResolvedValueOnce({ matchedCount: 0 });

    const res = await request(appWithChallengeRouter())
      .post('/api/challenge/update')
      .set('Cookie', await authCookie())
      .send({ proof: {}, config: validConfig() });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Player not found' });
  });

  it('200s and updates the stored config (happy path, valid proof)', async () => {
    seedValidProof();
    const config = validConfig({ forceShield: true, hpMultiplier: 2.0 });

    const res = await request(appWithChallengeRouter())
      .post('/api/challenge/update')
      .set('Cookie', await authCookie())
      .send({ proof: {}, config });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, config });
    expect(playerStatsUpdateOne).toHaveBeenCalledWith(
      { userId: 'user-123' },
      { $set: { battleChallengeConfig: config } },
    );
  });
});
