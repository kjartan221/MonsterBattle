/**
 * Server-Side Equipment Update with Inscription Scrolls (Batched)
 *
 * This route handles applying inscription scrolls to equipment using the batched transfer-to-server pattern:
 *
 * CLIENT TRANSACTION:
 *   - Single batched transfer: equipment + scroll(s) → server (much cheaper!)
 *   - Payment: WalletP2PKH payment for fees
 *
 * SERVER TRANSACTION:
 *   - Input 0: Transferred equipment token (server unlocks)
 *   - Input 1+: Transferred scroll token(s) (server unlocks)
 *   - Input N: Payment token (server unlocks with WalletP2PKH)
 *   - Output 0: Updated equipment token (transferred back to user)
 *
 * This architecture:
 * - Batched transfers = cheaper transaction fees
 * - Server has full control during operation
 * - Proper on-chain provenance for equipment updates
 * - Scroll consumption verified on-chain
 * - Clean transaction structure
 * - Supports applying multiple scrolls at once (prefix + suffix)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyJWT } from '@/utils/jwt';
import { Transaction, Beef } from '@bsv/sdk';
import { WalletP2PKH } from '@bsv/wallet-helper';
import { getServerWallet } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { broadcastTX, getTransactionByTxID } from '@/utils/overlayFunctions';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify JWT and get user
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

    // 2. Parse request body
    const body = await request.json();
    const {
      originalEquipmentInventoryId,
      originalEquipmentTokenId,
      inscriptionScrollInventoryIds,    // Array of scroll inventory IDs
      inscriptionScrollTokenIds,        // Array of scroll token IDs
      transferredEquipmentTokenId,
      transferredScrollTokenIds,        // Array of transferred scroll token IDs
      batchTransferTransactionId,       // Single transaction ID for batch transfer
      equipmentData,
      scrollsData,                      // Array of scroll inscription data
      updatedPrefix,
      updatedSuffix,
      userPublicKey,
      paymentTx,
      walletParams,
    } = body;

    // Validate required fields
    if (!originalEquipmentInventoryId || !inscriptionScrollInventoryIds || !transferredEquipmentTokenId || !transferredScrollTokenIds || !userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(inscriptionScrollInventoryIds) || inscriptionScrollInventoryIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one inscription scroll required' },
        { status: 400 }
      );
    }

    if (inscriptionScrollInventoryIds.length > 2) {
      return NextResponse.json(
        { error: 'Maximum 2 inscription scrolls allowed (prefix + suffix)' },
        { status: 400 }
      );
    }

    if (!paymentTx) {
      return NextResponse.json(
        { error: 'Missing payment transaction' },
        { status: 400 }
      );
    }

    if (!walletParams || !walletParams.protocolID || !walletParams.keyID || !walletParams.counterparty) {
      return NextResponse.json(
        { error: 'Missing wallet derivation parameters' },
        { status: 400 }
      );
    }

    // 3. Connect to MongoDB
    const { userInventoryCollection, nftLootCollection } = await connectToMongo();

    // 4. Verify user owns the equipment
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

    // 5. Verify user owns all scrolls
    const scrollInventoryIds = inscriptionScrollInventoryIds.map(id => new ObjectId(id));
    const inscriptionScrolls = await userInventoryCollection
      .find({
        _id: { $in: scrollInventoryIds },
        userId: userId,
      })
      .toArray();

    if (inscriptionScrolls.length !== inscriptionScrollInventoryIds.length) {
      return NextResponse.json(
        { error: 'One or more inscription scrolls not found or not owned by user' },
        { status: 404 }
      );
    }

    // 6. Get server wallet
    const serverWallet = await getServerWallet();
    const ordinalP2PKH = new OrdinalsP2PKH();

    // 7. Parse and validate payment transaction
    const paymentTransaction = Transaction.fromBEEF(paymentTx);
    const paymentTxId = paymentTransaction.id('hex');

    console.log('📥 [PAYMENT] Received WalletP2PKH payment transaction:', {
      txid: paymentTxId,
      walletParams,
    });

    // Validate payment amount
    const paymentOutput = paymentTransaction.outputs[0];
    if (!paymentOutput || !paymentOutput.satoshis || paymentOutput.satoshis < 100) {
      return NextResponse.json(
        { error: 'Invalid payment: must be at least 100 satoshis' },
        { status: 400 }
      );
    }

    const paymentOutpoint = `${paymentTxId}.0`;

    // Create WalletP2PKH unlocking script template
    const walletp2pkh = new WalletP2PKH(serverWallet);
    const walletP2pkhUnlockTemplate = walletp2pkh.unlock({
      protocolID: walletParams.protocolID,
      keyID: walletParams.keyID,
      counterparty: walletParams.counterparty,
    });
    const walletP2pkhUnlockingLength = await walletP2pkhUnlockTemplate.estimateLength();

    console.log('🔓 [PAYMENT] Created WalletP2PKH unlock template:', {
      unlockingScriptLength: walletP2pkhUnlockingLength,
      paymentOutpoint,
      paymentAmount: paymentOutput.satoshis,
    });

    console.log('Server updating equipment (batched):', {
      equipmentName: equipmentData.name,
      scrollCount: inscriptionScrollInventoryIds.length,
      scrollNames: scrollsData.map((s: any) => s.name),
      transferredEquipmentTokenId,
      transferredScrollTokenIds,
      batchTransferTransactionId,
      userId,
      paymentAmount: paymentOutput.satoshis,
    });

    // ========================================
    // STEP 1: Validate batched transfer transaction
    // ========================================

    // Fetch the single batched transfer transaction
    const batchTransferTxData = await getTransactionByTxID(batchTransferTransactionId);
    if (!batchTransferTxData || !batchTransferTxData.outputs || !batchTransferTxData.outputs[0] || !batchTransferTxData.outputs[0].beef) {
      return NextResponse.json(
        { error: `Could not find batch transfer transaction: ${batchTransferTransactionId}` },
        { status: 404 }
      );
    }

    const batchTransferTransaction = Transaction.fromBEEF(batchTransferTxData.outputs[0].beef);

    console.log('✅ [VALIDATE] Batch transfer transaction validated:', {
      txid: batchTransferTransactionId,
      outputs: batchTransferTransaction.outputs.length,
    });

    // ========================================
    // STEP 2: Create update transaction
    // ========================================

    // Create unlocking script template for ordinal tokens
    const unlockTemplate = ordinalP2PKH.unlock(serverWallet, "all", false);
    const unlockingScriptLength = await unlockTemplate.estimateLength();

    // Prepare updated equipment metadata
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
      enhancements: {
        prefix: updatedPrefix,
        suffix: updatedSuffix,
      },
      visual: {
        borderGradient: equipmentData.borderGradient,
      },
    };

    // Reference the original equipment token (not the transferred one)
    const assetId = originalEquipmentTokenId.replace('.', '_');

    const updatedEquipmentLockingScript = ordinalP2PKH.lock(
      userPublicKey,
      assetId,
      updatedEquipmentMetadata,
      'transfer'
    );

    // Build inputs array: equipment + scrolls + payment
    const inputs = [
      {
        inputDescription: "Transferred equipment token",
        outpoint: transferredEquipmentTokenId,
        unlockingScriptLength,
      },
    ];

    // Add scroll inputs
    for (let i = 0; i < transferredScrollTokenIds.length; i++) {
      inputs.push({
        inputDescription: `Transferred scroll token ${i + 1}`,
        outpoint: transferredScrollTokenIds[i],
        unlockingScriptLength,
      });
    }

    // Add payment input
    inputs.push({
      inputDescription: "User WalletP2PKH payment for fees",
      outpoint: paymentOutpoint,
      unlockingScriptLength: walletP2pkhUnlockingLength,
    });

    console.log('🔀 [UPDATE] Creating update transaction:', {
      inputCount: inputs.length,
      equipment: transferredEquipmentTokenId,
      scrolls: transferredScrollTokenIds,
      payment: paymentOutpoint,
      output: 'Updated equipment to user',
    });

    // Merge BEEFs for multiple inputs
    const mergedBeef = new Beef();
    mergedBeef.mergeBeef(batchTransferTransaction.toBEEF());
    mergedBeef.mergeBeef(paymentTransaction.toBEEF());
    const inputBEEF = mergedBeef.toBinary();

    // Create update transaction: N inputs → 1 output
    const updateActionRes = await serverWallet.createAction({
      description: `Updating equipment with ${inscriptionScrollInventoryIds.length} inscription scroll(s)`,
      inputBEEF,
      inputs,
      outputs: [{
        outputDescription: "Updated equipment back to user",
        lockingScript: updatedEquipmentLockingScript.toHex(),
        satoshis: 1,
      }],
      options: {
        randomizeOutputs: false,
        acceptDelayedBroadcast: false,
      },
    });

    if (!updateActionRes.signableTransaction) {
      throw new Error('Failed to create signable update transaction');
    }

    // Sign the update transaction
    const reference = updateActionRes.signableTransaction.reference;
    const txToSign = Transaction.fromBEEF(updateActionRes.signableTransaction.tx);

    // Add unlocking script templates for all inputs
    // Inputs 0 to N-2: Equipment and scrolls (use ordinal unlock template)
    for (let i = 0; i < inputs.length - 1; i++) {
      txToSign.inputs[i].unlockingScriptTemplate = unlockTemplate;
      txToSign.inputs[i].sourceTransaction = batchTransferTransaction;
    }

    // Input N-1: Payment (use WalletP2PKH unlock template)
    const paymentInputIndex = inputs.length - 1;
    txToSign.inputs[paymentInputIndex].unlockingScriptTemplate = walletP2pkhUnlockTemplate;
    txToSign.inputs[paymentInputIndex].sourceTransaction = paymentTransaction;

    await txToSign.sign();

    // Extract unlocking scripts
    const spends: Record<string, any> = {};
    for (let i = 0; i < inputs.length; i++) {
      const unlockingScript = txToSign.inputs[i].unlockingScript;
      if (!unlockingScript) {
        throw new Error(`Missing unlocking script for input ${i}`);
      }
      spends[String(i)] = { unlockingScript: unlockingScript.toHex() };
    }

    const updateAction = await serverWallet.signAction({
      reference,
      spends,
    });

    if (!updateAction.tx) {
      throw new Error('Failed to sign update action');
    }

    const updateTx = Transaction.fromAtomicBEEF(updateAction.tx);
    const updateBroadcast = await broadcastTX(updateTx);
    const updateTxId = updateBroadcast.txid!;
    const updatedEquipmentTokenId = `${updateTxId}.0`;

    console.log(`✅ [UPDATE] Updated equipment: ${updatedEquipmentTokenId}`);

    // ========================================
    // STEP 3: Update database
    // ========================================

    // Fetch original NFTLoot to preserve mint proof
    const originalNFTLoot = await nftLootCollection.findOne({
      _id: originalEquipment.nftLootId
    });

    // Create new NFTLoot document for updated equipment
    const updatedEquipmentDoc = {
      lootTableId: equipmentData.lootTableId,
      name: equipmentData.name,
      description: equipmentData.description,
      icon: equipmentData.icon,
      rarity: equipmentData.rarity,
      type: equipmentData.type,
      attributes: {
        ...updatedEquipmentMetadata,
        borderGradient: equipmentData.borderGradient,
      },
      mintOutpoint: originalNFTLoot?.mintOutpoint,  // Preserve original mint proof
      tokenId: updatedEquipmentTokenId,              // Current location after update
      userId: userId,
      createdAt: new Date(),
    };

    const nftResult = await nftLootCollection.insertOne(updatedEquipmentDoc);
    const nftId = nftResult.insertedId.toString();

    // Create new UserInventory entry for updated equipment (preserve ALL original fields)
    const newInventoryEntry = {
      userId: userId,
      lootTableId: equipmentData.lootTableId,
      itemType: equipmentData.type,
      nftLootId: nftResult.insertedId,
      mintOutpoint: originalNFTLoot?.mintOutpoint, // Preserve original mint proof
      tokenId: updatedEquipmentTokenId,             // Current location after update
      transactionId: updateTxId,
      tier: equipmentData.tier || originalEquipment.tier,
      borderGradient: equipmentData.borderGradient || originalEquipment.borderGradient,
      prefix: updatedPrefix,
      suffix: updatedSuffix,
      acquiredAt: new Date(),
      fromMonsterId: originalEquipment.fromMonsterId,
      fromSessionId: originalEquipment.fromSessionId,
      updatedFrom: originalEquipmentInventoryId,
      // Preserve crafting data if present
      crafted: originalEquipment.crafted,
      statRoll: originalEquipment.statRoll,
      // Preserve empowered status if present
      isEmpowered: originalEquipment.isEmpowered,
      // Preserve any other custom fields
      enhanced: originalEquipment.enhanced,
    };

    const inventoryResult = await userInventoryCollection.insertOne(newInventoryEntry);

    // Delete original equipment (provenance is on-chain and in Overlay system)
    await userInventoryCollection.deleteOne(
      { _id: new ObjectId(originalEquipmentInventoryId) }
    );

    // Delete all consumed inscription scrolls (provenance is on-chain and in Overlay system)
    for (const scrollInventoryId of inscriptionScrollInventoryIds) {
      await userInventoryCollection.deleteOne(
        { _id: new ObjectId(scrollInventoryId), userId }
      );
    }

    console.log('✅ [DATABASE] Updated equipment documents:', {
      deletedScrolls: inscriptionScrollInventoryIds.length,
      newInventoryItemId: inventoryResult.insertedId.toString(),
    });

    return NextResponse.json({
      success: true,
      nftId: nftId,
      tokenId: updatedEquipmentTokenId,
      transactionId: updateTxId,
      newInventoryItemId: inventoryResult.insertedId.toString(),
    });

  } catch (error) {
    console.error('Equipment update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update equipment' },
      { status: 500 }
    );
  }
}
