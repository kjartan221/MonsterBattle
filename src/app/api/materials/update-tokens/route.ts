import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';

/**
 * POST /api/materials/update-tokens
 *
 * Updates MaterialToken documents after successful blockchain token updates
 * Called after successfully updating material token quantities on the blockchain
 *
 * Request body:
 * - updates: Array of {
 *     lootTableId: string (material type)
 *     itemName: string (material name)
 *     previousTokenId: string (old token ID)
 *     newTokenId: string | undefined (new token ID, undefined if burned)
 *     transactionId: string (BSV transaction ID)
 *     previousQuantity: number
 *     newQuantity: number
 *     operation: 'add' | 'subtract' | 'set'
 *     reason: string | undefined (optional update reason)
 *   }
 *
 * Response:
 * - success: boolean
 * - count: number (number of tokens updated)
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
    const { updates } = body;

    // Validate required fields
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty updates array' },
        { status: 400 }
      );
    }

    // Connect to MongoDB and get collections
    const { materialTokensCollection, userInventoryCollection } = await connectToMongo();

    // Process each update
    for (const update of updates) {
      // Find the material token by lootTableId and userId
      const existingToken = await materialTokensCollection.findOne({
        userId: userId,
        lootTableId: update.lootTableId,
        tokenId: update.previousTokenId,
      });

      if (!existingToken) {
        console.warn(`Material token not found: ${update.lootTableId} with tokenId ${update.previousTokenId}`);
        continue;
      }

      if (update.newQuantity === 0) {
        // Token burned - delete from database (provenance is on-chain and in Overlay system)
        await materialTokensCollection.deleteOne(
          { _id: existingToken._id }
        );
      } else {
        // Token updated - update with new token ID and quantity
        await materialTokensCollection.updateOne(
          { _id: existingToken._id },
          {
            $set: {
              tokenId: update.newTokenId,
              quantity: update.newQuantity,
              previousTokenId: update.previousTokenId,
              lastTransactionId: update.transactionId,
              updatedAt: new Date(),
            },
            $push: {
              updateHistory: {
                operation: update.operation,
                previousQuantity: update.previousQuantity,
                newQuantity: update.newQuantity,
                transactionId: update.transactionId,
                reason: update.reason || null,
                timestamp: new Date(),
              }
            }
          }
        );
      }

      // Consume UserInventory items if provided (for 'add' operations from inventory)
      if (update.inventoryItemIds && update.inventoryItemIds.length > 0) {
        const { ObjectId } = await import('mongodb');
        const objectIds = update.inventoryItemIds.map((id: string) => new ObjectId(id));

        const deleteResult = await userInventoryCollection.deleteMany({
          _id: { $in: objectIds },
          userId: userId,  // Security: ensure user owns these items
        });

        console.log(`✅ [CONSUME] Removed ${deleteResult.deletedCount} UserInventory items after updating ${update.itemName}`);
      }
    }

    console.log(`${updates.length} material tokens updated for user ${userId}`);

    return NextResponse.json({
      success: true,
      count: updates.length,
    });

  } catch (error) {
    console.error('Error in /api/materials/update-tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
