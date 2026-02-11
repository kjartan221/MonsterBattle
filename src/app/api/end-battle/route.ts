import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { ObjectId } from 'mongodb';

/**
 * API Route: End Battle (Player Death)
 * Called when player HP reaches 0 during battle
 * Marks the session as defeated with no loot rewards
 */
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

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { battleSessionsCollection, battleHistoryCollection } = await connectToMongo();

    // Convert sessionId to ObjectId
    let sessionObjectId: ObjectId;
    try {
      sessionObjectId = new ObjectId(sessionId);
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid sessionId format' },
        { status: 400 }
      );
    }

    // Verify session belongs to user
    const session = await battleSessionsCollection.findOne({
      _id: sessionObjectId,
      userId
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Mark session as defeated (player died, no loot awarded)
    const now = new Date();

    const expiresAt = session.expiresAt
      ? new Date(session.expiresAt)
      : new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await battleSessionsCollection.updateOne(
      { _id: sessionObjectId },
      {
        $set: {
          isDefeated: true,
          completedAt: now,
          expiresAt,
          // No lootOptions or selectedLootId - player gets nothing
        }
      }
    );

    await battleHistoryCollection.updateOne(
      { sessionId: sessionObjectId },
      {
        $setOnInsert: {
          userId,
          sessionId: sessionObjectId,
          monsterTemplateName: session.monsterTemplateName,
          createdAt: session.startedAt ? new Date(session.startedAt) : now
        },
        $set: {
          completedAt: now,
          selectedLootId: 'DEFEATED'
        }
      },
      { upsert: true }
    );

    console.log(`Player ${userId} was defeated in session ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'Battle session ended (player defeated)'
    });

  } catch (error) {
    console.error('End battle error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
