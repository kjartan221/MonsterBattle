import 'express-async-errors';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { mountRoutes } from './routes';
import { errorHandler } from './middleware/errorHandler';

/**
 * Build the Express app: JSON + cookies, health, feature routers, an optional
 * static SPA (client/dist), and a terminal error handler. `express-async-errors`
 * (imported for its side effect above) forwards async-handler rejections to it.
 */
export function buildApp(): Express {
  const app = express();

  // Request logger: method + path on arrival, then status + duration on finish.
  app.use((req, res, next) => {
    const start = Date.now();
    console.log(`[server] --> ${req.method} ${req.originalUrl}`);
    res.on('finish', () => {
      console.log(`[server] <-- ${req.method} ${req.originalUrl} ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  mountRoutes(app);

  const clientDist = path.resolve(process.cwd(), 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
