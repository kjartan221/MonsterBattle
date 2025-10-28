import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getLootItemById } from '@/lib/loot-table';

/**
 * POST /api/equipment/equip
 * Equips an item from user's inventory to a specific slot
 * Body: { inventoryId: string, slot: 'weapon' | 'armor' | 'accessory1' | 'accessory2' }
 */
export async function POST(request: NextRequest) {
  try {
    // Get cookies using next/headers
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    // Parse request body
    const body = await request.json();
    const { inventoryId, slot } = body;

    if (!inventoryId || !slot) {
      return NextResponse.json({ error: 'Missing inventoryId or slot' }, { status: 400 });
    }

    // Validate slot
    const validSlots = ['weapon', 'armor', 'accessory1', 'accessory2'];
    if (!validSlots.includes(slot)) {
      return NextResponse.json({ error: 'Invalid slot' }, { status: 400 });
    }

    // Connect to MongoDB
    const { playerStatsCollection, userInventoryCollection } = await connectToMongo();

    // Verify the item exists in user's inventory
    let itemObjectId: ObjectId;
    try {
      itemObjectId = new ObjectId(inventoryId);
    } catch {
      return NextResponse.json({ error: 'Invalid inventoryId format' }, { status: 400 });
    }

    const inventoryItem = await userInventoryCollection.findOne({
      _id: itemObjectId,
      userId
    });

    if (!inventoryItem) {
      return NextResponse.json({ error: 'Item not found in inventory' }, { status: 404 });
    }

    // Get the loot item data to validate it can be equipped in this slot
    const lootItem = getLootItemById(inventoryItem.lootTableId);
    if (!lootItem) {
      return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
    }

    // Validate the item can be equipped in the requested slot
    const canEquip = validateItemForSlot(lootItem.type, slot);
    if (!canEquip) {
      return NextResponse.json(
        { error: `Cannot equip ${lootItem.type} in ${slot} slot` },
        { status: 400 }
      );
    }

    // Update player stats with the equipped item
    const updateField = getEquipmentFieldName(slot);
    await playerStatsCollection.updateOne(
      { userId },
      { $set: { [updateField]: itemObjectId } }
    );

    return NextResponse.json({
      success: true,
      slot,
      inventoryId,
      lootTableId: inventoryItem.lootTableId
    });
  } catch (error) {
    console.error('Error equipping item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Validates if an item type can be equipped in a specific slot
 */
function validateItemForSlot(itemType: string, slot: string): boolean {
  switch (slot) {
    case 'weapon':
      return itemType === 'weapon';
    case 'armor':
      return itemType === 'armor';
    case 'accessory1':
    case 'accessory2':
      return itemType === 'artifact'; // Accessories are artifacts
    default:
      return false;
  }
}

/**
 * Maps slot name to database field name
 */
function getEquipmentFieldName(slot: string): string {
  const fieldMap: Record<string, string> = {
    'weapon': 'equippedWeapon',
    'armor': 'equippedArmor',
    'accessory1': 'equippedAccessory1',
    'accessory2': 'equippedAccessory2'
  };
  return fieldMap[slot];
}
