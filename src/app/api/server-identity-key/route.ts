import { NextResponse } from 'next/server';
import { getServerIdentityPublicKey } from '@/lib/serverWallet';

/**
 * GET /api/server-identity-key
 *
 * Returns the server wallet's IDENTITY public key (root key, not derived)
 * Used for plain P2PKH payment transactions to avoid BIP32 counterparty derivation issues
 *
 * SECURITY: Only returns PUBLIC key - private key never exposed
 */
export async function GET() {
  try {
    const identityPublicKey = await getServerIdentityPublicKey();

    return NextResponse.json({
      publicKey: identityPublicKey,
    });
  } catch (error) {
    console.error('Error getting server identity key:', error);
    return NextResponse.json(
      { error: 'Failed to get server identity key' },
      { status: 500 }
    );
  }
}
