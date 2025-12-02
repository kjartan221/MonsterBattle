import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyJWT } from '@/utils/jwt';

/**
 * POST /api/nft/mint
 *
 * Creates an NFTLoot document and updates UserInventory with nftLootId reference
 * Called after successfully minting an item NFT on the blockchain
 *
 * Request body:
 * - inventoryItemId: string (UserInventory document ID)
 * - transactionId: string (BSV transaction ID)
 * - tokenId: string (blockchain token ID in format "txid.vout")
 * - metadata: object (full NFT metadata)
 *
 * Response:
 * - nftId: string (NFTLoot document ID)
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
    const {
      inventoryItemId,
      transactionId,
      tokenId,
      metadata,
    } = body;

    // Validate required fields
    if (!inventoryItemId || !transactionId || !tokenId || !metadata) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB and get collections
    const { nftLootCollection, userInventoryCollection } = await connectToMongo();

    // Verify user owns the inventory item
    const inventoryItem = await userInventoryCollection.findOne({
      _id: new ObjectId(inventoryItemId),
      userId: userId,
    });

    if (!inventoryItem) {
      return NextResponse.json(
        { error: 'Inventory item not found or not owned by user' },
        { status: 404 }
      );
    }

    // Check if already minted
    if (inventoryItem.nftLootId) {
      return NextResponse.json(
        { error: 'Item already minted as NFT' },
        { status: 400 }
      );
    }

    // Create NFTLoot document
    const nftLootDoc = {
      lootTableId: inventoryItem.lootTableId,
      name: metadata.itemName,
      description: metadata.description,
      icon: metadata.icon,
      rarity: metadata.rarity,
      type: metadata.itemType,
      attributes: {
        ...metadata,
        borderGradient: inventoryItem.borderGradient,
      },
      mintTransactionId: transactionId,
      tokenId: tokenId,
      userId: userId,
      createdAt: new Date(),
    };

    const nftResult = await nftLootCollection.insertOne(nftLootDoc);
    const nftId = nftResult.insertedId.toString();

    // Update UserInventory with nftLootId reference
    await userInventoryCollection.updateOne(
      { _id: new ObjectId(inventoryItemId) },
      {
        $set: {
          nftLootId: nftResult.insertedId,
          tokenId: tokenId,
          transactionId: transactionId,
          mintedAt: new Date(),
        }
      }
    );

    console.log(`NFT minted and saved: ${nftId} for user ${userId}`);

    return NextResponse.json({
      success: true,
      nftId: nftId,
    });

  } catch (error) {
    console.error('Error in /api/nft/mint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
