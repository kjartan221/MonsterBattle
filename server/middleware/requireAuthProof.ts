import type { Request, Response, NextFunction } from 'express';
import type { AuthProof } from '@bsv/auth';
import { getUserIdFromCookie } from '@server/middleware/requireSession';
import { getServerWallet } from '@/lib/serverWallet';
import { authServer } from '@/lib/authProof';
import { consumeNonce } from '@/lib/authNonceStore';
import { assertOwnIdentityKey, IdentityMismatchError } from '@/lib/identityGuard';

/**
 * Two-layer guard for value-moving routes: a valid login session (JWT cookie)
 * AND a valid single-use signed ownership proof (req.body.proof), bound to the
 * same identity. `context` scopes the proof to the action (e.g. 'mint:item').
 */
export function requireAuthProof(context: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Layer 1: valid login session.
    const userId = await getUserIdFromCookie(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Layer 2: valid single-use proof, bound to the session identity.
    const proof = (req.body as { proof?: unknown })?.proof;
    if (!proof) {
      res.status(401).json({ error: 'Auth proof required' });
      return;
    }

    try {
      const serverWallet = await getServerWallet();
      const result = await authServer.verifyAuthProof(serverWallet, proof as AuthProof, context, { consumeNonce });
      if (!result.valid) {
        res.status(401).json({ error: result.error ?? 'Invalid auth proof' });
        return;
      }
      assertOwnIdentityKey(result.identityKey, userId);
      req.userId = userId;
      next();
    } catch (e) {
      if (e instanceof IdentityMismatchError) {
        res.status(401).json({ error: e.message });
        return;
      }
      // Unexpected wallet/verifier error: fail closed, respond (don't hang or crash the process).
      console.error('[requireAuthProof] unexpected error:', e);
      res.status(500).json({ error: 'Authentication error' });
    }
  };
}
