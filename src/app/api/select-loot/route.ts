import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { ObjectId } from 'mongodb';
import { getLootItemById } from '@/lib/loot-table';
import { publicKeyToGradient } from '@/utils/publicKeyToColor';

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

    // Get request body
    const body = await request.json();
    const { sessionId, lootId } = body;

    // Validate input
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Check if user is skipping loot selection
    const isSkipping = lootId === 'SKIPPED' || lootId === null;

    if (!lootId && !isSkipping) {
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

    // Connect to MongoDB and get collections
    const { battleSessionsCollection, userInventoryCollection } = await connectToMongo();

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

    // Handle skip case
    if (isSkipping) {
      // Just mark the session as skipped, don't add to inventory
      await battleSessionsCollection.updateOne(
        { _id: sessionObjectId },
        {
          $set: {
            selectedLootId: 'SKIPPED'
          }
        }
      );

      console.log(`⏭️ User ${userId} skipped loot selection for session ${sessionId}`);

      return NextResponse.json({
        success: true,
        selectedLootId: 'SKIPPED',
        skipped: true
      });
    }

    // Validate lootId is in the available options
    if (!session.lootOptions?.includes(lootId)) {
      return NextResponse.json(
        { error: 'Invalid loot selection' },
        { status: 400 }
      );
    }

    // Get the loot item details from loot-table
    const lootItem = getLootItemById(lootId);
    if (!lootItem) {
      return NextResponse.json(
        { error: 'Loot item not found in loot table' },
        { status: 404 }
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

    // Generate unique gradient colors from user's public key (userId)
    // The userId IS the public key in BSV
    const { color1, color2 } = publicKeyToGradient(userId);

    // Add item to user's inventory WITHOUT creating NFT yet
    // User will decide later if they want to mint it as an NFT (and pay for it)
    const inventoryResult = await userInventoryCollection.insertOne({
      userId,
      lootTableId: lootItem.lootId, // Reference to loot-table template
      itemType: lootItem.type,
      nftLootId: undefined, // Will be set when user mints the NFT
      tier: session.tier, // Track which tier this item dropped from
      borderGradient: { color1, color2 }, // Store gradient here
      acquiredAt: new Date(),
      fromMonsterId: session.monsterId,
      fromSessionId: sessionObjectId,
    });

    console.log(`📦 Added ${lootItem.name} to ${userId}'s inventory (not minted yet)`);

    return NextResponse.json({
      success: true,
      selectedLootId: lootId,
      inventoryItemId: inventoryResult.insertedId.toString()
    });

  } catch (error) {
    console.error('Select loot error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
