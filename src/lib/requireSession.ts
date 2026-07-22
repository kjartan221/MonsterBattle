import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';

/** Verify the login-session JWT cookie. Returns { userId } or a 401 NextResponse. */
export async function requireSession(): Promise<{ userId: string } | NextResponse> {
  const token = (await cookies()).get('verified')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return { userId: (await verifyJWT(token)).userId };
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}
