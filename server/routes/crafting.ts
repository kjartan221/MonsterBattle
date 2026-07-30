// Server-side crafting: derived-key transfer-to-server pattern (multi-input + multi-output).
// Client batches ALL materials into ONE transfer tx locked to a server recipient-derived key
// using a single shared nonce N2, then POSTs that tx's BEEF + N2.
// Server: validates transferred materials (shared N2), mints crafted item to a self-derived
// key (mintNonce), then in one transfer tx consumes [materials + crafted item] and outputs
// [crafted item → user (N3_item) + each material change → user (N3_change_i)].
// The mint + transfer are one dependent sequence and run as a single unit through the
// serialized wallet queue to prevent concurrent UTXO double-spends.
// Returns BEEF + received[] for client to internalize all outputs.

import { Router, type Request, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { Transaction, P2PKH, Beef, Hash } from '@bsv/sdk';
import { WalletP2PKH } from '@bsv/wallet-helper';
import { requireAuthProof } from '@server/middleware/requireAuthProof';
import { getWalletQueue } from '@server/lib/walletQueue';
import { connectToMongo, getClient } from '@/lib/mongodb';
import { getServerWallet, getServerPublicKey, getServerIdentityPublicKey } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { broadcastTX } from '@/utils/overlayFunctions';
import { decodeBeef, encodeBeef } from '@/utils/beefEncoding';
import { TOKEN_PROTOCOL, generateNonce, deriveRecipientKey, deriveSelfKey } from '@/utils/tokenDerivation';
import { getLootItemById } from '@/lib/loot-table';

export const craftingRouter = Router();

craftingRouter.post('/mint-and-transfer', requireAuthProof('craft'), async (req: Request, res: Response) => {
  const userId = req.userId as string;

  const {
    recipeId,
    transferredMaterials, // Array of {lootTableId, tokenId, quantity, quantityNeeded, itemName, description, icon, rarity, tier}
    outputItem,
    userIdentityKey, // derivation counterparty
    paymentTx, // base64 WalletP2PKH payment BEEF
    batchTransferBeef, // base64 BEEF of client's single batch transfer (all materials, shared N2)
    transferNonce, // N2: shared nonce client used to lock all materials to server
    walletParams,
  } = req.body;

  if (!transferredMaterials || !Array.isArray(transferredMaterials) || transferredMaterials.length === 0) {
    res.status(400).json({ error: 'Missing or invalid transferredMaterials' });
    return;
  }

  if (!outputItem || !userIdentityKey) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  if (!paymentTx) {
    res.status(400).json({ error: 'Missing payment transaction' });
    return;
  }

  if (!batchTransferBeef) {
    res.status(400).json({ error: 'Missing batch transfer BEEF' });
    return;
  }

  if (!walletParams || !walletParams.protocolID || !walletParams.keyID || !walletParams.counterparty) {
    res.status(400).json({ error: 'Missing wallet derivation parameters' });
    return;
  }

  // Connect to MongoDB
  const { userInventoryCollection, nftLootCollection, materialTokensCollection } = await connectToMongo();

  // Pre-lock read: this only needs a wallet handle for getPublicKey/unlock-template
  // estimation (no UTXO ops), so it's safe outside the serialized queue. Same
  // singleton wallet the queue itself uses.
  const serverWallet = await getServerWallet();
  const ordinalP2PKH = new OrdinalsP2PKH();

  // Parse payment transaction
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

  // Parse batch transfer BEEF once — all material outputs live in this tx
  const batchTransferTransaction = Transaction.fromBEEF(decodeBeef(batchTransferBeef));

  // Derive the server key all materials were locked to (shared N2)
  const expectedServerKey = transferNonce
    ? (await serverWallet.getPublicKey({
        protocolID: TOKEN_PROTOCOL,
        keyID: transferNonce,
        counterparty: userIdentityKey,
        forSelf: true,
      })).publicKey
    : await getServerPublicKey(); // legacy fallback
  // OrdinalsP2PKH embeds hash160(pubkey), not raw pubkey hex
  const expectedScriptPattern = new P2PKH().lock(Hash.hash160(expectedServerKey, 'hex')).toHex();

  // Validate each transferred material output
  for (const material of transferredMaterials) {
    const vout = parseInt(material.tokenId.split('.')[1]);
    const transferOutput = batchTransferTransaction.outputs[vout];

    if (!transferOutput) {
      res.status(404).json({ error: `Transfer output not found: ${material.tokenId}` });
      return;
    }

    if (!transferOutput.lockingScript.toHex().includes(expectedScriptPattern)) {
      res.status(400).json({ error: `Material ${material.lootTableId} not locked to server derived key` });
      return;
    }
  }

  // Calculate material change amounts
  const materialChanges: Array<{
    lootTableId: string;
    itemName: string;
    description: string;
    icon: string;
    rarity: string;
    tier: number;
    changeAmount: number;
  }> = [];

  for (const material of transferredMaterials) {
    if (material.quantity > material.quantityNeeded) {
      materialChanges.push({
        lootTableId: material.lootTableId,
        itemName: material.itemName,
        description: material.description,
        icon: material.icon,
        rarity: material.rarity,
        tier: material.tier,
        changeAmount: material.quantity - material.quantityNeeded,
      });
    } else if (material.quantity < material.quantityNeeded) {
      res.status(400).json({
        error: `Insufficient ${material.lootTableId}: need ${material.quantityNeeded}, have ${material.quantity}`,
      });
      return;
    }
  }

  // Metadata for the crafted item — no wallet needed, built pre-lock so it's
  // available both inside the queue (locking script) and after it (DB write).
  const craftedItemMetadata = {
    name: 'game_item',
    itemName: outputItem.name,
    description: outputItem.description,
    icon: outputItem.icon,
    rarity: outputItem.rarity,
    itemType: outputItem.type,
    tier: outputItem.tier || 1,
    stats: outputItem.equipmentStats || {},
    crafted: outputItem.crafted || null,
    enhancements: { prefix: null, suffix: null },
    visual: { borderGradient: outputItem.borderGradient },
    acquiredFrom: null,
    craftingProof: {
      recipeId,
      materialTokens: transferredMaterials.map((m: { tokenId: string }) => m.tokenId),
    },
  };

  // Both dependent wallet actions (mint the crafted item, then transfer it +
  // material change to the user) run as ONE serialized unit through the wallet queue.
  const result = await (await getWalletQueue()).enqueue('craft', async (serverWallet) => {
    // Mint crafted item to a server self-derived key.

    const mintNonce = generateNonce();
    const craftedKey = await deriveSelfKey(serverWallet, mintNonce);
    const craftedItemLockingScript = ordinalP2PKH.lock(craftedKey, '', craftedItemMetadata, 'deploy+mint', 1);

    const craftedItemMintActionRes = await serverWallet.createAction({
      description: 'Minting crafted item with user WalletP2PKH payment',
      inputBEEF: paymentBeef,
      inputs: [{
        inputDescription: 'User WalletP2PKH payment for fees',
        outpoint: paymentOutpoint,
        unlockingScriptLength: walletP2pkhUnlockingLength,
      }],
      outputs: [{
        outputDescription: 'Crafted item (self-derived key)',
        lockingScript: craftedItemLockingScript.toHex(),
        satoshis: 1,
      }],
      options: { randomizeOutputs: false, acceptDelayedBroadcast: false },
    });

    if (!craftedItemMintActionRes.signableTransaction) {
      throw new Error('Failed to create signable crafted item mint transaction');
    }

    const craftedItemMintReference = craftedItemMintActionRes.signableTransaction.reference;
    const craftedItemTxToSign = Transaction.fromBEEF(craftedItemMintActionRes.signableTransaction.tx);

    craftedItemTxToSign.inputs[0].unlockingScriptTemplate = walletP2pkhUnlockTemplate;
    craftedItemTxToSign.inputs[0].sourceTransaction = paymentTransaction;
    await craftedItemTxToSign.sign();

    const craftedItemUnlockingScript = craftedItemTxToSign.inputs[0].unlockingScript;
    if (!craftedItemUnlockingScript) throw new Error('Missing unlocking script after signing crafted item');

    const craftedItemMintAction = await serverWallet.signAction({
      reference: craftedItemMintReference,
      spends: { '0': { unlockingScript: craftedItemUnlockingScript.toHex() } },
    });

    if (!craftedItemMintAction.tx) throw new Error('Failed to sign crafted item mint action');

    const craftedItemTx = Transaction.fromAtomicBEEF(craftedItemMintAction.tx);
    const craftedItemBroadcast = await broadcastTX(craftedItemTx);
    const craftedItemTxId = craftedItemBroadcast.txid!;
    const craftedItemOutpoint = `${craftedItemTxId}.0`;

    // Transfer tx: [materials + crafted item] → [crafted item to user + change tokens to user]

    const serverIdentityKey = await getServerIdentityPublicKey();

    // Shared unlock template for all transferred materials (N2)
    const materialsUnlockTemplate = ordinalP2PKH.unlock(
      serverWallet, 'all', false, undefined, undefined,
      transferNonce
        ? { protocolID: TOKEN_PROTOCOL, keyID: transferNonce, counterparty: userIdentityKey }
        : undefined,
    );
    const materialsUnlockLength = await materialsUnlockTemplate.estimateLength();

    // Separate unlock template for crafted item (mintNonce, self)
    const craftedUnlockTemplate = ordinalP2PKH.unlock(
      serverWallet, 'all', false, undefined, undefined,
      { protocolID: TOKEN_PROTOCOL, keyID: mintNonce, counterparty: 'self' },
    );
    const craftedUnlockLength = await craftedUnlockTemplate.estimateLength();

    // Build inputs: all materials first, then crafted item
    const transferInputs: any[] = [];
    for (const material of transferredMaterials) {
      transferInputs.push({
        inputDescription: `Material: ${material.lootTableId}`,
        outpoint: material.tokenId,
        unlockingScriptLength: materialsUnlockLength,
      });
    }
    transferInputs.push({
      inputDescription: 'Crafted item',
      outpoint: craftedItemOutpoint,
      unlockingScriptLength: craftedUnlockLength,
    });

    // Build outputs: crafted item (index 0) then change tokens (indices 1, 2, ...)
    const transferOutputs: any[] = [];

    // Crafted item → user (unique nonce N3_item)
    const itemNonce = generateNonce();
    const itemKey = await deriveRecipientKey(serverWallet, userIdentityKey, itemNonce);
    const craftedAssetId = craftedItemOutpoint.replace('.', '_');
    transferOutputs.push({
      outputDescription: 'Crafted item to user',
      lockingScript: ordinalP2PKH.lock(itemKey, craftedAssetId, craftedItemMetadata, 'transfer', 1).toHex(),
      satoshis: 1,
    });

    // Change tokens → user (unique nonce per change)
    const changeNonces: string[] = [];
    for (const change of materialChanges) {
      const changeNonce = generateNonce();
      changeNonces.push(changeNonce);
      const changeKey = await deriveRecipientKey(serverWallet, userIdentityKey, changeNonce);
      const originalMaterial = transferredMaterials.find((m: { lootTableId: string }) => m.lootTableId === change.lootTableId)!;
      const changeAssetId = originalMaterial.tokenId.replace('.', '_');
      transferOutputs.push({
        outputDescription: `Material change: ${change.lootTableId}`,
        lockingScript: ordinalP2PKH.lock(
          changeKey,
          changeAssetId,
          {
            name: 'material_token',
            lootTableId: change.lootTableId,
            itemName: change.itemName,
            description: change.description,
            icon: change.icon,
            rarity: change.rarity,
            tier: change.tier,
          },
          'transfer',
          change.changeAmount,
        ).toHex(),
        satoshis: 1,
      });
    }

    // Merge BEEFs for all inputs
    const mergedBeef = new Beef();
    mergedBeef.mergeBeef(batchTransferTransaction.toBEEF());
    mergedBeef.mergeBeef(craftedItemTx.toBEEF());
    const inputBEEF = mergedBeef.toBinary();

    const transferActionRes = await serverWallet.createAction({
      description: 'Transferring crafted item and material changes to user',
      inputBEEF,
      inputs: transferInputs,
      outputs: transferOutputs,
      options: { randomizeOutputs: false, acceptDelayedBroadcast: false },
    });

    if (!transferActionRes.signableTransaction) {
      throw new Error('Failed to create signable transfer transaction');
    }

    const reference = transferActionRes.signableTransaction.reference;
    const txToSign = Transaction.fromBEEF(transferActionRes.signableTransaction.tx);

    // Apply unlock templates: materials use shared template, crafted item uses its own
    const materialInputCount = transferredMaterials.length;
    if (!Number.isSafeInteger(materialInputCount) || materialInputCount < 0) {
      throw new Error('Invalid material input count');
    }
    if (materialInputCount >= txToSign.inputs.length) {
      throw new Error('Crafted input index out of range');
    }

    for (let i = 0; i < materialInputCount; i++) {
      txToSign.inputs[i].unlockingScriptTemplate = materialsUnlockTemplate;
      txToSign.inputs[i].sourceTransaction = batchTransferTransaction;
    }

    const craftedInputIndex = materialInputCount;
    txToSign.inputs[craftedInputIndex].unlockingScriptTemplate = craftedUnlockTemplate;
    txToSign.inputs[craftedInputIndex].sourceTransaction = craftedItemTx;

    await txToSign.sign();

    const spends: Record<string, any> = {};
    for (let i = 0; i < txToSign.inputs.length; i++) {
      const unlockingScript = txToSign.inputs[i].unlockingScript;
      if (!unlockingScript) throw new Error(`Missing unlocking script for input ${i}`);
      spends[String(i)] = { unlockingScript: unlockingScript.toHex() };
    }

    const transferAction = await serverWallet.signAction({ reference, spends });

    if (!transferAction.tx) throw new Error('Failed to sign transfer action');

    const transferTx = Transaction.fromAtomicBEEF(transferAction.tx);
    const transferBroadcast = await broadcastTX(transferTx);
    const transferTxId = transferBroadcast.txid!;

    return {
      transferActionTx: transferAction.tx,
      transferTxId,
      craftedItemOutpoint,
      itemNonce,
      changeNonces,
      serverIdentityKey,
    };
  });

  // Update database (after the enqueue resolved — the mint + transfer are already
  // broadcast on-chain by this point).

  const userCraftedTokenId = `${result.transferTxId}.0`;

  // NFTLoot doc for crafted item (carries keyId/counterparty for wallet internalization)
  const nftLootDoc = {
    lootTableId: outputItem.lootTableId,
    name: outputItem.name,
    description: outputItem.description,
    icon: outputItem.icon,
    rarity: outputItem.rarity,
    type: outputItem.type,
    attributes: craftedItemMetadata,
    mintOutpoint: result.craftedItemOutpoint,
    tokenId: userCraftedTokenId,
    keyId: result.itemNonce,
    counterparty: result.serverIdentityKey,
    createdAt: new Date(),
  };

  const nftResult = await nftLootCollection.insertOne(nftLootDoc);
  const nftLootId = nftResult.insertedId.toString();

  // Calculate rolled stats for equipment
  let rolledStats: Record<string, number> | undefined;
  if (outputItem.crafted && outputItem.crafted.statRoll && outputItem.equipmentStats) {
    const statRoll = outputItem.crafted.statRoll;
    rolledStats = {};
    for (const [stat, value] of Object.entries(outputItem.equipmentStats)) {
      if (typeof value === 'number') {
        rolledStats[stat] = stat === 'autoClickRate'
          ? Math.round(value * statRoll * 100) / 100
          : Math.round(value * statRoll);
      }
    }
  }

  // UserInventory entry for crafted item
  const inventoryDoc: any = {
    userId,
    lootTableId: outputItem.lootTableId,
    itemType: outputItem.type,
    tier: outputItem.tier || 1,
    borderGradient: outputItem.borderGradient,
    nftLootId: nftResult.insertedId,
    mintOutpoint: result.craftedItemOutpoint,
    tokenId: userCraftedTokenId,
    keyId: result.itemNonce,
    counterparty: result.serverIdentityKey,
    acquiredAt: new Date(),
    crafted: true,
    statRoll: outputItem.crafted?.statRoll,
    rolledStats,
    updatedAt: new Date(),
  };

  await userInventoryCollection.insertOne(inventoryDoc);

  // Handle material token updates/deletions
  const lootTableIdsWithChange = new Set(materialChanges.map((c) => c.lootTableId));

  // Delete fully consumed material tokens
  const fullyConsumedMaterials = transferredMaterials.filter(
    (m: { lootTableId: string }) => !lootTableIdsWithChange.has(m.lootTableId),
  );
  for (const material of fullyConsumedMaterials) {
    await materialTokensCollection.deleteOne({ userId, lootTableId: material.lootTableId });
  }

  // Update change tokens with new outpoint + keyId/counterparty
  const materialChangeTokens: Array<{ lootTableId: string; tokenId: string; quantity: number }> = [];

  for (let i = 0; i < materialChanges.length; i++) {
    const change = materialChanges[i];
    const changeTokenId = `${result.transferTxId}.${i + 1}`; // output 0 = crafted item
    const changeNonce = result.changeNonces[i];
    const originalMaterial = transferredMaterials.find(
      (m: { lootTableId: string }) => m.lootTableId === change.lootTableId,
    )!;

    materialChangeTokens.push({ lootTableId: change.lootTableId, tokenId: changeTokenId, quantity: change.changeAmount });

    await materialTokensCollection.updateOne(
      { userId, lootTableId: change.lootTableId },
      {
        $set: {
          tokenId: changeTokenId,
          quantity: change.changeAmount,
          keyId: changeNonce,
          counterparty: result.serverIdentityKey,
          updatedAt: new Date(),
        },
        $push: {
          updateHistory: {
            operation: 'subtract',
            previousQuantity: originalMaterial.quantity,
            newQuantity: change.changeAmount,
            transactionId: result.transferTxId,
            reason: `Consumed in crafting recipe: ${recipeId}`,
            timestamp: new Date(),
          },
        },
      },
    );
  }

  // Build received[] aligned to transfer tx output indices
  const received: Array<{ outputIndex: number; keyId: string; counterparty: string; tags: string[] }> = [
    { outputIndex: 0, keyId: result.itemNonce, counterparty: result.serverIdentityKey, tags: ['type:item'] },
  ];
  for (let i = 0; i < materialChanges.length; i++) {
    received.push({
      outputIndex: i + 1,
      keyId: result.changeNonces[i],
      counterparty: result.serverIdentityKey,
      tags: ['type:material'],
    });
  }

  res.json({
    success: true,
    nftId: nftLootId,
    tokenId: userCraftedTokenId,
    transferTransactionId: result.transferTxId,
    materialChangeTokens,
    transferBeef: encodeBeef(Array.from(result.transferActionTx as Uint8Array)),
    received,
  });
});

// Rerolls stat quality on crafted equipment using a Refine Stone.
// 1. Validate both items exist and belong to user
// 2. Validate target is crafted equipment with statRoll
// 3. Validate refine stone is actually a refine_stone
// 4. Generate new stat roll (0.8-1.2)
// 5. Recalculate rolledStats
// 6. Delete refine stone
// 7. Update target item
// 8. Return new stats
craftingRouter.post('/refine', requireAuthProof('refine'), async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    const { targetItemId, refineStoneId } = req.body;

    if (!targetItemId || !refineStoneId) {
      res.status(400).json({ error: 'Target item ID and refine stone ID required' });
      return;
    }

    // Convert string IDs to ObjectIds
    let targetObjectId: ObjectId;
    let refineStoneObjectId: ObjectId;
    try {
      targetObjectId = new ObjectId(targetItemId);
      refineStoneObjectId = new ObjectId(refineStoneId);
    } catch (error) {
      res.status(400).json({ error: 'Invalid item IDs' });
      return;
    }

    const { userInventoryCollection } = await connectToMongo();

    // Start MongoDB transaction
    const client = await getClient();
    const session = client.startSession();

    try {
      let result;

      await session.withTransaction(async () => {
        // Fetch both items from inventory
        const [targetItem, refineStone] = await Promise.all([
          userInventoryCollection.findOne({ _id: targetObjectId, userId }, { session }),
          userInventoryCollection.findOne({ _id: refineStoneObjectId, userId }, { session }),
        ]);

        // Validate target item exists
        if (!targetItem) {
          throw new Error('Target item not found or does not belong to you');
        }

        // Validate refine stone exists
        if (!refineStone) {
          throw new Error('Refine stone not found or does not belong to you');
        }

        // Validate refine stone is actually a refine_stone
        if (refineStone.lootTableId !== 'refine_stone') {
          throw new Error('Selected item is not a Refine Stone');
        }

        // Validate target is crafted equipment
        if (!targetItem.crafted) {
          throw new Error('Target item is not crafted equipment');
        }

        if (targetItem.statRoll === undefined) {
          throw new Error('Target item does not have a stat roll to refine');
        }

        // Get loot item template for target
        const targetLootItem = getLootItemById(targetItem.lootTableId);
        if (!targetLootItem || !targetLootItem.equipmentStats) {
          throw new Error('Target item has no equipment stats');
        }

        // Generate new stat roll (0.8 to 1.2)
        const rolledStatRoll = 0.8 + Math.random() * 0.4;
        const oldStatRoll = targetItem.statRoll;

        // If new roll is higher, use it. Otherwise, add +0.01 to current roll
        // This ensures guaranteed progress even with bad luck
        let finalStatRoll: number;
        let wasUpgraded: boolean;

        if (rolledStatRoll > oldStatRoll) {
          // Good roll - use the new higher value
          finalStatRoll = Math.min(1.2, rolledStatRoll); // Cap at max 1.2
          wasUpgraded = true;
        } else {
          // Bad roll - add +0.01 instead
          finalStatRoll = Math.min(1.2, oldStatRoll + 0.01); // Cap at max 1.2
          wasUpgraded = finalStatRoll > oldStatRoll; // Only true if not already at cap
        }

        // Recalculate rolledStats with final stat roll
        const finalRolledStats = {
          damageBonus: targetLootItem.equipmentStats.damageBonus !== undefined
            ? Math.round(targetLootItem.equipmentStats.damageBonus * finalStatRoll)
            : undefined,
          critChance: targetLootItem.equipmentStats.critChance !== undefined
            ? Math.round(targetLootItem.equipmentStats.critChance * finalStatRoll)
            : undefined,
          defense: targetLootItem.equipmentStats.defense !== undefined
            ? Math.round(targetLootItem.equipmentStats.defense * finalStatRoll)
            : undefined,
          maxHpBonus: targetLootItem.equipmentStats.maxHpBonus !== undefined
            ? Math.round(targetLootItem.equipmentStats.maxHpBonus * finalStatRoll)
            : undefined,
          attackSpeed: targetLootItem.equipmentStats.attackSpeed !== undefined
            ? Math.round(targetLootItem.equipmentStats.attackSpeed * finalStatRoll)
            : undefined,
          coinBonus: targetLootItem.equipmentStats.coinBonus !== undefined
            ? Math.round(targetLootItem.equipmentStats.coinBonus * finalStatRoll)
            : undefined,
          healBonus: targetLootItem.equipmentStats.healBonus !== undefined
            ? Math.round(targetLootItem.equipmentStats.healBonus * finalStatRoll)
            : undefined,
          lifesteal: targetLootItem.equipmentStats.lifesteal !== undefined
            ? Math.round(targetLootItem.equipmentStats.lifesteal * finalStatRoll)
            : undefined,
          defensiveLifesteal: targetLootItem.equipmentStats.defensiveLifesteal !== undefined
            ? Math.round(targetLootItem.equipmentStats.defensiveLifesteal * finalStatRoll)
            : undefined,
          thorns: targetLootItem.equipmentStats.thorns !== undefined
            ? Math.round(targetLootItem.equipmentStats.thorns * finalStatRoll)
            : undefined,
          autoClickRate: targetLootItem.equipmentStats.autoClickRate !== undefined
            ? Math.round(targetLootItem.equipmentStats.autoClickRate * finalStatRoll * 100) / 100 // Preserve decimals
            : undefined,
          fireResistance: targetLootItem.equipmentStats.fireResistance !== undefined
            ? Math.round(targetLootItem.equipmentStats.fireResistance * finalStatRoll)
            : undefined,
          poisonResistance: targetLootItem.equipmentStats.poisonResistance !== undefined
            ? Math.round(targetLootItem.equipmentStats.poisonResistance * finalStatRoll)
            : undefined,
          bleedResistance: targetLootItem.equipmentStats.bleedResistance !== undefined
            ? Math.round(targetLootItem.equipmentStats.bleedResistance * finalStatRoll)
            : undefined,
        };

        // Delete refine stone from inventory
        await userInventoryCollection.deleteOne(
          { _id: refineStoneObjectId },
          { session },
        );

        // Update target item with final statRoll and rolledStats (only if upgraded)
        if (wasUpgraded) {
          await userInventoryCollection.updateOne(
            { _id: targetObjectId },
            {
              $set: {
                statRoll: finalStatRoll,
                rolledStats: finalRolledStats,
              },
            },
            { session },
          );
        }

        result = {
          success: true,
          targetItem: {
            _id: targetItemId,
            name: targetLootItem.name,
          },
          oldStatRoll: oldStatRoll,
          rolledStatRoll: rolledStatRoll,
          finalStatRoll: finalStatRoll,
          wasUpgraded: wasUpgraded,
          newRolledStats: wasUpgraded ? finalRolledStats : targetItem.rolledStats,
        };
      });

      res.json(result);
      return;
    } catch (error: any) {
      console.error('Error refining item:', error);
      res.status(500).json({ error: error.message || 'Failed to refine item' });
      return;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Error in refining route:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});
