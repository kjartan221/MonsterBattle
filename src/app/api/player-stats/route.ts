import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo, playerStatsCollection } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';

/**
 * Get or initialize player stats
 * Creates default stats if player doesn't have them yet
 */
export async function GET(request: NextRequest) {
  try {
    // Get cookies using next/headers
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId as string;

    // Connect to MongoDB
    await connectToMongo();

    // Try to find existing stats
    let playerStats = await playerStatsCollection.findOne({ userId });

    // If no stats exist, create default stats
    if (!playerStats) {
      const defaultStats = {
        userId,
        level: 1,
        experience: 0,
        coins: 0,
        maxHealth: 100,
        currentHealth: 100,

        // Equipment slots (empty initially)
        equippedWeapon: undefined,
        equippedArmor: undefined,
        equippedAccessory1: undefined,
        equippedAccessory2: undefined,
        equippedConsumables: [],

        // Battle stats
        baseDamage: 1,
        critChance: 5,
        attackSpeed: 1.0,

        // Progress
        currentZone: 0, // 0 = Forest (Tier 1)
        currentTier: 1,
        unlockedZones: ['forest-1'], // Start with Forest Tier 1 unlocked

        // Statistics
        stats: {
          battlesWon: 0,
          battlesWonStreak: 0,
          monstersDefeated: 0,
          bossesDefeated: 0,
          totalDamageDealt: 0,
          itemsCollected: 0,
          legendariesFound: 0,
        },

        createdAt: new Date(),
      };

      const result = await playerStatsCollection.insertOne(defaultStats);
      console.log(`✅ Created player stats for user ${userId}`);

      // Fetch the newly created stats
      playerStats = await playerStatsCollection.findOne({ _id: result.insertedId });
    }

    // Safety check (should never happen)
    if (!playerStats) {
      return NextResponse.json(
        { error: 'Failed to create or retrieve player stats' },
        { status: 500 }
      );
    }

    // Convert ObjectId to string for frontend
    const statsForFrontend = {
      ...playerStats,
      _id: playerStats._id?.toString(),
      equippedWeapon: playerStats.equippedWeapon?.toString(),
      equippedArmor: playerStats.equippedArmor?.toString(),
      equippedAccessory1: playerStats.equippedAccessory1?.toString(),
      equippedAccessory2: playerStats.equippedAccessory2?.toString(),
      equippedConsumables: playerStats.equippedConsumables?.map(id => id.toString()) || [],
    };

    return NextResponse.json({
      success: true,
      playerStats: statsForFrontend,
    });

  } catch (error) {
    console.error('Get player stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get player stats' },
      { status: 500 }
    );
  }
}

/**
 * Update player stats (HP, XP, coins, etc.)
 */
export async function PATCH(request: NextRequest) {
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
    const userId = payload.userId as string;

    // Get update data from request
    const body = await request.json();
    const { updates } = body;

    if (!updates) {
      return NextResponse.json(
        { error: 'Updates object is required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectToMongo();

    // Update player stats
    const result = await playerStatsCollection.updateOne(
      { userId },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Player stats not found' },
        { status: 404 }
      );
    }

    // Fetch updated stats
    const updatedStats = await playerStatsCollection.findOne({ userId });

    return NextResponse.json({
      success: true,
      playerStats: {
        ...updatedStats,
        _id: updatedStats?._id?.toString(),
      },
    });

  } catch (error) {
    console.error('Update player stats error:', error);
    return NextResponse.json(
      { error: 'Failed to update player stats' },
      { status: 500 }
    );
  }
}
