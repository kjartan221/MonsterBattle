import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { getRandomMonsterTemplateForBiome, getRandomClicksRequired, getScaledAttackDamage } from '@/lib/monster-table';
import { BiomeId, Tier, formatBiomeTierKey, isBiomeTierAvailable } from '@/lib/biome-config';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
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
    const userId = payload.userId;

    // Get biome/tier from request body (optional)
    const body = await request.json().catch(() => ({}));
    let requestedBiome = body.biome as BiomeId | undefined;
    let requestedTier = body.tier as Tier | undefined;

    // Connect to MongoDB and get collections
    const { battleSessionsCollection, monstersCollection, playerStatsCollection } = await connectToMongo();

    // Check if user already has an active battle session
    const activeSession = await battleSessionsCollection.findOne({
      userId,
      isDefeated: false,
      completedAt: { $exists: false }
    });

    if (activeSession) {
      // Return existing active session with monster details
      const monster = await monstersCollection.findOne({
        _id: activeSession.monsterId
      });

      return NextResponse.json({
        session: {
          ...activeSession,
          _id: activeSession._id?.toString(),
          monsterId: activeSession.monsterId.toString()
        },
        monster: monster ? {
          ...monster,
          _id: monster._id?.toString()
        } : null,
        isNewSession: false
      });
    }

    // No active session found - need to create new battle
    // Get player stats to determine biome/tier
    const playerStats = await playerStatsCollection.findOne({ userId });

    if (!playerStats) {
      return NextResponse.json(
        { error: 'Player stats not found. Please refresh the page.' },
        { status: 404 }
      );
    }

    // Determine which biome/tier to use
    let biome: BiomeId;
    let tier: Tier;

    if (requestedBiome && requestedTier) {
      // Validate requested biome/tier is unlocked
      const biomeTierKey = formatBiomeTierKey(requestedBiome, requestedTier);
      if (!playerStats.unlockedZones.includes(biomeTierKey)) {
        return NextResponse.json(
          { error: `Biome/tier ${biomeTierKey} is not unlocked yet` },
          { status: 403 }
        );
      }

      // Validate biome/tier is implemented
      if (!isBiomeTierAvailable(requestedBiome, requestedTier)) {
        return NextResponse.json(
          { error: `Biome/tier ${biomeTierKey} is not available yet` },
          { status: 400 }
        );
      }

      biome = requestedBiome;
      tier = requestedTier;
    } else {
      // Default to first unlocked zone (should be forest-1 for new players)
      const firstUnlocked = playerStats.unlockedZones[0] || 'forest-1';
      const parts = firstUnlocked.split('-');
      biome = parts[0] as BiomeId;
      tier = parseInt(parts[1], 10) as Tier;
    }

    // Create monster for this biome/tier
    const monsterTemplate = getRandomMonsterTemplateForBiome(biome);
    const clicksRequired = getRandomClicksRequired(monsterTemplate.baseClicksRange, tier);
    const attackDamage = getScaledAttackDamage(monsterTemplate.baseAttackDamage, tier);

    const newMonster = {
      name: monsterTemplate.name,
      imageUrl: monsterTemplate.imageUrl,
      clicksRequired,
      attackDamage,
      rarity: monsterTemplate.rarity,
      biome,
      tier,
      dotEffect: monsterTemplate.dotEffect, // Pass DoT effect to frontend
      createdAt: new Date()
    };

    const monsterResult = await monstersCollection.insertOne(newMonster);
    const monsterId = monsterResult.insertedId;

    // Create new battle session with biome/tier tracking
    const newSession = {
      userId,
      monsterId,
      biome,
      tier,
      clickCount: 0,
      isDefeated: false,
      usedItems: [], // Initialize empty array for tracking used items
      startedAt: new Date()
    };

    const sessionResult = await battleSessionsCollection.insertOne(newSession);

    console.log(`New battle session created for user ${userId} in ${biome} T${tier}: ${sessionResult.insertedId.toString()}`);

    return NextResponse.json({
      session: {
        ...newSession,
        _id: sessionResult.insertedId.toString(),
        monsterId: monsterId.toString()
      },
      monster: {
        ...newMonster,
        _id: monsterId.toString()
      },
      isNewSession: true
    });

  } catch (error) {
    console.error('Start battle error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
