import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';

/**
 * POST /api/challenge/update
 * Update player's challenge mode configuration
 * Body: { config: { forceShield, forceSpeed, damageMultiplier, hpMultiplier } }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    // Get request body
    const body = await request.json();
    const { config } = body;

    if (!config) {
      return NextResponse.json({ error: 'Config required' }, { status: 400 });
    }

    // Validate config structure
    if (
      typeof config.forceShield !== 'boolean' ||
      typeof config.forceSpeed !== 'boolean' ||
      typeof config.damageMultiplier !== 'number' ||
      typeof config.hpMultiplier !== 'number' ||
      typeof config.dotIntensity !== 'number' ||
      typeof config.corruptionRate !== 'number' ||
      typeof config.escapeTimerSpeed !== 'number' ||
      typeof config.buffStrength !== 'number' ||
      typeof config.bossAttackSpeed !== 'number'
    ) {
      return NextResponse.json({ error: 'Invalid config format' }, { status: 400 });
    }

    // Validate multiplier values
    const validDamageMultipliers = [1.0, 1.25, 1.5, 2.0, 3.0];
    const validHpMultipliers = [1.0, 1.5, 2.0, 3.0, 5.0];
    const validDotIntensity = [1.0, 1.5, 2.0, 3.0, 5.0];
    const validCorruptionRate = [0, 0.25, 0.5, 0.75, 1.0];
    const validEscapeTimerSpeed = [1.0, 1.5, 2.0, 3.0, 4.0];
    const validBuffStrength = [1.0, 1.5, 2.0, 3.0, 5.0];
    const validBossAttackSpeed = [1.0, 0.75, 0.5, 0.33, 0.25];

    if (!validDamageMultipliers.includes(config.damageMultiplier)) {
      return NextResponse.json({ error: 'Invalid damage multiplier' }, { status: 400 });
    }

    if (!validHpMultipliers.includes(config.hpMultiplier)) {
      return NextResponse.json({ error: 'Invalid HP multiplier' }, { status: 400 });
    }

    if (!validDotIntensity.includes(config.dotIntensity)) {
      return NextResponse.json({ error: 'Invalid DoT intensity' }, { status: 400 });
    }

    if (!validCorruptionRate.includes(config.corruptionRate)) {
      return NextResponse.json({ error: 'Invalid corruption rate' }, { status: 400 });
    }

    if (!validEscapeTimerSpeed.includes(config.escapeTimerSpeed)) {
      return NextResponse.json({ error: 'Invalid escape timer speed' }, { status: 400 });
    }

    if (!validBuffStrength.includes(config.buffStrength)) {
      return NextResponse.json({ error: 'Invalid buff strength' }, { status: 400 });
    }

    if (!validBossAttackSpeed.includes(config.bossAttackSpeed)) {
      return NextResponse.json({ error: 'Invalid boss attack speed' }, { status: 400 });
    }

    // Connect to MongoDB
    const { playerStatsCollection } = await connectToMongo();

    // Update player's challenge config
    const result = await playerStatsCollection.updateOne(
      { userId },
      { $set: { battleChallengeConfig: config } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    console.log(`🎯 Challenge config updated for user ${userId}:`, config);

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error updating challenge config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
