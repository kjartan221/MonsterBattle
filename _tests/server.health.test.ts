import request from 'supertest';
import { buildApp } from '@server/app';

describe('Express app shell', () => {
  it('GET /api/health returns 200 { ok: true }', async () => {
    const res = await request(buildApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 404 (no crash) for a non-/api route when client/dist is absent', async () => {
    const res = await request(buildApp()).get('/some/spa/route');
    expect(res.status).toBe(404);
  });
});
