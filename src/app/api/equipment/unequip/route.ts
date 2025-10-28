import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';

/**
 * POST /api/equipment/unequip
 * Unequips an item from a specific slot
 * Body: { slot: 'weapon' | 'armor' | 'accessory1' | 'accessory2' }
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
    const { slot } = body;

    if (!slot) {
      return NextResponse.json({ error: 'Missing slot' }, { status: 400 });
    }

    // Validate slot
    const validSlots = ['weapon', 'armor', 'accessory1', 'accessory2'];
    if (!validSlots.includes(slot)) {
      return NextResponse.json({ error: 'Invalid slot' }, { status: 400 });
    }

    // Connect to MongoDB
    const { playerStatsCollection } = await connectToMongo();

    // Unset the equipped item field
    const updateField = getEquipmentFieldName(slot);
    await playerStatsCollection.updateOne(
      { userId },
      { $unset: { [updateField]: '' } }
    );

    return NextResponse.json({
      success: true,
      slot
    });
  } catch (error) {
    console.error('Error unequipping item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
