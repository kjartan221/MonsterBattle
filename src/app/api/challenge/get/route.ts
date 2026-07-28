import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo } from '@/lib/mongodb';
import { requireSession } from '@/lib/requireSession';

/**
 * GET /api/challenge/get
 * Get player's current challenge mode configuration
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session instanceof NextResponse) return session;
    const userId = session.userId;

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
