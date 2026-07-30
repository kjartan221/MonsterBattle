import type { Express } from 'express';
import { itemsRouter } from './items';
import { materialsRouter } from './materials';
import { craftingRouter } from './crafting';
import { equipmentRouter } from './equipment';
import { marketplaceRouter } from './marketplace';

/** Mounts all API routers. Feature routers are added here as routes are ported. */
export function mountRoutes(app: Express): void {
  app.use('/api/items', itemsRouter);
  app.use('/api/materials', materialsRouter);
  app.use('/api/crafting', craftingRouter);
  app.use('/api/equipment', equipmentRouter);
  app.use('/api/marketplace', marketplaceRouter);
}
