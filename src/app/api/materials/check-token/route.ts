import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo } from '@/lib/mongodb';
import { requireSession } from '@/lib/requireSession';

/**
 * API endpoint to check if a material token already exists
 *
 * POST /api/materials/check-token
 * Body: { lootTableId: string, tier: number }
 *
 * Returns: { exists: boolean, token?: { tokenId, quantity, keyId, counterparty } }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session instanceof NextResponse) return session;
    const userId = session.userId;

    // Parse request body
    const { lootTableId, tier } = await request.json();

    if (!lootTableId || !tier) {
      return NextResponse.json({ error: 'Missing lootTableId or tier' }, { status: 400 });
    }

    // Connect to database
    const { materialTokensCollection } = await connectToMongo();

    // Check if a material token exists for this user, lootTableId, and tier
    // Also ensure the token is not consumed (used in crafting)
    const existingToken = await materialTokensCollection.findOne({
      userId,
      lootTableId,
      tier,
      consumed: { $ne: true },
    });

    if (existingToken) {
      return NextResponse.json({
        exists: true,
        token: {
          tokenId: existingToken.tokenId,
          quantity: existingToken.quantity,
          keyId: existingToken.keyId,
          counterparty: existingToken.counterparty,
        },
      });
    } else {
      return NextResponse.json({
        exists: false,
      });
    }

  } catch (error) {
    console.error('Error checking material token:', error);
    return NextResponse.json(
      { error: 'Failed to check material token' },
      { status: 500 }
    );
  }
}
