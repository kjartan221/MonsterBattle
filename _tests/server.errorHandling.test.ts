import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '@server/middleware/errorHandler';
import { buildApp } from '@server/app';

describe('async error handling', () => {
  it('forwards an async handler throw to the error middleware → generic 500', async () => {
    const app = express();
    app.get('/boom', async () => {
      throw new Error('async boom');
    });
    app.use(errorHandler);
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('buildApp still serves /api/health (regression)', async () => {
    const res = await request(buildApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
