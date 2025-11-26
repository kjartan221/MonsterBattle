import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { getLootItemById } from '@/lib/loot-table';
import { ObjectId } from 'mongodb';

/**
 * POST /api/spells/upgrade
 * Upgrades a spell scroll by consuming duplicates
 * Requirements:
 * - Must have the target spell equipped or in inventory
 * - Must have required number of tier 1 duplicates of the same spell
 * - Must have required gold
 * - Each tier requires more duplicates and gold
 */
export async function POST(request: NextRequest) {
  try {
    // Get cookies
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

    // Get request body
    const body = await request.json();
    const { inventoryId } = body; // The spell inventory item to upgrade

    if (!inventoryId) {
      return NextResponse.json(
        { error: 'Missing inventoryId' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { playerStatsCollection, userInventoryCollection } = await connectToMongo();

    // Get player stats
    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      return NextResponse.json(
        { error: 'Player stats not found' },
        { status: 404 }
      );
    }

    // Get the spell scroll to upgrade
    const targetSpell = await userInventoryCollection.findOne({
      _id: new ObjectId(inventoryId),
      userId
    });

    if (!targetSpell) {
      return NextResponse.json(
        { error: 'Spell not found in inventory' },
        { status: 404 }
      );
    }

    // Verify it's a spell scroll
    const lootItem = getLootItemById(targetSpell.lootTableId);
    if (!lootItem || lootItem.type !== 'spell_scroll') {
      return NextResponse.json(
        { error: 'Item is not a spell scroll' },
        { status: 400 }
      );
    }

    // Get current tier (default to 1 if not set)
    const currentTier = targetSpell.tier || 1;
    const nextTier = currentTier + 1;

    // Define upgrade requirements per tier
    // Tier 1 → 2: 2 duplicates, 500 gold
    // Tier 2 → 3: 3 duplicates, 1500 gold
    // Tier 3 → 4: 4 duplicates, 3000 gold
    // Tier 4 → 5: 5 duplicates, 5000 gold
    const upgradeRequirements: Record<number, { duplicates: number; gold: number }> = {
      1: { duplicates: 2, gold: 500 },
      2: { duplicates: 3, gold: 1500 },
      3: { duplicates: 4, gold: 3000 },
      4: { duplicates: 5, gold: 5000 }
    };

    // Check if max tier reached
    if (currentTier >= 5) {
      return NextResponse.json(
        { error: 'Spell is already at maximum tier' },
        { status: 400 }
      );
    }

    const requirements = upgradeRequirements[currentTier];

    // Find all tier 1 duplicates of this spell (excluding the target spell itself)
    const duplicates = await userInventoryCollection.find({
      userId,
      lootTableId: targetSpell.lootTableId,
      tier: 1, // Only tier 1 spells count as duplicates
      _id: { $ne: targetSpell._id } // Exclude the spell being upgraded
    }).toArray();

    // Check if player has enough duplicates
    if (duplicates.length < requirements.duplicates) {
      return NextResponse.json(
        {
          error: `Need ${requirements.duplicates} tier 1 duplicates, have ${duplicates.length}`,
          required: requirements.duplicates,
          available: duplicates.length
        },
        { status: 400 }
      );
    }

    // Check if player has enough gold
    if (playerStats.coins < requirements.gold) {
      return NextResponse.json(
        {
          error: `Need ${requirements.gold} gold, have ${playerStats.coins}`,
          required: requirements.gold,
          available: playerStats.coins
        },
        { status: 400 }
      );
    }

    // Consume the duplicates (delete them)
    const duplicatesToConsume = duplicates.slice(0, requirements.duplicates);
    const duplicateIds = duplicatesToConsume.map(d => d._id);

    await userInventoryCollection.deleteMany({
      _id: { $in: duplicateIds }
    });

    // Deduct gold
    await playerStatsCollection.updateOne(
      { userId },
      {
        $set: {
          coins: playerStats.coins - requirements.gold
        }
      }
    );

    // Upgrade the spell to next tier (cast to Tier type)
    await userInventoryCollection.updateOne(
      { _id: targetSpell._id },
      {
        $set: {
          tier: nextTier as 1 | 2 | 3 | 4 | 5
        }
      }
    );

    return NextResponse.json({
      success: true,
      previousTier: currentTier,
      newTier: nextTier,
      duplicatesConsumed: requirements.duplicates,
      goldSpent: requirements.gold
    });

  } catch (error) {
    console.error('Error upgrading spell:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
