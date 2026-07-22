import { NextRequest, NextResponse } from 'next/server';
import { requireAuthProof } from '@/lib/requireAuthProof';
import { connectToMongo } from '@/lib/mongodb';

/**
 * POST /api/equipment/unequip
 * Unequips an item from a specific slot
 * Body: { slot: 'weapon' | 'armor' | 'accessory1' | 'accessory2' }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body and verify auth proof
    const body = await request.json();
    const auth = await requireAuthProof(request, 'unequip', body.proof);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

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
    await playerStatsCollection.updateOne(
      { userId },
      { $unset: { [`equippedItems.${slot}`]: '' } }
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
