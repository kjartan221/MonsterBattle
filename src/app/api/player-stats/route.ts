import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
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
    const { playerStatsCollection } = await connectToMongo();

    // Try to find existing stats
    let playerStats = await playerStatsCollection.findOne({ userId });

    // Migrate legacy data: ensure equippedConsumables is always ['empty', 'empty', 'empty'] format
    if (playerStats && (!playerStats.equippedConsumables || !Array.isArray(playerStats.equippedConsumables) || playerStats.equippedConsumables.length !== 3)) {
      await playerStatsCollection.updateOne(
        { userId },
        { $set: { equippedConsumables: ['empty', 'empty', 'empty'] as ['empty', 'empty', 'empty'] } }
      );
      playerStats.equippedConsumables = ['empty', 'empty', 'empty'] as ['empty', 'empty', 'empty'];
    }

    // Migrate legacy equipment: convert old separate fields to new equippedItems object
    const hasLegacyFields = playerStats && (
      playerStats.equippedWeapon !== undefined ||
      playerStats.equippedArmor !== undefined ||
      playerStats.equippedAccessory1 !== undefined ||
      playerStats.equippedAccessory2 !== undefined
    );

    if (hasLegacyFields && playerStats) {
      // Build new equippedItems object if it doesn't exist
      if (!playerStats.equippedItems) {
        const equippedItems: any = {};
        if (playerStats.equippedWeapon) equippedItems.weapon = playerStats.equippedWeapon;
        if (playerStats.equippedArmor) equippedItems.armor = playerStats.equippedArmor;
        if (playerStats.equippedAccessory1) equippedItems.accessory1 = playerStats.equippedAccessory1;
        if (playerStats.equippedAccessory2) equippedItems.accessory2 = playerStats.equippedAccessory2;

        await playerStatsCollection.updateOne(
          { userId },
          { $set: { equippedItems } }
        );
      }

      // Always remove legacy fields if they exist
      await playerStatsCollection.updateOne(
        { userId },
        { $unset: { equippedWeapon: 1, equippedArmor: 1, equippedAccessory1: 1, equippedAccessory2: 1 } }
      );

      // Refetch to get the updated document without old fields
      playerStats = await playerStatsCollection.findOne({ userId });

      if (!playerStats) {
        return NextResponse.json(
          { error: 'Failed to refetch player stats after migration' },
          { status: 500 }
        );
      }
    }

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
        equippedItems: {},
        equippedConsumables: ['empty', 'empty', 'empty'] as ['empty', 'empty', 'empty'],

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
    const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2, ...cleanedStats } = playerStats;

    const statsForFrontend = {
      ...cleanedStats,
      _id: playerStats._id?.toString(),
      equippedItems: playerStats.equippedItems ? {
        weapon: playerStats.equippedItems.weapon?.toString(),
        armor: playerStats.equippedItems.armor?.toString(),
        accessory1: playerStats.equippedItems.accessory1?.toString(),
        accessory2: playerStats.equippedItems.accessory2?.toString(),
      } : {},
      equippedConsumables: (playerStats.equippedConsumables && playerStats.equippedConsumables.length === 3)
        ? playerStats.equippedConsumables.map(id => id === 'empty' ? 'empty' : id.toString())
        : ['empty', 'empty', 'empty'],
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
    const { playerStatsCollection } = await connectToMongo();

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
