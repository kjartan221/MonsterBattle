import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo, battleSessionsCollection, userInventoryCollection, nftLootCollection } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { ObjectId } from 'mongodb';
import { getLootItemById } from '@/lib/loot-table';

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

    // Create NFTLoot document in database
    const nftLootDocument = {
      lootTableId: lootItem.lootId,
      name: lootItem.name,
      description: lootItem.description,
      icon: lootItem.icon,
      rarity: lootItem.rarity,
      type: lootItem.type,
      createdAt: new Date(),
      // mintTransactionId will be added when NFT is minted to blockchain
    };

    const nftResult = await nftLootCollection.insertOne(nftLootDocument);
    const nftLootId = nftResult.insertedId;

    console.log(`🎁 Created NFTLoot document: ${nftLootId} (${lootItem.name})`);

    // Add item to user's inventory (referencing the NFTLoot document)
    await userInventoryCollection.insertOne({
      userId,
      lootId: nftLootId,
      acquiredAt: new Date(),
      fromMonsterId: session.monsterId,
      fromSessionId: sessionObjectId,
    });

    console.log(`📦 Added ${lootItem.name} to ${userId}'s inventory`);

    // TODO: Mint NFT to blockchain and update mintTransactionId in nftLootCollection

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
