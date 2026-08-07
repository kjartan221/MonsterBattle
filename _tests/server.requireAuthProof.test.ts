jest.mock('@server/lib/serverWallet', () => ({ getServerWallet: jest.fn().mockResolvedValue({}) }));
jest.mock('@shared/authProof', () => ({ authServer: { verifyAuthProof: jest.fn() } }));
jest.mock('@server/lib/authNonceStore', () => ({ consumeNonce: jest.fn() }));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { requireAuthProof } from '@server/middleware/requireAuthProof';
import { createJWT } from '@server/lib/jwt';
import { authServer } from '@shared/authProof';

const mockVerify = (authServer as unknown as { verifyAuthProof: jest.Mock }).verifyAuthProof;

function appWithGuard() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.post('/mint', requireAuthProof('mint:item'), (req, res) => {
    res.json({ userId: req.userId });
  });
  return app;
}

async function cookieFor(userId: string) {
  return `verified=${await createJWT({ userId, username: 'u' })}`;
}

describe('requireAuthProof middleware', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('401s with no session cookie', async () => {
    const res = await request(appWithGuard()).post('/mint').send({ proof: {} });
    expect(res.status).toBe(401);
  });

  it('401s with a session but no proof in the body', async () => {
    const res = await request(appWithGuard()).post('/mint').set('Cookie', await cookieFor('u1')).send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Auth proof required' });
  });

  it('401s when the proof fails verification', async () => {
    mockVerify.mockResolvedValue({ valid: false, error: 'bad proof' });
    const res = await request(appWithGuard()).post('/mint').set('Cookie', await cookieFor('u1')).send({ proof: {} });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'bad proof' });
  });

  it('401s when the proof identity does not match the session user', async () => {
    mockVerify.mockResolvedValue({ valid: true, identityKey: 'someone-else' });
    const res = await request(appWithGuard()).post('/mint').set('Cookie', await cookieFor('u1')).send({ proof: {} });
    expect(res.status).toBe(401);
  });

  it('passes through when session + proof are valid and identity matches', async () => {
    mockVerify.mockResolvedValue({ valid: true, identityKey: 'u1' });
    const res = await request(appWithGuard()).post('/mint').set('Cookie', await cookieFor('u1')).send({ proof: {} });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'u1' });
  });

  it('500s (fails closed, no hang) when proof verification throws unexpectedly', async () => {
    mockVerify.mockRejectedValue(new Error('verifier boom'));
    const res = await request(appWithGuard()).post('/mint').set('Cookie', await cookieFor('u1')).send({ proof: {} });
    expect(res.status).toBe(500);
  });
});
