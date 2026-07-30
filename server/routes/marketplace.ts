// Marketplace purchase: atomic claim (active -> pending) BEFORE any wallet work so only
// one concurrent buyer proceeds, then all wallet UTXO ops run through the serialized
// wallet queue. A wallet-block failure releases the claim back to 'active' (rollback) —
// this route is NOT best-effort like the other wallet routes; a stranded 'pending'
// listing must never be left behind. Post-broadcast DB mutations (listing -> sold,
// ownership transfer) run inside a single withTransaction for atomicity.

import { Router, type Request, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { Beef, Transaction, Script, P2PKH, type AtomicBEEF } from '@bsv/sdk';
import { WalletOrdLock, WalletP2PKH } from '@bsv/wallet-helper';
import { requireAuthProof } from '@server/middleware/requireAuthProof';
import { getWalletQueue } from '@server/lib/walletQueue';
import { connectToMongo, getClient } from '@/lib/mongodb';
import { getServerIdentityPublicKey } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { broadcastTX, getTransactionByTxID } from '@/utils/overlayFunctions';
import { decodeBeef, encodeBeef } from '@/utils/beefEncoding';
import { generateNonce, deriveRecipientKey } from '@/utils/tokenDerivation';

export const marketplaceRouter = Router();

marketplaceRouter.post('/purchase-listing', requireAuthProof('purchase'), async (req: Request, res: Response) => {
  const userId = req.userId as string;

  const { listingId, buyerIdentityKey, paymentTx, walletParams } = req.body;

  if (!listingId || !buyerIdentityKey || !paymentTx || !walletParams) {
    res.status(400).json({ error: 'Missing required fields: listingId, buyerIdentityKey, paymentTx, walletParams' });
    return;
  }

  const { marketplaceItemsCollection, marketplaceListingBeefsCollection, userInventoryCollection, materialTokensCollection, usersCollection } = await connectToMongo();

  const listingObjectId = new ObjectId(listingId);

  // Atomically claim the listing before any wallet work, so only one concurrent buyer proceeds.
  const claimed = await marketplaceItemsCollection.findOneAndUpdate(
    { _id: listingObjectId, status: 'active' },
    { $set: { status: 'pending', pendingBuyerId: userId, pendingAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!claimed) {
    res.status(409).json({ error: 'Listing is not available' });
    return;
  }

  const listing = claimed;

  // Releases a claimed listing back to active; used on any failure after the claim so it's never stranded in 'pending'.
  const releaseListing = async () => {
    await marketplaceItemsCollection.updateOne(
      { _id: listingObjectId, status: 'pending', pendingBuyerId: userId },
      { $set: { status: 'active' }, $unset: { pendingBuyerId: '', pendingAt: '' } },
    );
  };

  // Can't buy your own listing
  if (listing.sellerId === userId) {
    await releaseListing();
    res.status(400).json({ error: 'You cannot purchase your own listing' });
    return;
  }

  // Ensure listing has OrdLock data
  if (!listing.ordLockOutpoint || !listing.ordLockScript || !listing.assetId || !listing.payAddress) {
    await releaseListing();
    res.status(400).json({ error: 'Listing is missing OrdLock data' });
    return;
  }

  // Parse payment transaction (client sends base64 BEEF) + validate it's sufficient —
  // moved before the wallet lock so an insufficient payment never enters the queue.
  // Wrapped in its own try/catch: the claim already flipped the listing to 'pending',
  // so ANY throw here (e.g. malformed paymentTx) must still release it — otherwise a
  // single bad request strands the listing in 'pending' forever (per-listing DoS).
  let paymentBeef: number[];
  let paymentTransaction: Transaction;
  let paymentOutpoint: string;
  const feeBufferSatoshis = 100;
  const requiredPayment = listing.price + feeBufferSatoshis;
  try {
    paymentBeef = decodeBeef(paymentTx);
    paymentTransaction = Transaction.fromBEEF(paymentBeef);
    const paymentTxId = paymentTransaction.id('hex');
    const paymentOutput = paymentTransaction.outputs[0];
    if (!paymentOutput || (paymentOutput.satoshis ?? 0) < requiredPayment) {
      await releaseListing();
      res.status(400).json({ error: `Invalid payment amount. Required: ${requiredPayment} sats (price ${listing.price} + ${feeBufferSatoshis} sats fees)` });
      return;
    }
    paymentOutpoint = `${paymentTxId}.0`;
  } catch (err) {
    await releaseListing();
    res.status(400).json({ error: 'Invalid payment transaction' });
    return;
  }

  // ===== CREATE PURCHASE TRANSACTION =====
  // Wallet build + sign + broadcast; any failure here releases the claim back to 'active'.
  let purchaseResult: {
    action: { tx?: AtomicBEEF };
    txid: string;
    buyerTokenId: string;
    purchaseNonce: string;
    serverIdentityKey: string;
  };
  try {
    purchaseResult = await (await getWalletQueue()).enqueue('purchase', async (serverWallet) => {
      // Resolve the listing tx: DB backup first, overlay as fallback.
      const [ordLockTxId, ordLockVoutStr] = String(listing.ordLockOutpoint).split('.');
      const beefDoc = await marketplaceListingBeefsCollection.findOne({ listingId });
      let ordLockTransaction: Transaction;
      if (beefDoc?.beef) {
        ordLockTransaction = Transaction.fromBEEF(decodeBeef(beefDoc.beef));
      } else {
        const ordLockTxData = await getTransactionByTxID(ordLockTxId);
        const overlayBeef = ordLockTxData?.outputs?.[parseInt(ordLockVoutStr, 10)]?.beef;
        if (!overlayBeef) {
          throw new Error('Listing tx not found in DB backup or overlay');
        }
        ordLockTransaction = Transaction.fromBEEF(overlayBeef);
      }
      const ordLockScript = Script.fromHex(listing.ordLockScript!);

      // Create purchase unlock template
      const ordLock = new WalletOrdLock();
      const purchaseUnlockTemplate = ordLock.purchaseUnlock({
        sourceSatoshis: 1,
        lockingScript: ordLockScript,
      });

      // Derive recipient key for output 0 (token to buyer)
      const purchaseNonce = generateNonce();
      const serverIdentityKey = await getServerIdentityPublicKey();
      const buyerKey = await deriveRecipientKey(serverWallet, buyerIdentityKey, purchaseNonce);

      // Create transfer locking script (item to buyer, locked to derived key)
      const ordinalP2PKH = new OrdinalsP2PKH();
      const transferLockingScript = ordinalP2PKH.lock(
        buyerKey,
        listing.assetId!,
        listing, // Item metadata
        'transfer',
      );

      // Create payment locking script (payment to seller)
      // This MUST match the payout in OrdLock (address and amount)
      const sellerPaymentScript = new P2PKH().lock(listing.payAddress!);

      // Create unlocking templates for payment input
      const walletp2pkh = new WalletP2PKH(serverWallet);
      const paymentUnlockTemplate = walletp2pkh.unlock({
        protocolID: walletParams.protocolID,
        keyID: walletParams.keyID,
        counterparty: walletParams.counterparty,
      });
      const paymentUnlockingLength = await paymentUnlockTemplate.estimateLength();

      // Build outputs array
      const outputs: Array<{ outputDescription: string; lockingScript: string; satoshis: number }> = [
        {
          outputDescription: 'Transfer item to buyer',
          lockingScript: transferLockingScript.toHex(),
          satoshis: 1,
        },
        {
          outputDescription: 'Payment to seller',
          lockingScript: sellerPaymentScript.toHex(),
          satoshis: listing.price,
        },
      ];

      const mergedBeef = new Beef();
      mergedBeef.mergeBeef(ordLockTransaction.toBEEF());
      mergedBeef.mergeBeef(paymentBeef);
      const inputBEEF = mergedBeef.toBinary();

      // STEP 1: createAction - Prepare transaction
      // OrdLock purchase unlocking script length depends on the final transaction outputs,
      // so we do a quick two-pass createAction: first with a conservative placeholder,
      // then compute the exact length from the signable transaction and recreate.
      const ordLockUnlockingLengthPlaceholder = 400;
      let actionRes = await serverWallet.createAction({
        description: 'Purchasing marketplace item',
        inputBEEF,
        inputs: [
          {
            inputDescription: 'OrdLock UTXO to purchase',
            outpoint: listing.ordLockOutpoint!,
            unlockingScriptLength: ordLockUnlockingLengthPlaceholder,
          },
          {
            inputDescription: 'Buyer payment for item and fees',
            outpoint: paymentOutpoint,
            unlockingScriptLength: paymentUnlockingLength,
          },
        ],
        outputs,
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false,
        },
      });

      if (!actionRes.signableTransaction) {
        throw new Error('Failed to create signable transaction');
      }

      const txForLength = Transaction.fromBEEF(actionRes.signableTransaction.tx);
      const ordLockUnlockingLength = await purchaseUnlockTemplate.estimateLength(txForLength, 0);
      const ordLockUnlockingLengthWithBuffer = ordLockUnlockingLength + 68;

      actionRes = await serverWallet.createAction({
        description: 'Purchasing marketplace item',
        inputBEEF,
        inputs: [
          {
            inputDescription: 'OrdLock UTXO to purchase',
            outpoint: listing.ordLockOutpoint!,
            unlockingScriptLength: ordLockUnlockingLengthWithBuffer,
          },
          {
            inputDescription: 'Buyer payment for item and fees',
            outpoint: paymentOutpoint,
            unlockingScriptLength: paymentUnlockingLength,
          },
        ],
        outputs,
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false,
        },
      });

      if (!actionRes.signableTransaction) {
        throw new Error('Failed to create signable transaction');
      }

      // STEP 2: Sign - Generate unlocking scripts
      const reference = actionRes.signableTransaction.reference;
      const txToSign = Transaction.fromBEEF(actionRes.signableTransaction.tx);

      // Attach templates and source transactions
      txToSign.inputs[0].unlockingScriptTemplate = purchaseUnlockTemplate;
      txToSign.inputs[0].sourceTransaction = ordLockTransaction;
      txToSign.inputs[1].unlockingScriptTemplate = paymentUnlockTemplate;
      txToSign.inputs[1].sourceTransaction = paymentTransaction;

      // Sign the transaction (this generates the OrdLock purchase unlocking script)
      await txToSign.sign();

      // Extract unlocking scripts
      const ordLockUnlockingScript = txToSign.inputs[0].unlockingScript;
      const paymentUnlockingScript = txToSign.inputs[1].unlockingScript;

      if (!ordLockUnlockingScript || !paymentUnlockingScript) {
        throw new Error('Missing unlocking scripts after signing');
      }

      // STEP 3: signAction - Finalize transaction
      const action = await serverWallet.signAction({
        reference,
        spends: {
          '0': { unlockingScript: ordLockUnlockingScript.toHex() },
          '1': { unlockingScript: paymentUnlockingScript.toHex() },
        },
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

      const buyerTokenId = `${txid}.0`;

      return { action, txid, buyerTokenId, purchaseNonce, serverIdentityKey };
    });
  } catch (err) {
    await releaseListing();
    console.error('Purchase failed, listing released:', err);
    res.status(502).json({ error: 'Purchase failed; listing released' });
    return;
  }

  const { action, txid, buyerTokenId, purchaseNonce, serverIdentityKey } = purchaseResult;

  // ===== FINALIZE (post-broadcast DB mutations, atomic) =====
  const client = await getClient();
  const dbSession = client.startSession();
  try {
    await dbSession.withTransaction(async () => {
      // Update marketplace listing status (only if still claimed by this buyer)
      await marketplaceItemsCollection.updateOne(
        { _id: listingObjectId, status: 'pending' },
        {
          $set: {
            status: 'sold',
            soldAt: new Date(),
            soldTo: userId,
            payoutOutpoint: `${txid}.1`, // output 1 = seller payment (claimable proceeds)
          },
          $unset: { pendingBuyerId: '', pendingAt: '' },
        },
        { session: dbSession },
      );

      // Listing spent — drop the BEEF backup.
      await marketplaceListingBeefsCollection.deleteOne({ listingId }, { session: dbSession });

      // Get buyer user info
      const buyerUser = await usersCollection.findOne({ userId }, { session: dbSession });
      if (!buyerUser) {
        throw new Error('Buyer user not found');
      }

      // Transfer item ownership in database
      if (listing.inventoryItemId) {
        // Transfer inventory item to buyer
        await userInventoryCollection.updateOne(
          { _id: new ObjectId(listing.inventoryItemId) },
          {
            $set: {
              userId: userId, // New owner
              tokenId: buyerTokenId,
              keyId: purchaseNonce,
              counterparty: serverIdentityKey,
              updatedAt: new Date(),
            },
          },
          { session: dbSession },
        );
      } else if (listing.materialTokenId) {
        // Transfer material token to buyer
        await materialTokensCollection.updateOne(
          { _id: new ObjectId(listing.materialTokenId) },
          {
            $set: {
              userId: userId, // New owner
              tokenId: buyerTokenId,
              keyId: purchaseNonce,
              counterparty: serverIdentityKey,
              updatedAt: new Date(),
            },
          },
          { session: dbSession },
        );
      }
    });
  } finally {
    await dbSession.endSession();
  }

  res.json({
    success: true,
    buyerTokenId,
    message: `${listing.itemName} purchased for ${listing.price} satoshis`,
    transferBeef: encodeBeef(Array.from(action.tx!)),
    received: {
      outputIndex: 0,
      keyId: purchaseNonce,
      counterparty: serverIdentityKey,
      tags: [listing.materialTokenId ? 'type:material' : 'type:item'],
    },
  });
});
