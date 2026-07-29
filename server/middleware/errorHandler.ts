import type { Request, Response, NextFunction } from 'express';

/**
 * Terminal Express error middleware (4-arg signature). Logs the real error
 * server-side and returns a generic 500 so internal details never leak to the
 * client. Registered LAST in buildApp; reached via express-async-errors, which
 * forwards rejected async-handler promises to next(err) under Express 4.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
}
