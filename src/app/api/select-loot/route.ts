import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo, battleSessionsCollection } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { ObjectId } from 'mongodb';

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
    const { sessionId, lootId } = body;

    // Validate input
    if (!sessionId || !lootId) {
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

    // Validate session is defeated
    if (!session.isDefeated) {
      return NextResponse.json(
        { error: 'Battle not yet completed' },
        { status: 400 }
      );
    }

    // Check if loot already selected
    if (session.selectedLootId) {
      return NextResponse.json(
        { error: 'Loot already selected for this session' },
        { status: 400 }
      );
    }

    // Validate lootId is in the available options
    if (!session.lootOptions?.includes(lootId)) {
      return NextResponse.json(
        { error: 'Invalid loot selection' },
        { status: 400 }
      );
    }

    // Save the selected loot
    await battleSessionsCollection.updateOne(
      { _id: sessionObjectId },
      {
        $set: {
          selectedLootId: lootId
        }
      }
    );

    console.log(`✅ User ${userId} selected loot: ${lootId} from session ${sessionId}`);

    // TODO: Create NFT in inventory

    return NextResponse.json({
      success: true,
      selectedLootId: lootId
    });

  } catch (error) {
    console.error('Select loot error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
