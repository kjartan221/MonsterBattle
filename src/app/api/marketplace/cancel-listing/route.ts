import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getServerWallet } from '@/lib/serverWallet';
import OrdLock from '@/utils/orderLock';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { Transaction, Script } from '@bsv/sdk';
import { broadcastTX, getTransactionByTxID } from '@/utils/overlayFunctions';

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
    const { listingId, userPublicKey, userWallet } = body;

    // Validate required fields
    if (!listingId || !userPublicKey || !userWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: listingId, userPublicKey, userWallet' },
        { status: 400 }
      );
    }

    const { marketplaceItemsCollection, userInventoryCollection, materialTokensCollection } = await connectToMongo();

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

    console.log('🚫 [CANCEL-LISTING] Starting cancellation:', {
      listingId,
      itemName: listing.itemName,
      ordLockOutpoint: listing.ordLockOutpoint,
    });

    // ===== CREATE CANCEL TRANSACTION =====

    // Fetch the OrdLock transaction for spending
    const [ordLockTxId, ordLockVout] = listing.ordLockOutpoint.split('.');
    const ordLockTxData = await getTransactionByTxID(ordLockTxId);

    if (!ordLockTxData || !ordLockTxData.outputs || !ordLockTxData.outputs[parseInt(ordLockVout)] || !ordLockTxData.outputs[parseInt(ordLockVout)].beef) {
      throw new Error(`Could not find OrdLock transaction: ${ordLockTxId}`);
    }

    const ordLockTransaction = Transaction.fromBEEF(ordLockTxData.outputs[parseInt(ordLockVout)].beef!);
    const ordLockScript = Script.fromHex(listing.ordLockScript);

    console.log('📥 [CANCEL-LISTING] OrdLock transaction:', {
      txid: ordLockTxId,
      vout: ordLockVout,
      ordLockOutpoint: listing.ordLockOutpoint,
    });

    // Create OrdLock instance and get cancel unlock template
    const ordLock = new OrdLock();
    const cancelUnlockTemplate = ordLock.cancelListing(
      userWallet,
      'all',
      false,
      1, // sourceSatoshis for the 1 sat UTXO
      ordLockScript
    );
    const cancelUnlockingLength = await cancelUnlockTemplate.estimateLength();

    console.log('🔓 [CANCEL-LISTING] Created cancel unlock template:', {
      unlockingScriptLength: cancelUnlockingLength,
    });

    // Create return locking script (transfer back to seller)
    const ordinalP2PKH = new OrdinalsP2PKH();
    const returnLockingScript = ordinalP2PKH.lock(
      userPublicKey,
      listing.assetId,
      listing, // Item metadata
      'transfer'
    );

    console.log('🔒 [CANCEL-LISTING] Created return locking script:', {
      operation: 'transfer',
      assetId: listing.assetId,
      userPublicKey,
      scriptLength: returnLockingScript.toHex().length,
    });

    // STEP 1: createAction - Prepare transaction
    const serverWallet = await getServerWallet();
    const actionRes = await serverWallet.createAction({
      description: "Cancelling marketplace listing",
      inputBEEF: ordLockTxData.outputs[parseInt(ordLockVout)].beef,
      inputs: [
        {
          inputDescription: "OrdLock UTXO to cancel",
          outpoint: listing.ordLockOutpoint,
          unlockingScriptLength: cancelUnlockingLength,
        }
      ],
      outputs: [
        {
          outputDescription: "Return item to seller",
          lockingScript: returnLockingScript.toHex(),
          satoshis: 1,
        }
      ],
      options: {
        randomizeOutputs: false,
        acceptDelayedBroadcast: false,
      }
    });

    if (!actionRes.signableTransaction) {
      throw new Error('Failed to create signable transaction');
    }

    // STEP 2: Sign - Generate unlocking scripts
    const reference = actionRes.signableTransaction.reference;
    const txToSign = Transaction.fromBEEF(actionRes.signableTransaction.tx);

    // Attach template and source transaction
    txToSign.inputs[0].unlockingScriptTemplate = cancelUnlockTemplate;
    txToSign.inputs[0].sourceTransaction = ordLockTransaction;

    // Sign the transaction
    await txToSign.sign();

    // Extract unlocking script
    const unlockingScript = txToSign.inputs[0].unlockingScript;

    if (!unlockingScript) {
      throw new Error('Missing unlocking script after signing');
    }

    console.log('🔓 [CANCEL-LISTING] Transaction signed, unlocking script generated');

    // STEP 3: signAction - Finalize transaction
    const action = await serverWallet.signAction({
      reference,
      spends: {
        '0': { unlockingScript: unlockingScript.toHex() }
      }
    });

    if (!action.tx) {
      throw new Error('Failed to sign action');
    }

    // Broadcast transaction
    const tx = Transaction.fromAtomicBEEF(action.tx);
    const broadcast = await broadcastTX(tx);
    const txid = broadcast.txid;

    if (!txid) {
      throw new Error('Failed to get transaction ID from broadcast');
    }

    const returnTokenId = `${txid}.0`;

    console.log('✅ [CANCEL-LISTING] Cancel transaction broadcast:', {
      txid,
      returnTokenId,
    });

    // Update marketplace listing status
    await marketplaceItemsCollection.updateOne(
      { _id: new ObjectId(listingId) },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
        }
      }
    );

    // Update item tokenId in inventory or material tokens
    if (listing.inventoryItemId) {
      await userInventoryCollection.updateOne(
        { _id: new ObjectId(listing.inventoryItemId) },
        {
          $set: {
            tokenId: returnTokenId,
            updatedAt: new Date(),
          }
        }
      );
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
