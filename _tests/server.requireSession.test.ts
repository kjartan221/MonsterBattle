import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { requireSession } from '@server/middleware/requireSession';
import { createJWT } from '@server/lib/jwt';

function appWithGuard() {
  const app = express();
  app.use(cookieParser());
  app.get('/protected', requireSession, (req, res) => {
    res.json({ userId: req.userId });
  });
  return app;
}

describe('requireSession middleware', () => {
  it('401s when no session cookie is present', async () => {
    const res = await request(appWithGuard()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('401s when the cookie is not a valid token', async () => {
    const res = await request(appWithGuard()).get('/protected').set('Cookie', 'verified=garbage');
    expect(res.status).toBe(401);
  });

  it('passes through and exposes req.userId for a valid token', async () => {
    const token = await createJWT({ userId: 'user-123', username: 'alice' });
    const res = await request(appWithGuard()).get('/protected').set('Cookie', `verified=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'user-123' });
  });
});
