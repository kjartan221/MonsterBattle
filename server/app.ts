import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

/**
 * Build the Express app: JSON + cookies, a health route, and (when the Vite
 * SPA has been built into client/dist) static serving with an SPA fallback.
 * The 42 API route handlers are mounted in a later phase.
 */
export function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const clientDist = path.resolve(process.cwd(), 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}
