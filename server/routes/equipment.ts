// Server-side equipment update with inscription scrolls (batched derived-key pattern).
// Client transfers equipment + scrolls in one batch tx (posted BEEF + shared nonce N2).
// Server unlocks all transferred inputs with a single shared-derivation template,
// applies inscriptions, and outputs updated equipment to user's recipient-derived key (N3).
// Scrolls are consumed (no output). ALL wallet UTXO ops run through the serialized wallet
// queue (one action at a time) to prevent concurrent double-spends. Returns BEEF + N3 for
// the client to internalize.

import { Router, type Request, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { Transaction, Beef } from '@bsv/sdk';
import { WalletP2PKH } from '@bsv/wallet-helper';
import { requireAuthProof } from '@server/middleware/requireAuthProof';
import { getWalletQueue } from '@server/lib/walletQueue';
import { connectToMongo } from '@/lib/mongodb';
import { getServerWallet, getServerIdentityPublicKey } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { broadcastTX } from '@/utils/overlayFunctions';
import { decodeBeef, encodeBeef } from '@/utils/beefEncoding';
import { TOKEN_PROTOCOL, generateNonce, deriveRecipientKey } from '@/utils/tokenDerivation';

export const equipmentRouter = Router();

equipmentRouter.post('/update', requireAuthProof('update-equipment'), async (req: Request, res: Response) => {
  const userId = req.userId as string;

  const {
    originalEquipmentInventoryId,
    originalEquipmentTokenId,
    inscriptionScrollInventoryIds,   // Array of scroll inventory IDs
    transferredEquipmentTokenId,
    transferredScrollTokenIds,       // Array of transferred scroll outpoints
    batchTransferBeef,               // base64 BEEF of client's batch transfer tx
    transferNonce,                   // N2: shared nonce used to lock all transferred outputs to server; absent ⇒ legacy
    userIdentityKey,                 // Derivation counterparty (replaces userPublicKey)
    equipmentData,
    updatedPrefix,
    updatedSuffix,
    paymentTx,                       // base64 WalletP2PKH payment BEEF
    walletParams,
  } = req.body;

  if (!originalEquipmentInventoryId || !inscriptionScrollInventoryIds || !transferredEquipmentTokenId || !transferredScrollTokenIds || !userIdentityKey || !batchTransferBeef) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  if (!Array.isArray(inscriptionScrollInventoryIds) || inscriptionScrollInventoryIds.length === 0) {
    res.status(400).json({ error: 'At least one inscription scroll required' });
    return;
  }

  if (inscriptionScrollInventoryIds.length > 2) {
    res.status(400).json({ error: 'Maximum 2 inscription scrolls allowed (prefix + suffix)' });
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

  // Connect to MongoDB
  const { userInventoryCollection, nftLootCollection, playerStatsCollection } = await connectToMongo();

  // Verify equipment ownership
  const originalEquipment = await userInventoryCollection.findOne({
    _id: new ObjectId(originalEquipmentInventoryId),
    userId,
  });

  if (!originalEquipment) {
    res.status(404).json({ error: 'Original equipment not found or not owned by user' });
    return;
  }

  // Verify scroll ownership
  const scrollInventoryIds = inscriptionScrollInventoryIds.map((id: string) => new ObjectId(id));
  const inscriptionScrolls = await userInventoryCollection
    .find({ _id: { $in: scrollInventoryIds }, userId })
    .toArray();

  if (inscriptionScrolls.length !== inscriptionScrollInventoryIds.length) {
    res.status(404).json({ error: 'One or more inscription scrolls not found or not owned by user' });
    return;
  }

  // Pre-lock read: this only needs a wallet handle for getPublicKey/unlock-template
  // estimation (no UTXO ops), so it's safe outside the serialized queue. Same
  // singleton wallet the queue itself uses.
  const serverWallet = await getServerWallet();
  const ordinalP2PKH = new OrdinalsP2PKH();

  // Parse payment and batch transfer transactions
  const paymentBeef = decodeBeef(paymentTx);
  const paymentTransaction = Transaction.fromBEEF(paymentBeef);
  const paymentTxId = paymentTransaction.id('hex');

  const paymentOutput = paymentTransaction.outputs[0];
  if (!paymentOutput || !paymentOutput.satoshis || paymentOutput.satoshis < 100) {
    res.status(400).json({ error: 'Invalid payment: must be at least 100 satoshis' });
    return;
  }

  const paymentOutpoint = `${paymentTxId}.0`;

  const walletp2pkh = new WalletP2PKH(serverWallet);
  const walletP2pkhUnlockTemplate = walletp2pkh.unlock({
    protocolID: walletParams.protocolID,
    keyID: walletParams.keyID,
    counterparty: walletParams.counterparty,
  });
  const walletP2pkhUnlockingLength = await walletP2pkhUnlockTemplate.estimateLength();

  // Decode batch transfer BEEF (no overlay fetch)
  const batchTransferTransaction = Transaction.fromBEEF(decodeBeef(batchTransferBeef));

  // Metadata for the updated equipment — no wallet needed, built pre-lock so it's
  // available both inside the queue (locking script) and after it (DB write).
  const updatedEquipmentMetadata = {
    name: 'game_item',
    itemName: equipmentData.name,
    description: equipmentData.description,
    icon: equipmentData.icon,
    rarity: equipmentData.rarity,
    itemType: equipmentData.type,
    tier: equipmentData.tier,
    stats: equipmentData.equipmentStats,
    crafted: equipmentData.crafted || null,
    enhancements: { prefix: updatedPrefix, suffix: updatedSuffix },
    visual: { borderGradient: equipmentData.borderGradient },
  };

  const assetId = originalEquipmentTokenId.replace('.', '_');

  // ALL wallet UTXO-touching work runs inside the serialized queue.
  const result = await (await getWalletQueue()).enqueue('update:equipment', async (serverWallet) => {
    // Single unlock template shared by all transferred ordinal inputs (they share N2)
    const unlockTemplate = ordinalP2PKH.unlock(
      serverWallet, 'all', false, undefined, undefined,
      transferNonce
        ? { protocolID: TOKEN_PROTOCOL, keyID: transferNonce, counterparty: userIdentityKey }
        : undefined, // legacy: fixed key
    );
    const unlockingScriptLength = await unlockTemplate.estimateLength();

    // Derive user recipient key for the updated equipment output
    const serverIdentityKey = await getServerIdentityPublicKey();
    const N3 = generateNonce();
    const userKey = await deriveRecipientKey(serverWallet, userIdentityKey, N3);

    const updatedEquipmentLockingScript = ordinalP2PKH.lock(
      userKey,
      assetId,
      updatedEquipmentMetadata,
      'transfer'
    );

    // Build inputs: equipment + scrolls (shared unlock template) + payment
    const inputs = [
      { inputDescription: 'Transferred equipment token', outpoint: transferredEquipmentTokenId, unlockingScriptLength },
    ];

    for (let i = 0; i < transferredScrollTokenIds.length; i++) {
      inputs.push({
        inputDescription: `Transferred scroll token ${i + 1}`,
        outpoint: transferredScrollTokenIds[i],
        unlockingScriptLength,
      });
    }

    inputs.push({
      inputDescription: 'User WalletP2PKH payment for fees',
      outpoint: paymentOutpoint,
      unlockingScriptLength: walletP2pkhUnlockingLength,
    });

    const mergedBeef = new Beef();
    mergedBeef.mergeBeef(batchTransferTransaction.toBEEF());
    mergedBeef.mergeBeef(paymentTransaction.toBEEF());
    const inputBEEF = mergedBeef.toBinary();

    const updateActionRes = await serverWallet.createAction({
      description: `Updating equipment with ${inscriptionScrollInventoryIds.length} inscription scroll(s)`,
      inputBEEF,
      inputs,
      outputs: [{
        outputDescription: 'Updated equipment back to user',
        lockingScript: updatedEquipmentLockingScript.toHex(),
        satoshis: 1,
      }],
      options: { randomizeOutputs: false, acceptDelayedBroadcast: false },
    });

    if (!updateActionRes.signableTransaction) {
      throw new Error('Failed to create signable update transaction');
    }

    const reference = updateActionRes.signableTransaction.reference;
    const txToSign = Transaction.fromBEEF(updateActionRes.signableTransaction.tx);

    // Apply shared unlock template to all ordinal inputs (0..N-2); payment gets WalletP2PKH
    for (let i = 0; i < inputs.length - 1; i++) {
      txToSign.inputs[i].unlockingScriptTemplate = unlockTemplate;
      txToSign.inputs[i].sourceTransaction = batchTransferTransaction;
    }

    const paymentInputIndex = inputs.length - 1;
    txToSign.inputs[paymentInputIndex].unlockingScriptTemplate = walletP2pkhUnlockTemplate;
    txToSign.inputs[paymentInputIndex].sourceTransaction = paymentTransaction;

    await txToSign.sign();

    const spends: Record<string, any> = {};
    for (let i = 0; i < inputs.length; i++) {
      const unlockingScript = txToSign.inputs[i].unlockingScript;
      if (!unlockingScript) throw new Error(`Missing unlocking script for input ${i}`);
      spends[String(i)] = { unlockingScript: unlockingScript.toHex() };
    }

    const updateAction = await serverWallet.signAction({ reference, spends });

    if (!updateAction.tx) throw new Error('Failed to sign update action');

    const updateTx = Transaction.fromAtomicBEEF(updateAction.tx);
    const updateBroadcast = await broadcastTX(updateTx);
    const updateTxId = updateBroadcast.txid!;
    const updatedEquipmentTokenId = `${updateTxId}.0`;

    return {
      updateActionTx: updateAction.tx,
      updatedEquipmentTokenId,
      updateTxId,
      N3,
      serverIdentityKey,
    };
  });

  // Update database (after the enqueue resolved — the update is already broadcast
  // on-chain by this point): preserve mint proof, add keyId/counterparty.
  const originalNFTLoot = await nftLootCollection.findOne({ _id: originalEquipment.nftLootId });

  const updatedEquipmentDoc = {
    lootTableId: equipmentData.lootTableId,
    name: equipmentData.name,
    description: equipmentData.description,
    icon: equipmentData.icon,
    rarity: equipmentData.rarity,
    type: equipmentData.type,
    attributes: { ...updatedEquipmentMetadata, borderGradient: equipmentData.borderGradient },
    mintOutpoint: originalNFTLoot?.mintOutpoint, // preserve original mint proof
    tokenId: result.updatedEquipmentTokenId,
    keyId: result.N3,
    counterparty: result.serverIdentityKey,
    userId,
    createdAt: new Date(),
  };

  const nftResult = await nftLootCollection.insertOne(updatedEquipmentDoc);
  const nftId = nftResult.insertedId.toString();

  const newInventoryEntry = {
    userId,
    lootTableId: equipmentData.lootTableId,
    itemType: equipmentData.type,
    nftLootId: nftResult.insertedId,
    mintOutpoint: originalNFTLoot?.mintOutpoint, // preserve original mint proof
    tokenId: result.updatedEquipmentTokenId,
    transactionId: result.updateTxId,
    keyId: result.N3,
    counterparty: result.serverIdentityKey,
    tier: equipmentData.tier || originalEquipment.tier,
    borderGradient: equipmentData.borderGradient || originalEquipment.borderGradient,
    prefix: updatedPrefix,
    suffix: updatedSuffix,
    acquiredAt: new Date(),
    fromMonsterId: originalEquipment.fromMonsterId,
    fromSessionId: originalEquipment.fromSessionId,
    updatedFrom: originalEquipmentInventoryId,
    crafted: originalEquipment.crafted,
    statRoll: originalEquipment.statRoll,
    isEmpowered: originalEquipment.isEmpowered,
    enhanced: originalEquipment.enhanced,
  };

  const inventoryResult = await userInventoryCollection.insertOne(newInventoryEntry);

  // Auto-update equipped slot references if old item was equipped
  const oldEquipmentId = new ObjectId(originalEquipmentInventoryId);
  const newEquipmentId = inventoryResult.insertedId;
  let wasEquipped = false;

  const playerStats = await playerStatsCollection.findOne({ userId });
  if (playerStats) {
    const updateFields: any = {};

    if (playerStats.equippedWeapon?.equals(oldEquipmentId)) { updateFields.equippedWeapon = newEquipmentId; wasEquipped = true; }
    if (playerStats.equippedArmor?.equals(oldEquipmentId)) { updateFields.equippedArmor = newEquipmentId; wasEquipped = true; }
    if (playerStats.equippedAccessory1?.equals(oldEquipmentId)) { updateFields.equippedAccessory1 = newEquipmentId; wasEquipped = true; }
    if (playerStats.equippedAccessory2?.equals(oldEquipmentId)) { updateFields.equippedAccessory2 = newEquipmentId; wasEquipped = true; }

    if (Object.keys(updateFields).length > 0) {
      await playerStatsCollection.updateOne({ userId }, { $set: updateFields });
    }
  }

  // Delete original equipment and consumed scrolls (provenance is on-chain)
  await userInventoryCollection.deleteOne({ _id: oldEquipmentId });

  for (const scrollInventoryId of inscriptionScrollInventoryIds) {
    await userInventoryCollection.deleteOne({ _id: new ObjectId(scrollInventoryId), userId });
  }

  res.json({
    success: true,
    nftId,
    tokenId: result.updatedEquipmentTokenId,
    transactionId: result.updateTxId,
    newInventoryItemId: inventoryResult.insertedId.toString(),
    wasEquipped,
    transferBeef: encodeBeef(Array.from(result.updateActionTx as Uint8Array)),
    received: {
      outputIndex: 0,
      keyId: result.N3,
      counterparty: result.serverIdentityKey,
      tags: ['type:equipment'],
    },
  });
});
