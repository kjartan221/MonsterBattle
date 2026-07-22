import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { buildDefeatStatMutation } from '@/lib/battleOutcome';
import { getStreakForZone } from '@/utils/streakHelpers';
import { ObjectId } from 'mongodb';

/**
 * API Route: End Battle (Player Death or Monster Escape)
 * Server-authoritative penalty (10% gold loss) + per-zone streak reset, applied
 * atomically.
 *
 * `outcome` is optional and defaults to 'defeated' so the existing client
 * (which posts only { sessionId }) keeps working; both outcomes apply the same
 * penalty and differ only in the recorded battle-history label.
 */
export async function POST(request: NextRequest) {
  try {
    const token = (await cookies()).get('verified')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userId: string;
    try {
      userId = (await verifyJWT(token)).userId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { sessionId, outcome = 'defeated' } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    if (outcome !== 'defeated' && outcome !== 'escaped') {
      return NextResponse.json(
        { error: "outcome, if provided, must be 'defeated' or 'escaped'" },
        { status: 400 }
      );
    }

    let sessionObjectId: ObjectId;
    try {
      sessionObjectId = new ObjectId(sessionId);
    } catch {
      return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 });
    }

    const { battleSessionsCollection, battleHistoryCollection, playerStatsCollection } = await connectToMongo();
    const now = new Date();

    // Atomic claim: idempotent close, no double penalty on retry.
    // mongodb@6 returns the matched doc directly (no `{ value }` wrapper).
    const session = await battleSessionsCollection.findOneAndUpdate(
      { _id: sessionObjectId, userId, isDefeated: false, completedAt: { $exists: false }, completionClaimedAt: { $exists: false } },
      { $set: { isDefeated: true, completedAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) } },
      { returnDocument: 'before' }
    );

    if (!session) {
      // Null = already closed (retry) or not ours: 404 only if it truly doesn't exist.
      const existing = await battleSessionsCollection.findOne({ _id: sessionObjectId, userId });
      if (!existing) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, goldLost: 0, streakLost: 0, alreadyClosed: true });
    }

    await battleHistoryCollection.updateOne(
      { sessionId: sessionObjectId },
      {
        $setOnInsert: {
          userId,
          sessionId: sessionObjectId,
          monsterTemplateName: session.monsterTemplateName,
          createdAt: session.startedAt ? new Date(session.startedAt) : now,
        },
        $set: {
          completedAt: now,
          selectedLootId: outcome === 'escaped' ? 'ESCAPED' : 'DEFEATED',
        },
      },
      { upsert: true }
    );

    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      return NextResponse.json({ error: 'Player stats not found' }, { status: 404 });
    }

    const streakLost = getStreakForZone(playerStats.stats.battlesWonStreaks, session.biome, session.tier);
    const { goldLost, update } = buildDefeatStatMutation({
      coins: playerStats.coins,
      stats: { battlesWonStreaks: playerStats.stats.battlesWonStreaks },
      biome: session.biome,
      tier: session.tier,
    });

    await playerStatsCollection.updateOne({ userId }, update);

    return NextResponse.json({ success: true, goldLost, streakLost });
  } catch (error) {
    console.error('End battle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
