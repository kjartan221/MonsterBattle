import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { ObjectId } from 'mongodb';
import { getLootItemById } from '@/lib/loot-table';

/**
 * Mint an inventory item as an NFT on the BSV blockchain
 *
 * This route handles user-initiated NFT minting:
 * 1. Verify user owns the inventory item
 * 2. Process BSV wallet payment
 * 3. Create NFTLoot document
 * 4. Mint to blockchain (with fancy image)
 * 5. Update inventory item with nftLootId
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
    const userId = payload.userId as string;

    // Get request body
    const body = await request.json();
    const { inventoryId } = body;

    if (!inventoryId) {
      return NextResponse.json(
        { error: 'inventoryId is required' },
        { status: 400 }
      );
    }

    // Convert to ObjectId
    let inventoryObjectId: ObjectId;
    try {
      inventoryObjectId = new ObjectId(inventoryId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid inventoryId format' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { userInventoryCollection, nftLootCollection } = await connectToMongo();

    // Fetch the inventory item and verify ownership
    const inventoryItem = await userInventoryCollection.findOne({
      _id: inventoryObjectId,
      userId
    });

    if (!inventoryItem) {
      return NextResponse.json(
        { error: 'Inventory item not found or you do not own it' },
        { status: 404 }
      );
    }

    // Check if already minted
    if (inventoryItem.nftLootId) {
      return NextResponse.json(
        { error: 'This item has already been minted as an NFT' },
        { status: 400 }
      );
    }

    // Get loot template data
    const lootTemplate = getLootItemById(inventoryItem.lootTableId);
    if (!lootTemplate) {
      return NextResponse.json(
        { error: 'Loot template not found' },
        { status: 404 }
      );
    }

    // TODO: Implement BSV wallet payment
    // Example flow:
    // 1. Calculate minting cost (based on rarity or fixed price)
    // 2. Request payment from user's BSV wallet
    // 3. Verify payment transaction

    /*
    const mintingCost = calculateMintingCost(lootTemplate.rarity); // in satoshis

    const paymentRequest = {
      amount: mintingCost,
      description: `Mint ${lootTemplate.name} as NFT`,
      recipient: process.env.MINTING_WALLET_ADDRESS
    };

    // Request payment from wallet (placeholder)
    const paymentTx = await requestWalletPayment(paymentRequest);

    if (!paymentTx || !paymentTx.verified) {
      return NextResponse.json(
        { error: 'Payment failed or was cancelled' },
        { status: 402 }
      );
    }
    */

    // Create NFTLoot document
    const nftLootDocument = {
      lootTableId: inventoryItem.lootTableId,
      name: lootTemplate.name,
      description: lootTemplate.description,
      icon: lootTemplate.icon,
      rarity: lootTemplate.rarity,
      type: lootTemplate.type,
      attributes: {
        borderGradient: inventoryItem.borderGradient, // User's unique gradient
        // Add more fancy attributes here since we're making fewer NFTs
        acquiredFrom: inventoryItem.fromMonsterId?.toString() || 'crafted',
        acquiredAt: inventoryItem.acquiredAt,
        crafted: inventoryItem.crafted || false,
        statRoll: inventoryItem.statRoll
      },
      createdAt: new Date(),
      // mintTransactionId will be added when blockchain minting completes
    };

    const nftResult = await nftLootCollection.insertOne(nftLootDocument);
    const nftLootId = nftResult.insertedId;

    console.log(`💎 Created NFT for ${lootTemplate.name} - ID: ${nftLootId}`);

    // Update inventory item to reference the new NFT
    await userInventoryCollection.updateOne(
      { _id: inventoryObjectId },
      {
        $set: {
          nftLootId: nftLootId
        }
      }
    );

    console.log(`✅ User ${userId} minted ${lootTemplate.name} as NFT`);

    // TODO: Implement blockchain minting with fancy image
    // Since we're making fewer NFTs, we can afford higher quality images/data
    // Example flow:
    // 1. Generate high-quality NFT image (combine item icon, gradient, stats)
    // 2. Upload image to IPFS or similar storage
    // 3. Create NFT metadata JSON with image URL
    // 4. Mint to BSV blockchain using BSV SDK
    // 5. Update nftLootDocument with mintTransactionId

    /*
    const nftImage = await generateFancyNFTImage({
      icon: lootTemplate.icon,
      gradient: inventoryItem.borderGradient,
      rarity: lootTemplate.rarity,
      name: lootTemplate.name
    });

    const imageUrl = await uploadToStorage(nftImage);

    const nftMetadata = {
      name: lootTemplate.name,
      description: lootTemplate.description,
      image: imageUrl,
      attributes: nftLootDocument.attributes
    };

    const mintTx = await mintToBSVBlockchain(nftMetadata, userId);

    await nftLootCollection.updateOne(
      { _id: nftLootId },
      {
        $set: {
          mintTransactionId: mintTx.txid,
          mintedAt: new Date()
        }
      }
    );
    */

    return NextResponse.json({
      success: true,
      message: 'NFT minting initiated',
      nftLootId: nftLootId.toString(),
      itemName: lootTemplate.name
    });

  } catch (error) {
    console.error('Mint NFT error:', error);
    return NextResponse.json(
      { error: 'Failed to mint NFT' },
      { status: 500 }
    );
  }
}
