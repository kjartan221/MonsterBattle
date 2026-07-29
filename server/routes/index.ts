import type { Express } from 'express';
import { itemsRouter } from './items';

/** Mounts all API routers. Feature routers are added here as routes are ported. */
export function mountRoutes(app: Express): void {
  app.use('/api/items', itemsRouter);
}
