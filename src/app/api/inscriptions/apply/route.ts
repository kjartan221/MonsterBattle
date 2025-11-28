import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { ObjectId } from 'mongodb';
import { getLootItemById } from '@/lib/loot-table';
import { Inscription } from '@/lib/types';

/**
 * POST /api/inscriptions/apply
 *
 * Apply an inscription scroll to equipment (weapon, armor, artifact)
 *
 * Request Body:
 * - equipmentId: string (UserInventory._id)
 * - scrollId: string (UserInventory._id)
 * - overwriteExisting: boolean (optional, default: false)
 *
 * Response:
 * - success: boolean
 * - message: string
 * - equipment: Updated equipment object
 * - overwriteWarning?: { slot: 'prefix' | 'suffix', existingInscription: Inscription }
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

    // Parse request body
    const body = await request.json();
    const { equipmentId, scrollId, overwriteExisting = false } = body;

    if (!equipmentId || !scrollId) {
      return NextResponse.json(
        { error: 'Missing equipmentId or scrollId' },
        { status: 400 }
      );
    }

    // Validate ObjectIds
    let equipmentObjectId: ObjectId;
    let scrollObjectId: ObjectId;

    try {
      equipmentObjectId = new ObjectId(equipmentId);
      scrollObjectId = new ObjectId(scrollId);
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid equipment or scroll ID format' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { userInventoryCollection, playerStatsCollection } = await connectToMongo();

    // Fetch player stats to check gold
    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      return NextResponse.json(
        { error: 'Player stats not found' },
        { status: 404 }
      );
    }

    // Fetch equipment item
    const equipmentItem = await userInventoryCollection.findOne({
      _id: equipmentObjectId,
      userId
    });

    if (!equipmentItem) {
      return NextResponse.json(
        { error: 'Equipment not found or you do not own it' },
        { status: 404 }
      );
    }

    // Validate equipment is inscribable (weapon, armor, artifact)
    if (!['weapon', 'armor', 'artifact'].includes(equipmentItem.itemType)) {
      return NextResponse.json(
        { error: 'Only weapons, armor, and artifacts can be inscribed' },
        { status: 400 }
      );
    }

    // Fetch scroll item
    const scrollItem = await userInventoryCollection.findOne({
      _id: scrollObjectId,
      userId
    });

    if (!scrollItem) {
      return NextResponse.json(
        { error: 'Inscription scroll not found or you do not own it' },
        { status: 404 }
      );
    }

    // Validate scroll is an inscription_scroll
    if (scrollItem.itemType !== 'inscription_scroll') {
      return NextResponse.json(
        { error: 'Selected item is not an inscription scroll' },
        { status: 400 }
      );
    }

    // Get inscription data from loot table
    const scrollTemplate = getLootItemById(scrollItem.lootTableId);
    if (!scrollTemplate || !scrollTemplate.inscriptionData) {
      return NextResponse.json(
        { error: 'Invalid inscription scroll data' },
        { status: 500 }
      );
    }

    const inscriptionData = scrollTemplate.inscriptionData;
    const slot = inscriptionData.slot; // 'prefix' or 'suffix'

    // Calculate gold cost based on scroll rarity
    const goldCosts: Record<string, number> = {
      common: 250,
      rare: 1000,
      epic: 2500,
      legendary: 5000
    };
    const goldCost = goldCosts[scrollTemplate.rarity] || 250;

    // Check if player has enough gold
    if (playerStats.coins < goldCost) {
      return NextResponse.json(
        {
          error: `Insufficient gold. Need ${goldCost} gold to apply this inscription.`,
          goldCost,
          currentGold: playerStats.coins
        },
        { status: 400 }
      );
    }

    // Check if slot is already occupied
    const existingInscription = equipmentItem[slot] as Inscription | undefined;
    if (existingInscription && !overwriteExisting) {
      // Warn user that slot is occupied
      return NextResponse.json(
        {
          overwriteWarning: {
            slot,
            existingInscription
          },
          message: `This equipment already has a ${slot} inscription: "${existingInscription.name}". Set overwriteExisting=true to replace it.`
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Create inscription object
    const inscription: Inscription = {
      type: inscriptionData.inscriptionType,
      value: inscriptionData.statValue,
      name: inscriptionData.name
    };

    // Apply inscription to equipment
    const updateResult = await userInventoryCollection.updateOne(
      { _id: equipmentObjectId },
      { $set: { [slot]: inscription } }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to update equipment' },
        { status: 500 }
      );
    }

    // Deduct gold cost from player
    await playerStatsCollection.updateOne(
      { userId },
      { $inc: { coins: -goldCost } }
    );

    // Delete consumed scroll from inventory
    await userInventoryCollection.deleteOne({ _id: scrollObjectId });

    // Fetch updated equipment
    const updatedEquipment = await userInventoryCollection.findOne({
      _id: equipmentObjectId
    });

    console.log(`✅ [INSCRIPTION] User ${userId} applied "${inscription.name}" ${slot} to equipment ${equipmentId} for ${goldCost} gold`);

    return NextResponse.json({
      success: true,
      message: `Successfully applied "${inscription.name}" ${slot} inscription (-${goldCost} gold)`,
      goldCost,
      equipment: {
        ...updatedEquipment,
        _id: updatedEquipment?._id?.toString()
      }
    });

  } catch (error) {
    console.error('Apply inscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
