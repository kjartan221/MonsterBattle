import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyJWT } from '@/utils/jwt';

/**
 * POST /api/crafting/blockchain-craft
 *
 * Handles database updates after crafting an item NFT on the blockchain
 * - Creates NFTLoot document for crafted item
 * - Updates output UserInventory item with nftLootId
 * - Marks input items as consumed
 *
 * Request body:
 * - inventoryItemId: string (newly crafted item's UserInventory document ID)
 * - transactionId: string (BSV transaction ID)
 * - tokenId: string (blockchain token ID in format "txid.vout")
 * - metadata: object (full crafted NFT metadata)
 * - consumedItems: Array of { inventoryItemId: string, tokenId: string }
 *
 * Response:
 * - success: boolean
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
      consumedItems,
      materialChanges,
    } = body;

    // Validate required fields
    if (!inventoryItemId || !transactionId || !tokenId || !metadata) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB and get collections
    const { nftLootCollection, userInventoryCollection, materialTokensCollection } = await connectToMongo();

    // Verify user owns the output inventory item
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

    // Create NFTLoot document for crafted item
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
        crafted: true,
        craftedAt: metadata.crafting?.craftedAt,
        craftedBy: metadata.crafting?.craftedBy,
        recipeId: metadata.crafting?.recipeId,
        inputItems: metadata.crafting?.inputItems,
      },
      mintTransactionId: transactionId,
      tokenId: tokenId,
      userId: userId,
      createdAt: new Date(),
    };

    const nftResult = await nftLootCollection.insertOne(nftLootDoc);
    const nftId = nftResult.insertedId.toString();

    // Update output UserInventory with nftLootId reference
    await userInventoryCollection.updateOne(
      { _id: new ObjectId(inventoryItemId) },
      {
        $set: {
          nftLootId: nftResult.insertedId,
          tokenId: tokenId,
          transactionId: transactionId,
          craftedAt: new Date(),
        }
      }
    );

    // Mark consumed input items as consumed
    if (consumedItems && Array.isArray(consumedItems)) {
      for (const consumed of consumedItems) {
        if (consumed.inventoryItemId) {
          await userInventoryCollection.updateOne(
            {
              _id: new ObjectId(consumed.inventoryItemId),
              userId: userId,
            },
            {
              $set: {
                consumed: true,
                consumedAt: new Date(),
                consumedInCraft: {
                  outputInventoryItemId: inventoryItemId,
                  outputTokenId: tokenId,
                  transactionId: transactionId,
                },
              }
            }
          );
        }
      }
    }

    // Update material tokens that had remaining quantity (material "change")
    if (materialChanges && Array.isArray(materialChanges) && materialChanges.length > 0) {
      for (const change of materialChanges) {
        // Find the material token by userId and previousTokenId
        const existingToken = await materialTokensCollection.findOne({
          userId: userId,
          tokenId: change.previousTokenId,
        });

        if (!existingToken) {
          console.warn(`Material token not found for change: ${change.previousTokenId}`);
          continue;
        }

        // Update the material token with new tokenId and quantity
        await materialTokensCollection.updateOne(
          { _id: existingToken._id },
          {
            $set: {
              tokenId: change.newTokenId,
              quantity: change.newQuantity,
              previousTokenId: change.previousTokenId,
              lastTransactionId: transactionId,
              updatedAt: new Date(),
            },
            $push: {
              updateHistory: {
                operation: 'subtract',
                previousQuantity: change.previousQuantity,
                newQuantity: change.newQuantity,
                transactionId: transactionId,
                reason: `Partial consumption in crafting recipe`,
                timestamp: new Date(),
              }
            }
          }
        );
      }
    }

    console.log(`Crafted NFT saved: ${nftId} for user ${userId}, consumed ${consumedItems?.length || 0} items, updated ${materialChanges?.length || 0} material tokens`);

    return NextResponse.json({
      success: true,
      nftId: nftId,
    });

  } catch (error) {
    console.error('Error in /api/crafting/blockchain-craft:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
