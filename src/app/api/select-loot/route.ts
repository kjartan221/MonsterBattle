import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo } from '@/lib/mongodb';
import { requireSession } from '@/lib/requireSession';
import { ObjectId } from 'mongodb';
import { getLootItemById } from '@/lib/loot-table';
import { publicKeyToGradient } from '@/utils/publicKeyToColor';

export async function POST(request: NextRequest) {
  try {
    const authSession = await requireSession();
    if (authSession instanceof NextResponse) return authSession;
    const userId = authSession.userId;

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
    const { battleSessionsCollection, battleHistoryCollection, userInventoryCollection } = await connectToMongo();

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

      await battleHistoryCollection.updateOne(
        { sessionId: sessionObjectId },
        {
          $setOnInsert: {
            userId,
            sessionId: sessionObjectId,
            monsterTemplateName: session.monsterTemplateName,
            createdAt: session.completedAt ? new Date(session.completedAt) : new Date()
          },
          $set: {
            selectedLootId: 'SKIPPED'
          }
        },
        { upsert: true }
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

    // Atomically claim the loot selection; only the first request proceeds to insert.
    const claim = await battleSessionsCollection.findOneAndUpdate(
      { _id: sessionObjectId, userId, isDefeated: true, selectedLootId: { $exists: false } },
      { $set: { selectedLootId: lootId } },
      { returnDocument: 'after' }
    );
    if (!claim) {
      return NextResponse.json(
        { error: 'Loot already selected for this battle' },
        { status: 409 }
      );
    }

    await battleHistoryCollection.updateOne(
      { sessionId: sessionObjectId },
      {
        $setOnInsert: {
          userId,
          sessionId: sessionObjectId,
          monsterTemplateName: session.monsterTemplateName,
          createdAt: session.completedAt ? new Date(session.completedAt) : new Date()
        },
        $set: {
          selectedLootId: lootId
        }
      },
      { upsert: true }
    );

    console.log(`✅ User ${userId} selected loot: ${lootId} from session ${sessionId}`);

    const isEmpowered = session.monster?.isCorrupted === true;

    // Generate unique gradient colors from user's public key (userId)
    // The userId IS the public key in BSV
    const { color1, color2 } = publicKeyToGradient(userId);

    // Determine item tier based on type
    // ONLY spell scrolls are locked to Tier 1 (must be upgraded with duplicates)
    // All other items (equipment, materials, consumables) scale with zone tier
    const itemTier = lootItem.type === 'spell_scroll' ? 1 : session.tier;

    // Add item to user's inventory WITHOUT creating NFT yet
    // User will decide later if they want to mint it as an NFT (and pay for it)
    const inventoryResult = await userInventoryCollection.insertOne({
      userId,
      lootTableId: lootItem.lootId, // Reference to loot-table template
      itemType: lootItem.type,
      nftLootId: undefined, // Will be set when user mints the NFT
      tier: itemTier, // Spell scrolls always Tier 1, everything else scales with zone tier
      borderGradient: { color1, color2 }, // Store gradient here
      acquiredAt: new Date(),
      fromSessionId: sessionObjectId,
      isEmpowered, // Mark item as empowered if dropped by corrupted monster (+20% stats)
    });

    const tierInfo = lootItem.type === 'spell_scroll'
      ? ' (Tier 1 - requires upgrade)'
      : itemTier > 1
        ? ` (Tier ${itemTier})`
        : '';
    console.log(`📦 Added ${isEmpowered ? '⚡ EMPOWERED' : ''} ${lootItem.name}${tierInfo} to ${userId}'s inventory (not minted yet)`);

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
