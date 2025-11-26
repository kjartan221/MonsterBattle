import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';

/**
 * POST /api/spells/unequip
 * Unequips the spell scroll from the spell slot (Q key)
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

    // Connect to MongoDB
    const { playerStatsCollection } = await connectToMongo();

    // Update playerStats to remove equipped spell
    const updateResult = await playerStatsCollection.updateOne(
      { userId },
      {
        $set: {
          equippedSpell: 'empty'
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
      message: 'Spell unequipped successfully'
    });

  } catch (error) {
    console.error('Error unequipping spell:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
