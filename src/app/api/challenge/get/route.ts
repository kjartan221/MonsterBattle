import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';

/**
 * GET /api/challenge/get
 * Get player's current challenge mode configuration
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    // Connect to MongoDB
    const { playerStatsCollection } = await connectToMongo();

    // Fetch player stats
    const playerStats = await playerStatsCollection.findOne({ userId });

    if (!playerStats) {
      return NextResponse.json({ error: 'Player stats not found' }, { status: 404 });
    }

    // Default config values
    const defaultConfig = {
      forceShield: false,
      forceSpeed: false,
      damageMultiplier: 1.0,
      hpMultiplier: 1.0,
      dotIntensity: 1.0,
      corruptionRate: 0,
      escapeTimerSpeed: 1.0,
      buffStrength: 1.0,
      bossAttackSpeed: 1.0,
      bossSpawnRate: 1.0,
      skillshotCircles: 0,
      skillshotSpeed: 1.0
    };

    // Merge stored config with defaults (handles legacy configs missing new fields)
    const config = {
      ...defaultConfig,
      ...(playerStats.battleChallengeConfig || {})
    };

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error fetching challenge config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
