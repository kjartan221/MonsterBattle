import { NextResponse } from 'next/server';
import { getServerPublicKey } from '@/lib/serverWallet';

/**
 * GET /api/server-public-key
 *
 * Returns the server wallet's public key for crafting auth outputs
 * This allows clients to create auth outputs locked to the server
 */
export async function GET() {
  try {
    const serverPublicKey = await getServerPublicKey();

    return NextResponse.json({
      publicKey: serverPublicKey,
    });
  } catch (error) {
    console.error('Error getting server public key:', error);
    return NextResponse.json(
      { error: 'Failed to get server public key' },
      { status: 500 }
    );
  }
}
