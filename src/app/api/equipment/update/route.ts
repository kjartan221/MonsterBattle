/**
 * Server-Side Equipment Update with Inscription Scroll
 *
 * This route handles applying inscription scrolls to equipment using the transfer-to-server pattern:
 *
 * CLIENT TRANSACTIONS:
 *   - Transfer 1: User transfers equipment token to server
 *   - Transfer 2: User transfers inscription scroll token to server
 *   - Payment: WalletP2PKH payment for fees
 *
 * SERVER TRANSACTION:
 *   - Input 0: Transferred equipment token (server unlocks)
 *   - Input 1: Transferred scroll token (server unlocks)
 *   - Input 2: Payment token (server unlocks with WalletP2PKH)
 *   - Output 0: Updated equipment token (transferred back to user)
 *
 * This architecture:
 * - Server has full control during operation
 * - Proper on-chain provenance for equipment updates
 * - Scroll consumption verified on-chain
 * - Clean transaction structure
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
      inscriptionScrollInventoryId,
      inscriptionScrollTokenId,
      transferredEquipmentTokenId,
      transferredEquipmentTransactionId,
      transferredScrollTokenId,
      transferredScrollTransactionId,
      equipmentData,
      scrollData,
      inscriptionType,
      updatedPrefix,
      updatedSuffix,
      userPublicKey,
      paymentTx,
      walletParams,
    } = body;

    // Validate required fields
    if (!originalEquipmentInventoryId || !inscriptionScrollInventoryId || !transferredEquipmentTokenId || !transferredScrollTokenId || !userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // 4. Verify user owns both the equipment and scroll
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

    // 5. Get server wallet
    const serverWallet = await getServerWallet();
    const ordinalP2PKH = new OrdinalsP2PKH();

    // 6. Parse and validate payment transaction
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

    console.log('Server updating equipment:', {
      equipmentName: equipmentData.name,
      scrollName: scrollData.name,
      inscriptionType,
      transferredEquipmentTokenId,
      transferredScrollTokenId,
      userId,
      paymentAmount: paymentOutput.satoshis,
    });

    // ========================================
    // STEP 1: Validate transferred tokens
    // ========================================

    // Fetch equipment transfer transaction
    const equipmentTransferTxData = await getTransactionByTxID(transferredEquipmentTransactionId);
    if (!equipmentTransferTxData || !equipmentTransferTxData.outputs || !equipmentTransferTxData.outputs[0] || !equipmentTransferTxData.outputs[0].beef) {
      return NextResponse.json(
        { error: `Could not find equipment transfer transaction: ${transferredEquipmentTransactionId}` },
        { status: 404 }
      );
    }

    const equipmentTransferTransaction = Transaction.fromBEEF(equipmentTransferTxData.outputs[0].beef);

    // Fetch scroll transfer transaction
    const scrollTransferTxData = await getTransactionByTxID(transferredScrollTransactionId);
    if (!scrollTransferTxData || !scrollTransferTxData.outputs || !scrollTransferTxData.outputs[0] || !scrollTransferTxData.outputs[0].beef) {
      return NextResponse.json(
        { error: `Could not find scroll transfer transaction: ${transferredScrollTransactionId}` },
        { status: 404 }
      );
    }

    const scrollTransferTransaction = Transaction.fromBEEF(scrollTransferTxData.outputs[0].beef);

    console.log('✅ [VALIDATE] Transferred tokens validated');

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

    console.log('🔀 [UPDATE] Creating update transaction:', {
      input0: transferredEquipmentTokenId,
      input1: transferredScrollTokenId,
      input2: paymentOutpoint,
      output0: 'Updated equipment to user',
    });

    // Merge BEEFs for multiple inputs
    const mergedBeef = new Beef();
    mergedBeef.mergeBeef(equipmentTransferTransaction.toBEEF());
    mergedBeef.mergeBeef(scrollTransferTransaction.toBEEF());
    mergedBeef.mergeBeef(paymentTransaction.toBEEF());
    const inputBEEF = mergedBeef.toBinary();

    // Create update transaction with 3 inputs → 1 output
    const updateActionRes = await serverWallet.createAction({
      description: "Updating equipment with inscription scroll",
      inputBEEF,
      inputs: [
        {
          inputDescription: "Transferred equipment token",
          outpoint: transferredEquipmentTokenId,
          unlockingScriptLength,
        },
        {
          inputDescription: "Transferred scroll token",
          outpoint: transferredScrollTokenId,
          unlockingScriptLength,
        },
        {
          inputDescription: "User WalletP2PKH payment for fees",
          outpoint: paymentOutpoint,
          unlockingScriptLength: walletP2pkhUnlockingLength,
        },
      ],
      outputs: [{
        outputDescription: "Updated equipment back to user",
        lockingScript: updatedEquipmentLockingScript.toHex(),
        satoshis: 1,
      }],
      options: { randomizeOutputs: false },
    });

    if (!updateActionRes.signableTransaction) {
      throw new Error('Failed to create signable update transaction');
    }

    // Sign the update transaction
    const reference = updateActionRes.signableTransaction.reference;
    const txToSign = Transaction.fromBEEF(updateActionRes.signableTransaction.tx);

    // Add unlocking script templates for all inputs
    txToSign.inputs[0].unlockingScriptTemplate = unlockTemplate;
    txToSign.inputs[0].sourceTransaction = equipmentTransferTransaction;
    txToSign.inputs[1].unlockingScriptTemplate = unlockTemplate;
    txToSign.inputs[1].sourceTransaction = scrollTransferTransaction;
    txToSign.inputs[2].unlockingScriptTemplate = walletP2pkhUnlockTemplate;
    txToSign.inputs[2].sourceTransaction = paymentTransaction;

    await txToSign.sign();

    // Extract unlocking scripts
    const unlockingScript0 = txToSign.inputs[0].unlockingScript;
    const unlockingScript1 = txToSign.inputs[1].unlockingScript;
    const unlockingScript2 = txToSign.inputs[2].unlockingScript;

    if (!unlockingScript0 || !unlockingScript1 || !unlockingScript2) {
      throw new Error('Missing unlocking scripts after signing');
    }

    // Sign the action with actual unlocking scripts
    const updateAction = await serverWallet.signAction({
      reference,
      spends: {
        '0': { unlockingScript: unlockingScript0.toHex() },
        '1': { unlockingScript: unlockingScript1.toHex() },
        '2': { unlockingScript: unlockingScript2.toHex() },
      },
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

    // Create new UserInventory entry for updated equipment
    const newInventoryEntry = {
      userId: userId,
      lootTableId: equipmentData.lootTableId,
      itemType: equipmentData.type,
      nftLootId: nftResult.insertedId,
      mintOutpoint: originalNFTLoot?.mintOutpoint, // Preserve original mint proof
      tokenId: updatedEquipmentTokenId,             // Current location after update
      transactionId: updateTxId,
      tier: equipmentData.tier,
      borderGradient: equipmentData.borderGradient,
      prefix: updatedPrefix,
      suffix: updatedSuffix,
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
            newTokenId: updatedEquipmentTokenId,
            transactionId: updateTxId,
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
            equipmentTokenId: updatedEquipmentTokenId,
            transactionId: updateTxId,
          }
        }
      }
    );

    console.log('✅ [DATABASE] Updated equipment documents');

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
