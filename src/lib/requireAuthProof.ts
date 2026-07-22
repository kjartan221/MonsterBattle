import { NextRequest, NextResponse } from 'next/server';
import { getServerWallet } from '@/lib/serverWallet';
import { authServer } from '@/lib/authProof';
import { consumeNonce } from '@/lib/authNonceStore';
import { assertOwnIdentityKey, IdentityMismatchError } from '@/lib/identityGuard';
import { requireSession } from '@/lib/requireSession';
import type { AuthProof } from '@bsv/auth';

/**
 * Two-layer guard for value-moving routes: a valid login session (JWT cookie)
 * AND a valid single-use signed ownership proof, bound to the same identity.
 * Returns { userId } on success, or a NextResponse (401) to return directly.
 */
export async function requireAuthProof(
  request: NextRequest,
  context: string,
  proof: unknown
): Promise<{ userId: string } | NextResponse> {
  // Layer 1: valid login session.
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const { userId } = session;

  // Layer 2: valid single-use proof, bound to the session identity.
  if (!proof) return NextResponse.json({ error: 'Auth proof required' }, { status: 401 });

  const serverWallet = await getServerWallet();
  const result = await authServer.verifyAuthProof(serverWallet, proof as AuthProof, context, { consumeNonce });
  if (!result.valid) {
    return NextResponse.json({ error: result.error ?? 'Invalid auth proof' }, { status: 401 });
  }

  try { assertOwnIdentityKey(result.identityKey, userId); }
  catch (e) {
    if (e instanceof IdentityMismatchError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  return { userId };
}
