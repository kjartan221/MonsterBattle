import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * POST /api/start-battle-timer
 * Updates the actualBattleStartedAt timestamp when user clicks "Start Battle"
 * This is used for accurate HP verification (excludes time spent looking at start screen)
 */
export async function POST(request: NextRequest) {
  try {
    // Get cookies and verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    // Parse request body
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // Convert sessionId to ObjectId
    let sessionObjectId: ObjectId;
    try {
      sessionObjectId = new ObjectId(sessionId);
    } catch {
      return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 });
    }

    // Connect to MongoDB
    const { battleSessionsCollection } = await connectToMongo();

    // Find the session and verify it belongs to this user
    const session = await battleSessionsCollection.findOne({
      _id: sessionObjectId,
      userId
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update the actualBattleStartedAt timestamp
    const actualBattleStartedAt = new Date();
    await battleSessionsCollection.updateOne(
      { _id: sessionObjectId },
      { $set: { actualBattleStartedAt } }
    );

    return NextResponse.json({ success: true, actualBattleStartedAt });
  } catch (error) {
    console.error('Error starting battle timer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
