import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';

/**
 * GET /api/check-session
 *
 * Quick endpoint to check if user has a valid session
 * Returns { authenticated: true/false }
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    // Verify the JWT is valid
    const payload = await verifyJWT(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true, userId: payload.userId });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
