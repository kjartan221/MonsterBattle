import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo, battleSessionsCollection, monstersCollection } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { getRandomLoot } from '@/lib/loot-table';
import { ObjectId } from 'mongodb';

const MAX_CLICKS_PER_SECOND = 15;

export async function POST(request: NextRequest) {
  try {
    // Get and verify JWT token
    const token = request.cookies.get('verified')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    // Get request body
    const body = await request.json();
    const { sessionId, clickCount } = body;

    // Validate input
    if (!sessionId || typeof clickCount !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Convert sessionId string to ObjectId
    let sessionObjectId: ObjectId;
    try {
      sessionObjectId = new ObjectId(sessionId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectToMongo();

    // Get the battle session
    const session = await battleSessionsCollection.findOne({ _id: sessionObjectId, userId });

    if (!session) {
      return NextResponse.json(
        { error: 'Battle session not found' },
        { status: 404 }
      );
    }

    // Check if session is already completed
    if (session.isDefeated || session.completedAt) {
      return NextResponse.json(
        { error: 'Battle session already completed' },
        { status: 400 }
      );
    }

    // Get the monster
    const monster = await monstersCollection.findOne({ _id: session.monsterId });

    if (!monster) {
      return NextResponse.json(
        { error: 'Monster not found' },
        { status: 404 }
      );
    }

    // Calculate time elapsed from server-side session.startedAt
    // This prevents client-side time manipulation
    const currentTime = Date.now();
    const startTime = new Date(session.startedAt).getTime();
    const timeElapsed = currentTime - startTime;
    const timeInSeconds = timeElapsed / 1000;

    // Calculate click rate (clicks per second)
    const clickRate = clickCount / timeInSeconds;

    console.log(`User ${userId} - Click rate: ${clickRate.toFixed(2)} clicks/second (${clickCount} clicks in ${timeInSeconds.toFixed(2)}s)`);

    // CHEAT DETECTION: If clicking too fast
    if (clickRate > MAX_CLICKS_PER_SECOND) {
      console.warn(`⚠️ Cheat detected! User ${userId} exceeded max click rate: ${clickRate.toFixed(2)} clicks/second`);

      // Punish cheater by doubling the required clicks
      const newClicksRequired = monster.clicksRequired * 2;

      await monstersCollection.updateOne(
        { _id: monster._id },
        {
          $set: {
            clicksRequired: newClicksRequired
          }
        }
      );

      // Return cheat detection response
      return NextResponse.json({
        cheatingDetected: true,
        message: 'That was quite fast for a human, are you cheating?',
        newClicksRequired,
        clickRate: clickRate.toFixed(2)
      }, { status: 200 });
    }

    // Validate that clicks are sufficient to defeat monster
    if (clickCount < monster.clicksRequired) {
      return NextResponse.json(
        { error: 'Insufficient clicks to defeat monster' },
        { status: 400 }
      );
    }

    // Generate random loot drops (5 items)
    const lootOptions = getRandomLoot(monster.name, 5);

    console.log(`✅ Monster defeated! User ${userId} defeated ${monster.name} with ${clickCount} clicks in ${timeInSeconds.toFixed(2)}s`);
    console.log(`🎁 Loot generated: ${lootOptions.map(l => l.name).join(', ')}`);

    // Mark session as completed (but don't add loot yet, waiting for user selection)
    const now = new Date();
    await battleSessionsCollection.updateOne(
      { _id: sessionObjectId },
      {
        $set: {
          clickCount,
          isDefeated: true,
          completedAt: now
        }
      }
    );

    return NextResponse.json({
      success: true,
      monster: {
        ...monster,
        _id: monster._id?.toString()
      },
      session: {
        ...session,
        _id: session._id?.toString(),
        monsterId: session.monsterId.toString(),
        clickCount,
        isDefeated: true,
        completedAt: now
      },
      lootOptions, // Send the 5 loot items for user to choose from
      stats: {
        timeElapsed: timeInSeconds.toFixed(2),
        clickRate: clickRate.toFixed(2)
      }
    });

  } catch (error) {
    console.error('Attack monster error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
