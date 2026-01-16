import { NextResponse } from 'next/server';
import { getServerPublicKey } from '@/lib/serverWallet';

/**
 * GET /api/server-public-key
 *
 * Returns the server wallet's DERIVED public key (with protocolID/keyID/counterparty)
 * Used for OrdinalsP2PKH material transfers to the server
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
