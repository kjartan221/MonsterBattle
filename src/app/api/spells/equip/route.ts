import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo } from '@/lib/mongodb';
import { requireSession } from '@/lib/requireSession';
import { getLootItemById } from '@/lib/loot-table';
import { ObjectId } from 'mongodb';

/**
 * POST /api/spells/equip
 * Equips a spell scroll from inventory to the spell slot (Q key)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session instanceof NextResponse) return session;
    const userId = session.userId;

    // Get request body
    const body = await request.json();
    const { inventoryId } = body;

    // Validate input
    if (!inventoryId) {
      return NextResponse.json(
        { error: 'inventoryId is required' },
        { status: 400 }
      );
    }

    // Convert inventoryId to ObjectId
    let inventoryObjectId: ObjectId;
    try {
      inventoryObjectId = new ObjectId(inventoryId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid inventory ID format' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { userInventoryCollection, playerStatsCollection } = await connectToMongo();

    // Verify the item exists in user's inventory
    const inventoryItem = await userInventoryCollection.findOne({
      _id: inventoryObjectId,
      userId
    });

    if (!inventoryItem) {
      return NextResponse.json(
        { error: 'Item not found in inventory' },
        { status: 404 }
      );
    }

    // Verify it's a spell scroll
    const lootItem = getLootItemById(inventoryItem.lootTableId);
    if (!lootItem || lootItem.type !== 'spell_scroll') {
      return NextResponse.json(
        { error: 'Item is not a spell scroll' },
        { status: 400 }
      );
    }

    // Update playerStats with equipped spell
    const updateResult = await playerStatsCollection.updateOne(
      { userId },
      {
        $set: {
          equippedSpell: inventoryObjectId
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Player stats not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Spell equipped successfully',
      spellName: lootItem.name
    });

  } catch (error) {
    console.error('Error equipping spell:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
