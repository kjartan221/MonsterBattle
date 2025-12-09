import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getLootItemById } from '@/lib/loot-table';

/**
 * POST /api/consumables/equip
 * Equips a consumable item to a hotbar slot
 * Body: { inventoryId: string, slotIndex: number (0-3) }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    const body = await request.json();
    const { inventoryId, slotIndex } = body;

    // Validate input
    if (!inventoryId || typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex > 3) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    const { userInventoryCollection, playerStatsCollection } = await connectToMongo();

    // Verify user owns the item
    const inventoryItem = await userInventoryCollection.findOne({
      _id: new ObjectId(inventoryId),
      userId
    });

    if (!inventoryItem) {
      return NextResponse.json({ error: 'Item not found in inventory' }, { status: 404 });
    }

    // Verify item is a consumable
    const lootItem = getLootItemById(inventoryItem.lootTableId);
    if (!lootItem || lootItem.type !== 'consumable') {
      return NextResponse.json({ error: 'Item is not a consumable' }, { status: 400 });
    }

    // Get player stats
    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      return NextResponse.json({ error: 'Player stats not found' }, { status: 404 });
    }

    // Initialize equippedConsumables if it doesn't exist
    const equippedConsumables = playerStats.equippedConsumables || ['empty', 'empty', 'empty', 'empty'] as ['empty', 'empty', 'empty', 'empty'];

    // Check if this item is already equipped in any slot (prevent duplicates)
    const inventoryIdObj = new ObjectId(inventoryId);
    const alreadyEquippedIndex = equippedConsumables.findIndex(
      (id) => id !== 'empty' && id.toString() === inventoryIdObj.toString()
    );

    if (alreadyEquippedIndex !== -1) {
      // If already equipped in the same slot, do nothing
      if (alreadyEquippedIndex === slotIndex) {
        return NextResponse.json({
          success: true,
          slotIndex,
          message: 'Item already equipped in this slot'
        });
      }

      // If equipped in a different slot, unequip from old slot first
      equippedConsumables[alreadyEquippedIndex] = 'empty';
    }

    // Equip to slot
    equippedConsumables[slotIndex] = inventoryIdObj;

    // Update player stats
    await playerStatsCollection.updateOne(
      { userId },
      { $set: { equippedConsumables } }
    );

    return NextResponse.json({ success: true, slotIndex });
  } catch (error) {
    console.error('Error equipping consumable:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
