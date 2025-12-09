import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * POST /api/consumables/use
 * Uses a consumable item from user's inventory
 * Body: { slotIndex: number (0-3) }
 * Returns: { success: boolean, remainingQuantity: number, shouldUnequip: boolean }
 *
 * Uses MongoDB transactions to prevent race conditions
 */
export async function POST(request: NextRequest) {
    try {
        // Verify the JWT
        const cookieStore = await cookies();
        const token = cookieStore.get('verified')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifyJWT(token);
        const userId = payload.userId;

        // Get the request body
        const body = await request.json();
        const { slotIndex } = body;

        // Validate input
        if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex > 3) {
            return NextResponse.json({ error: 'Invalid slot index' }, { status: 400 });
        }

        const { client, userInventoryCollection, playerStatsCollection } = await connectToMongo();

        // Start a MongoDB session for transaction support
        const session = client.startSession();

        try {
            let result;

            // Run all operations in a transaction to prevent race conditions
            await session.withTransaction(async () => {
                // Get player stats to find equipped consumable
                const playerStats = await playerStatsCollection.findOne(
                    { userId },
                    { session }
                );

                if (!playerStats) {
                    throw new Error('Player stats not found');
                }

                const equippedConsumables = playerStats.equippedConsumables || ['empty', 'empty', 'empty', 'empty'] as ['empty', 'empty', 'empty', 'empty'];
                const equippedItemId = equippedConsumables[slotIndex];

                if (!equippedItemId || equippedItemId === 'empty') {
                    throw new Error('No item equipped in slot');
                }

                // Check if item exists in inventory (within transaction)
                const inventoryItem = await userInventoryCollection.findOne(
                    { _id: equippedItemId, userId },
                    { session }
                );

                if (!inventoryItem) {
                    // Item doesn't exist, unequip it
                    equippedConsumables[slotIndex] = 'empty';
                    await playerStatsCollection.updateOne(
                        { userId },
                        { $set: { equippedConsumables } },
                        { session }
                    );
                    result = {
                        success: false,
                        remainingQuantity: 0,
                        shouldUnequip: true,
                        error: 'Item not found in inventory'
                    };
                    return;
                }

                const lootTableId = inventoryItem.lootTableId;

                // Phase 3.5: Enhanced consumables have infinite uses
                if (inventoryItem.enhanced) {
                    // Don't delete the item, just set cooldown
                    // Count all instances of this consumable (for display)
                    const totalCount = await userInventoryCollection.countDocuments(
                        { userId, lootTableId },
                        { session }
                    );

                    result = {
                        success: true,
                        remainingQuantity: totalCount, // Keep showing quantity
                        shouldUnequip: false, // Never unequip enhanced items
                        lootTableId,
                        isEnhanced: true
                    };
                    return;
                }

                // Regular consumable: Delete one instance of the item (within transaction)
                await userInventoryCollection.deleteOne(
                    { _id: equippedItemId, userId },
                    { session }
                );

                // Count remaining items of same type (within transaction)
                const remainingCount = await userInventoryCollection.countDocuments(
                    { userId, lootTableId },
                    { session }
                );

                // If no more items, unequip from slot
                let shouldUnequip = false;
                if (remainingCount === 0) {
                    equippedConsumables[slotIndex] = 'empty';
                    await playerStatsCollection.updateOne(
                        { userId },
                        { $set: { equippedConsumables } },
                        { session }
                    );
                    shouldUnequip = true;
                } else {
                    // Update equipped item to next available instance (within transaction)
                    const nextItem = await userInventoryCollection.findOne(
                        { userId, lootTableId },
                        { session }
                    );
                    if (nextItem) {
                        equippedConsumables[slotIndex] = nextItem._id;
                        await playerStatsCollection.updateOne(
                            { userId },
                            { $set: { equippedConsumables } },
                            { session }
                        );
                    }
                }

                result = {
                    success: true,
                    remainingQuantity: remainingCount,
                    shouldUnequip,
                    lootTableId
                };
            });

            return NextResponse.json(result);
        } catch (error: any) {
            console.error('Error using consumable:', error);
            return NextResponse.json({ error: error.message || 'Failed to use consumable' }, { status: 500 });
        } finally {
            await session.endSession();
        }
    } catch (error) {
        console.error('Error using consumable:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}