import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyJWT } from '@/utils/jwt';

/**
 * POST /api/equipment/update
 *
 * Handles database updates after updating equipment with inscription scroll
 * - Creates new NFTLoot document for updated equipment (same structure as mint)
 * - Creates new UserInventory entry with updated prefix/suffix
 * - Marks original equipment as consumed
 * - Marks inscription scroll as consumed
 *
 * NOTE: Uses same metadata structure as useMintItemNFT - only prefix/suffix change.
 * Blockchain transaction history provides immutable provenance and timestamps.
 *
 * Request body:
 * - originalEquipmentInventoryId: string (UserInventory document ID of original equipment)
 * - originalEquipmentTokenId: string (blockchain token ID of original equipment)
 * - inscriptionScrollInventoryId: string (UserInventory document ID of scroll)
 * - inscriptionScrollTokenId: string (blockchain token ID of scroll)
 * - transactionId: string (BSV transaction ID)
 * - tokenId: string (new blockchain token ID in format "txid.vout")
 * - metadata: object (updated equipment metadata with enhancements.prefix/suffix)
 *
 * Response:
 * - success: boolean
 * - nftId: string (new NFTLoot document ID)
 * - newInventoryItemId: string (new UserInventory document ID)
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
    const {
      originalEquipmentInventoryId,
      originalEquipmentTokenId,
      inscriptionScrollInventoryId,
      inscriptionScrollTokenId,
      transactionId,
      tokenId,
      metadata,
    } = body;

    // Validate required fields
    if (!originalEquipmentInventoryId || !inscriptionScrollInventoryId || !transactionId || !tokenId || !metadata) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB and get collections
    const { nftLootCollection, userInventoryCollection } = await connectToMongo();

    // Verify user owns both the equipment and scroll
    const originalEquipment = await userInventoryCollection.findOne({
      _id: new ObjectId(originalEquipmentInventoryId),
      userId: userId,
    });

    if (!originalEquipment) {
      return NextResponse.json(
        { error: 'Original equipment not found or not owned by user' },
        { status: 404 }
      );
    }

    const inscriptionScroll = await userInventoryCollection.findOne({
      _id: new ObjectId(inscriptionScrollInventoryId),
      userId: userId,
    });

    if (!inscriptionScroll) {
      return NextResponse.json(
        { error: 'Inscription scroll not found or not owned by user' },
        { status: 404 }
      );
    }

    // Create new NFTLoot document for updated equipment
    // Uses same structure as mint - blockchain transaction history provides provenance
    const updatedEquipmentDoc = {
      lootTableId: originalEquipment.lootTableId,
      name: metadata.itemName,
      description: metadata.description,
      icon: metadata.icon,
      rarity: metadata.rarity,
      type: metadata.itemType,
      attributes: {
        ...metadata,
        borderGradient: originalEquipment.borderGradient,
      },
      mintTransactionId: transactionId,
      tokenId: tokenId,
      userId: userId,
      createdAt: new Date(),
    };

    const nftResult = await nftLootCollection.insertOne(updatedEquipmentDoc);
    const nftId = nftResult.insertedId.toString();

    // Create new UserInventory entry for updated equipment
    // prefix/suffix come directly from metadata.enhancements (already updated in hook)
    const newInventoryEntry = {
      userId: userId,
      lootTableId: originalEquipment.lootTableId,
      itemType: originalEquipment.itemType,
      nftLootId: nftResult.insertedId,
      tokenId: tokenId,
      transactionId: transactionId,
      tier: originalEquipment.tier,
      borderGradient: originalEquipment.borderGradient,
      prefix: metadata.enhancements?.prefix || originalEquipment.prefix,
      suffix: metadata.enhancements?.suffix || originalEquipment.suffix,
      acquiredAt: new Date(),
      fromMonsterId: originalEquipment.fromMonsterId,
      fromSessionId: originalEquipment.fromSessionId,
      updatedFrom: originalEquipmentInventoryId,
    };

    const inventoryResult = await userInventoryCollection.insertOne(newInventoryEntry);

    // Mark original equipment as consumed
    await userInventoryCollection.updateOne(
      { _id: new ObjectId(originalEquipmentInventoryId) },
      {
        $set: {
          consumed: true,
          consumedAt: new Date(),
          consumedInUpdate: {
            newInventoryItemId: inventoryResult.insertedId.toString(),
            newTokenId: tokenId,
            transactionId: transactionId,
            inscriptionScrollTokenId: inscriptionScrollTokenId,
          }
        }
      }
    );

    // Mark inscription scroll as consumed
    await userInventoryCollection.updateOne(
      { _id: new ObjectId(inscriptionScrollInventoryId) },
      {
        $set: {
          consumed: true,
          consumedAt: new Date(),
          consumedInUpdate: {
            equipmentInventoryItemId: inventoryResult.insertedId.toString(),
            equipmentTokenId: tokenId,
            transactionId: transactionId,
          }
        }
      }
    );

    console.log(`Updated equipment NFT saved: ${nftId} for user ${userId}, consumed equipment ${originalEquipmentTokenId} and scroll ${inscriptionScrollTokenId}`);

    return NextResponse.json({
      success: true,
      nftId: nftId,
      newInventoryItemId: inventoryResult.insertedId.toString(),
    });

  } catch (error) {
    console.error('Error in /api/equipment/update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
