// Self-contained mount: builds its own express() app (cookie-parser + express.json())
// and mounts authRouter directly at '/api', independent of buildApp()/mountRoutes().
// getServerWallet/authServer.verifyAuthProof/consumeNonce/usersCollection are mocked.
// The login-cookie test also replays the minted Set-Cookie against a real
// requireSession-guarded probe route to prove end-to-end cookie compatibility.

jest.mock('@/lib/serverWallet', () => ({
  getServerWallet: jest.fn().mockResolvedValue({}),
  getServerPublicKey: jest.fn().mockResolvedValue('mock-derived-pubkey'),
  getServerIdentityPublicKey: jest.fn().mockResolvedValue('mock-identity-pubkey'),
}));
jest.mock('@/lib/authProof', () => ({ authServer: { verifyAuthProof: jest.fn() } }));
jest.mock('@/lib/authNonceStore', () => ({ consumeNonce: jest.fn() }));

const usersFindOne = jest.fn();
const usersUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const usersInsertOne = jest.fn(async () => ({ insertedId: 'USER_OID' }));

jest.mock('@/lib/mongodb', () => ({
  connectToMongo: jest.fn(async () => ({
    usersCollection: {
      findOne: usersFindOne,
      updateOne: usersUpdateOne,
      insertOne: usersInsertOne,
    },
  })),
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { authRouter } from '@server/routes/auth';
import { requireSession } from '@server/middleware/requireSession';
import { authServer } from '@/lib/authProof';

const mockVerify = (authServer as unknown as { verifyAuthProof: jest.Mock }).verifyAuthProof;

function appWithAuthRouter() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', authRouter);
  // Probe route guarded by the REAL requireSession middleware, to validate cookie compatibility.
  app.get('/api/probe', requireSession, (req, res) => {
    res.json({ userId: req.userId });
  });
  return app;
}

describe('POST /api/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('400s when userId or username is missing', async () => {
    const res = await request(appWithAuthRouter()).post('/api/login').send({ username: 'alice' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'userId and username are required' });
  });

  it('400s when proof is missing', async () => {
    const res = await request(appWithAuthRouter())
      .post('/api/login')
      .send({ userId: 'user-123', username: 'alice' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'proof is required' });
  });

  it('401s when the proof fails verification', async () => {
    mockVerify.mockResolvedValue({ valid: false, error: 'bad proof' });
    const res = await request(appWithAuthRouter())
      .post('/api/login')
      .send({ userId: 'user-123', username: 'alice', proof: {} });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'bad proof' });
  });

  it('401s when the proof identity does not match userId', async () => {
    mockVerify.mockResolvedValue({ valid: true, identityKey: 'someone-else' });
    const res = await request(appWithAuthRouter())
      .post('/api/login')
      .send({ userId: 'user-123', username: 'alice', proof: {} });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Proof identity mismatch' });
  });

  it('200s, creates a new user, and sets the verified cookie with the right attributes', async () => {
    mockVerify.mockResolvedValue({ valid: true, identityKey: 'user-123' });
    usersFindOne
      .mockResolvedValueOnce(null) // no existing user
      .mockResolvedValueOnce({ userId: 'user-123', username: 'alice' }); // refetch after insert

    const res = await request(appWithAuthRouter())
      .post('/api/login')
      .send({ userId: 'user-123', username: 'alice', proof: {} });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, user: { userId: 'user-123', username: 'alice' } });
    expect(usersInsertOne).toHaveBeenCalledTimes(1);

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
    expect(cookieStr).toMatch(/verified=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
    expect(cookieStr).toMatch(/Path=\//i);
  });

  it('mints a cookie that satisfies a requireSession-guarded route', async () => {
    mockVerify.mockResolvedValue({ valid: true, identityKey: 'user-123' });
    usersFindOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: 'user-123', username: 'alice' });

    const app = appWithAuthRouter();
    const loginRes = await request(app)
      .post('/api/login')
      .send({ userId: 'user-123', username: 'alice', proof: {} });

    const setCookie = loginRes.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
    const verifiedCookie = cookieHeader.split(';')[0]; // "verified=<token>"

    const probeRes = await request(app).get('/api/probe').set('Cookie', verifiedCookie);
    expect(probeRes.status).toBe(200);
    expect(probeRes.body).toEqual({ userId: 'user-123' });
  });
});

describe('POST /api/logout', () => {
  it('clears the verified cookie', async () => {
    const res = await request(appWithAuthRouter()).post('/api/logout');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Logged out successfully' });

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
    expect(cookieStr).toMatch(/verified=;/);
    // Cleared cookies get an expiry in the past.
    expect(cookieStr).toMatch(/Expires=/i);
  });
});

describe('GET /api/check-session', () => {
  it('returns unauthenticated with no cookie', async () => {
    const res = await request(appWithAuthRouter()).get('/api/check-session');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
  });

  it('returns unauthenticated with a garbage cookie', async () => {
    const res = await request(appWithAuthRouter())
      .get('/api/check-session')
      .set('Cookie', 'verified=garbage');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
  });

  it('returns authenticated with a valid cookie', async () => {
    mockVerify.mockResolvedValue({ valid: true, identityKey: 'user-123' });
    usersFindOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: 'user-123', username: 'alice' });

    const app = appWithAuthRouter();
    const loginRes = await request(app)
      .post('/api/login')
      .send({ userId: 'user-123', username: 'alice', proof: {} });
    const setCookie = loginRes.headers['set-cookie'];
    const verifiedCookie = (Array.isArray(setCookie) ? setCookie[0] : String(setCookie)).split(';')[0];

    const res = await request(app).get('/api/check-session').set('Cookie', verifiedCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: true, userId: 'user-123' });
  });
});

describe('GET /api/server-public-key', () => {
  it('returns the derived server public key', async () => {
    const res = await request(appWithAuthRouter()).get('/api/server-public-key');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: 'mock-derived-pubkey' });
  });
});

describe('GET /api/server-identity-key', () => {
  it('returns the server identity public key', async () => {
    const res = await request(appWithAuthRouter()).get('/api/server-identity-key');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: 'mock-identity-pubkey' });
  });
});
