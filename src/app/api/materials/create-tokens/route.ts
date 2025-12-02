import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';

/**
 * POST /api/materials/create-tokens
 *
 * Creates MaterialToken documents in the database after successful blockchain minting
 * Called after successfully creating material tokens on the blockchain
 *
 * Request body:
 * - tokens: Array of {
 *     lootTableId: string (reference to loot-table.ts)
 *     itemName: string (material name)
 *     tokenId: string (blockchain token ID in format "txid.vout")
 *     transactionId: string (BSV transaction ID)
 *     quantity: number (initial quantity)
 *     metadata: object (full token metadata)
 *   }
 *
 * Response:
 * - success: boolean
 * - count: number (number of tokens created)
 */
export async function POST(request: NextRequest) {
  try {
    // Get cookies using next/headers
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    // Parse request body
    const body = await request.json();
    const { tokens } = body;

    // Validate required fields
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty tokens array' },
        { status: 400 }
      );
    }

    // Connect to MongoDB and get collections
    const { materialTokensCollection } = await connectToMongo();

    // Create MaterialToken documents
    const materialTokenDocs = tokens.map(token => ({
      userId: userId,
      lootTableId: token.lootTableId,
      itemName: token.itemName,
      tokenId: token.tokenId,
      transactionId: token.transactionId,
      quantity: token.quantity,
      metadata: token.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await materialTokensCollection.insertMany(materialTokenDocs);

    console.log(`${result.insertedCount} material tokens created for user ${userId}`);

    return NextResponse.json({
      success: true,
      count: result.insertedCount,
    });

  } catch (error) {
    console.error('Error in /api/materials/create-tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
