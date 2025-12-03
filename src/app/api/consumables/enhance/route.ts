import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getLootItemById } from '@/lib/loot-table';

/**
 * POST /api/consumables/enhance
 *
 * Phase 3.5: Consumable Enhancement System
 * Enhance a consumable to make it infinite-use (with cooldown)
 *
 * Requirements:
 * - Gold cost (500g common, 2000g rare, 5000g epic, 10000g legendary)
 * - 5 duplicates of the same consumable (keeps 1, consumes 4 others)
 *
 * Body:
 * {
 *   targetItemId: string  // ObjectId of the consumable to enhance
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
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
    const { targetItemId } = body;

    if (!targetItemId || typeof targetItemId !== 'string') {
      return NextResponse.json(
        { error: 'Target item ID is required' },
        { status: 400 }
      );
    }

    // Validate ObjectId
    let targetObjectId: ObjectId;
    try {
      targetObjectId = new ObjectId(targetItemId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid item ID format' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { userInventoryCollection, playerStatsCollection } = await connectToMongo();

    // Fetch the target item
    const targetItem = await userInventoryCollection.findOne({
      _id: targetObjectId,
      userId
    });

    if (!targetItem) {
      return NextResponse.json(
        { error: 'Item not found in your inventory' },
        { status: 404 }
      );
    }

    // Verify it's a consumable
    if (targetItem.itemType !== 'consumable') {
      return NextResponse.json(
        { error: 'Only consumables can be enhanced' },
        { status: 400 }
      );
    }

    // Check if already enhanced
    if (targetItem.enhanced) {
      return NextResponse.json(
        { error: 'This consumable is already enhanced' },
        { status: 400 }
      );
    }

    // Get the loot template to check rarity
    const lootTemplate = getLootItemById(targetItem.lootTableId);
    if (!lootTemplate) {
      return NextResponse.json(
        { error: 'Item template not found' },
        { status: 404 }
      );
    }

    // Calculate gold cost based on rarity
    const goldCosts: Record<string, number> = {
      common: 500,
      rare: 2000,
      epic: 5000,
      legendary: 10000
    };
    const goldCost = goldCosts[lootTemplate.rarity] || 500;

    // Fetch player stats to check gold
    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      return NextResponse.json(
        { error: 'Player stats not found' },
        { status: 404 }
      );
    }

    // Check if player has enough gold
    if (playerStats.coins < goldCost) {
      return NextResponse.json(
        {
          error: `Insufficient gold. Need ${goldCost} gold to enhance this consumable.`,
          goldCost,
          currentGold: playerStats.coins
        },
        { status: 400 }
      );
    }

    // Count duplicates of the same consumable (same lootTableId only)
    // Note: We ignore tier and empowered status because consumables don't have equipment stats
    // Any tier/empowered combination of the same consumable counts as a duplicate
    const duplicates = await userInventoryCollection.find({
      userId,
      lootTableId: targetItem.lootTableId,
      itemType: 'consumable',
      enhanced: { $ne: true } // Don't count already enhanced items
    }).toArray();

    const REQUIRED_DUPLICATES = 5; // Total required (will keep 1, consume 4 others)

    if (duplicates.length < REQUIRED_DUPLICATES) {
      return NextResponse.json(
        {
          error: `Need ${REQUIRED_DUPLICATES} copies of this consumable. You have ${duplicates.length}.`,
          required: REQUIRED_DUPLICATES,
          current: duplicates.length
        },
        { status: 400 }
      );
    }

    // Delete 4 duplicates (keep the target item, delete others)
    const itemsToDelete = duplicates
      .filter(item => item._id.toString() !== targetItemId)
      .slice(0, REQUIRED_DUPLICATES - 1) // Take 4 items
      .map(item => item._id);

    if (itemsToDelete.length < REQUIRED_DUPLICATES - 1) {
      return NextResponse.json(
        {
          error: `Could not find enough duplicates to consume. Need ${REQUIRED_DUPLICATES - 1} others besides the target.`,
          required: REQUIRED_DUPLICATES - 1,
          found: itemsToDelete.length
        },
        { status: 400 }
      );
    }

    // Perform the enhancement (transaction-like operations)
    // 1. Delete duplicate items
    await userInventoryCollection.deleteMany({
      _id: { $in: itemsToDelete }
    });

    // 2. Deduct gold cost
    await playerStatsCollection.updateOne(
      { userId },
      { $inc: { coins: -goldCost } }
    );

    // 3. Set enhanced flag on target item
    await userInventoryCollection.updateOne(
      { _id: targetObjectId },
      { $set: { enhanced: true } }
    );

    console.log(`✨ [ENHANCE] User ${userId} enhanced ${lootTemplate.name} (${targetItemId})`);
    console.log(`   - Consumed ${itemsToDelete.length} duplicates`);
    console.log(`   - Paid ${goldCost} gold`);

    return NextResponse.json({
      success: true,
      itemName: lootTemplate.name,
      itemIcon: lootTemplate.icon,
      rarity: lootTemplate.rarity,
      goldCost,
      duplicatesConsumed: itemsToDelete.length,
      remainingGold: playerStats.coins - goldCost
    });

  } catch (error) {
    console.error('Error enhancing consumable:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
