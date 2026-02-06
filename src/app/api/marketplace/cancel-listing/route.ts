import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { Transaction, PublicKey } from '@bsv/sdk';
import { getTransactionByTxID } from '@/utils/overlayFunctions';

/**
 * POST /api/marketplace/cancel-listing
 * Cancel a marketplace listing and return the item to the seller
 * Uses OrdLock.cancelListing() to unlock the orderLock UTXO
 */
export async function POST(request: NextRequest) {
  try {
    // Get cookies using next/headers
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId as string;

    const body = await request.json();
    const { listingId, returnTokenId } = body;

    // Validate required fields
    if (!listingId || !returnTokenId) {
      return NextResponse.json(
        { error: 'Missing required fields: listingId, returnTokenId' },
        { status: 400 }
      );
    }

    const { marketplaceItemsCollection, userInventoryCollection, materialTokensCollection, nftLootCollection } = await connectToMongo();

    // Fetch the listing
    const listing = await marketplaceItemsCollection.findOne({
      _id: new ObjectId(listingId),
      status: 'active'
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found or already cancelled/sold' },
        { status: 404 }
      );
    }

    // Verify user is the seller
    if (listing.sellerId !== userId) {
      return NextResponse.json(
        { error: 'You are not the seller of this listing' },
        { status: 403 }
      );
    }

    // Ensure listing has OrdLock data
    if (!listing.ordLockOutpoint || !listing.ordLockScript || !listing.assetId) {
      return NextResponse.json(
        { error: 'Listing is missing OrdLock data' },
        { status: 400 }
      );
    }

    console.log('🚫 [CANCEL-LISTING] Starting cancellation validation:', {
      listingId,
      itemName: listing.itemName,
      ordLockOutpoint: listing.ordLockOutpoint,
    });

    const [cancelTxId, returnVoutStr] = String(returnTokenId).split('.');
    const returnVout = parseInt(returnVoutStr, 10);
    if (!cancelTxId || Number.isNaN(returnVout)) {
      return NextResponse.json(
        { error: 'Invalid returnTokenId format' },
        { status: 400 }
      );
    }

    const cancelTxData = await getTransactionByTxID(cancelTxId);
    if (!cancelTxData?.outputs?.[returnVout]?.beef) {
      return NextResponse.json(
        { error: `Could not find cancel transaction: ${cancelTxId}` },
        { status: 400 }
      );
    }

    const cancelTx = Transaction.fromBEEF(cancelTxData.outputs[returnVout].beef);

    const spendsOrdLock = cancelTx.inputs.some(i => {
      const inTxid = i.sourceTXID || i.sourceTransaction?.id('hex');
      return `${inTxid}.${i.sourceOutputIndex}` === listing.ordLockOutpoint;
    });

    if (!spendsOrdLock) {
      return NextResponse.json(
        { error: 'Cancel transaction does not spend the listing ordLockOutpoint' },
        { status: 400 }
      );
    }

    const output = cancelTx.outputs[returnVout];
    if (!output || (output.satoshis || 0) !== 1) {
      return NextResponse.json(
        { error: 'Cancel transaction return output must be 1 satoshi' },
        { status: 400 }
      );
    }

    // Update marketplace listing status
    await marketplaceItemsCollection.updateOne(
      { _id: new ObjectId(listingId) },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          tokenId: returnTokenId,
        }
      }
    );

    // Update item tokenId in inventory or material tokens
    if (listing.inventoryItemId) {
      const inv = await userInventoryCollection.findOne({ _id: new ObjectId(listing.inventoryItemId), userId });
      await userInventoryCollection.updateOne(
        { _id: new ObjectId(listing.inventoryItemId) },
        {
          $set: {
            tokenId: returnTokenId,
            updatedAt: new Date(),
          }
        }
      );

      if (inv?.nftLootId) {
        await nftLootCollection.updateOne(
          { _id: inv.nftLootId },
          {
            $set: {
              tokenId: returnTokenId,
              updatedAt: new Date(),
            }
          }
        );
      }
    } else if (listing.materialTokenId) {
      await materialTokensCollection.updateOne(
        { _id: new ObjectId(listing.materialTokenId) },
        {
          $set: {
            tokenId: returnTokenId,
            updatedAt: new Date(),
          }
        }
      );
    }

    console.log('[MARKETPLACE CANCEL] Listing cancelled:', {
      listingId,
      itemName: listing.itemName,
      returnTokenId,
    });

    return NextResponse.json({
      success: true,
      returnTokenId,
      message: `${listing.itemName} listing cancelled`,
    });

  } catch (error) {
    console.error('Error cancelling listing:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel listing' },
      { status: 500 }
    );
  }
}
