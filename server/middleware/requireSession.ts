import type { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '@server/lib/jwt';

/** Read the `verified` login-session JWT cookie; return its userId, or null if missing/invalid. */
export async function getUserIdFromCookie(req: Request): Promise<string | null> {
  const token = req.cookies?.verified as string | undefined;
  if (!token) return null;
  try {
    return (await verifyJWT(token)).userId;
  } catch {
    return null;
  }
}

/** Express guard: require a valid login session. Sets req.userId or responds 401. */
export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = await getUserIdFromCookie(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.userId = userId;
  next();
}
