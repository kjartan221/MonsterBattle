// Single-tx mint: server builds/funds/signs one deploy+mint locked directly to
// the user's recipient-derived key (so mintOutpoint === tokenId). ALL wallet
// UTXO ops run through the serialized wallet queue (one mint at a time) to
// prevent concurrent double-spends. Returns the BEEF + nonce for the client to
// internalize into its wallet basket.

import { Router, type Request, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { Transaction } from '@bsv/sdk';
import { WalletP2PKH } from '@bsv/wallet-helper';
import { requireAuthProof } from '@server/middleware/requireAuthProof';
import { getWalletQueue } from '@server/lib/walletQueue';
import { connectToMongo } from '@/lib/mongodb';
import { getServerIdentityPublicKey } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { broadcastTX } from '@/utils/overlayFunctions';
import { decodeBeef, encodeBeef } from '@/utils/beefEncoding';
import { generateNonce, deriveRecipientKey } from '@/utils/tokenDerivation';

export const itemsRouter = Router();

itemsRouter.post('/mint-and-transfer', requireAuthProof('mint-item'), async (req: Request, res: Response) => {
  const userId = req.userId as string; // set by requireAuthProof

  // Per-step timing to localize mint latency (cumulative ms from request start).
  const t0 = Date.now();
  const step = (label: string) => console.log(`[items:mint] ${label} +${Date.now() - t0}ms`);

  const { inventoryItemId, itemData, userIdentityKey, paymentTx, walletParams } = req.body;

  // Validate required fields
  if (!inventoryItemId || !itemData || !userIdentityKey) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  if (!paymentTx) {
    res.status(400).json({ error: 'Missing payment transaction' });
    return;
  }
  if (!walletParams || !walletParams.protocolID || !walletParams.keyID || !walletParams.counterparty) {
    res.status(400).json({ error: 'Missing wallet derivation parameters' });
    return;
  }

  // Connect to MongoDB and validate ownership
  const { userInventoryCollection, nftLootCollection } = await connectToMongo();
  const inventoryItem = await userInventoryCollection.findOne({
    _id: new ObjectId(inventoryItemId),
    userId,
  });
  if (!inventoryItem) {
    res.status(404).json({ error: 'Item not found or not owned by user' });
    return;
  }
  if (inventoryItem.nftLootId) {
    res.status(400).json({ error: 'Item already minted' });
    return;
  }

  // Decode payment BEEF (no wallet needed)
  const paymentBeef = decodeBeef(paymentTx);
  const paymentTransaction = Transaction.fromBEEF(paymentBeef);
  const paymentTxId = paymentTransaction.id('hex');
  const paymentOutput = paymentTransaction.outputs[0];
  if (!paymentOutput || !paymentOutput.satoshis || paymentOutput.satoshis < 90) {
    res.status(400).json({ error: 'Invalid payment: must be at least 100 (10% variance) satoshis' });
    return;
  }
  const paymentOutpoint = `${paymentTxId}.0`;
  step('validated + payment parsed');

  // ALL wallet UTXO-touching work runs inside the serialized queue.
  const queue = await getWalletQueue();
  const mint = await queue.enqueue('mint:item', async (serverWallet) => {
    const walletp2pkh = new WalletP2PKH(serverWallet);
    const walletP2pkhUnlockTemplate = walletp2pkh.unlock({
      protocolID: walletParams.protocolID,
      keyID: walletParams.keyID,
      counterparty: walletParams.counterparty,
    });
    const walletP2pkhUnlockingLength = await walletP2pkhUnlockTemplate.estimateLength();

    const ordinalP2PKH = new OrdinalsP2PKH();
    const nonce = generateNonce();
    const serverIdentityKey = await getServerIdentityPublicKey();
    const userKey = await deriveRecipientKey(serverWallet, userIdentityKey, nonce);
    const mintLockingScript = ordinalP2PKH.lock(userKey, '', itemData, 'deploy+mint');
    step('derivation + locking script ready');

    const mintActionRes = await serverWallet.createAction({
      description: 'Server minting item NFT with user WalletP2PKH payment',
      inputBEEF: paymentBeef,
      inputs: [
        {
          inputDescription: 'User WalletP2PKH payment for fees',
          outpoint: paymentOutpoint,
          unlockingScriptLength: walletP2pkhUnlockingLength,
        },
      ],
      outputs: [
        {
          outputDescription: 'New NFT item',
          lockingScript: mintLockingScript.toHex(),
          satoshis: 1,
        },
      ],
      options: { randomizeOutputs: false, acceptDelayedBroadcast: false },
    });
    if (!mintActionRes.signableTransaction) {
      throw new Error('Failed to create signable mint transaction');
    }
    step('createAction done');

    const mintReference = mintActionRes.signableTransaction.reference;
    const mintTxToSign = Transaction.fromBEEF(mintActionRes.signableTransaction.tx);
    mintTxToSign.inputs[0].unlockingScriptTemplate = walletP2pkhUnlockTemplate;
    mintTxToSign.inputs[0].sourceTransaction = paymentTransaction;
    await mintTxToSign.sign();
    step('local sign done');

    const mintUnlockingScript = mintTxToSign.inputs[0].unlockingScript;
    if (!mintUnlockingScript) {
      throw new Error('Missing unlocking script after signing');
    }

    const mintAction = await serverWallet.signAction({
      reference: mintReference,
      spends: { '0': { unlockingScript: mintUnlockingScript.toHex() } },
    });
    if (!mintAction.tx) {
      throw new Error('Failed to sign mint action');
    }
    step('signAction done (chain broadcast)');

    const mintTx = Transaction.fromAtomicBEEF(mintAction.tx);
    const mintBroadcast = await broadcastTX(mintTx);
    const mintTxId = mintBroadcast.txid;
    if (!mintTxId) {
      throw new Error('Failed to get transaction ID from broadcast');
    }
    step('overlay broadcast done');

    return {
      mintActionTx: mintAction.tx,
      tokenId: `${mintTxId}.0`, // mint proof and current location are the same outpoint
      nonce,
      serverIdentityKey,
    };
  });

  // DB writes happen AFTER the wallet work resolves.
  const nftLootDoc = {
    lootTableId: inventoryItem.lootTableId,
    name: itemData.name || itemData.itemName,
    description: itemData.description,
    icon: itemData.icon,
    rarity: itemData.rarity,
    type: inventoryItem.itemType,
    attributes: itemData,
    mintOutpoint: mint.tokenId,
    tokenId: mint.tokenId,
    createdAt: new Date(),
  };
  const nftResult = await nftLootCollection.insertOne(nftLootDoc);
  const nftLootId = nftResult.insertedId.toString();

  await userInventoryCollection.updateOne(
    { _id: new ObjectId(inventoryItemId) },
    {
      $set: {
        nftLootId: nftResult.insertedId,
        mintOutpoint: mint.tokenId,
        tokenId: mint.tokenId,
        keyId: mint.nonce,
        counterparty: mint.serverIdentityKey,
        updatedAt: new Date(),
      },
    },
  );
  step('db written');

  res.json({
    success: true,
    nftId: nftLootId,
    tokenId: mint.tokenId,
    mintOutpoint: mint.tokenId,
    transferBeef: encodeBeef(Array.from(mint.mintActionTx as Uint8Array)),
    received: {
      outputIndex: 0,
      keyId: mint.nonce,
      counterparty: mint.serverIdentityKey,
      tags: ['type:item'],
    },
  });
});
