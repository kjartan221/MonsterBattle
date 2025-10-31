import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';

/**
 * POST /api/consumables/unequip
 * Unequips a consumable from a hotbar slot
 * Body: { slotIndex: number (0-2) }
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
    const { slotIndex } = body;

    // Validate input
    if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex > 2) {
      return NextResponse.json({ error: 'Invalid slot index' }, { status: 400 });
    }

    const { playerStatsCollection } = await connectToMongo();

    // Get player stats
    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      return NextResponse.json({ error: 'Player stats not found' }, { status: 404 });
    }

    // Initialize equippedConsumables if it doesn't exist
    const equippedConsumables = playerStats.equippedConsumables || ['empty', 'empty', 'empty'] as ['empty', 'empty', 'empty'];

    // Unequip from slot
    equippedConsumables[slotIndex] = 'empty';

    // Update player stats
    await playerStatsCollection.updateOne(
      { userId },
      { $set: { equippedConsumables } }
    );

    return NextResponse.json({ success: true, slotIndex });
  } catch (error) {
    console.error('Error unequipping consumable:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
