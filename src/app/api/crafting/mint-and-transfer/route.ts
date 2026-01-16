/**
 * Server-Side Crafting: Transfer-to-Server Pattern
 *
 * This route handles crafting using the transfer-to-server pattern:
 *
 * CLIENT TRANSACTIONS (user → server):
 *   - For each material: Transfer token to server (amt=quantity, locked to server pubkey)
 *
 * SERVER TRANSACTION 1 (mint crafted item):
 *   - No inputs (coinbase-style)
 *   - Output: Crafted item (amt=1, owned by server)
 *
 * SERVER TRANSACTION 2 (transfer all to user):
 *   - Inputs: All transferred materials + crafted item (server unlocks)
 *   - Outputs: Crafted item to user + material change tokens to user (with reduced amt)
 *
 * This architecture:
 * - Server has full control during operation
 * - Proper BSV-20 amt field usage for materials
 * - Material changes reuse original tokens (no unnecessary mints)
 * - Maintains token provenance chain
 * - Clean on-chain provenance
 * - Simpler than auth-based pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { getServerWallet, getServerPublicKey } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { Transaction, P2PKH, Beef } from '@bsv/sdk';
import { WalletP2PKH } from '@bsv/wallet-helper';
import { ObjectId } from 'mongodb';
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
      recipeId,
      transferredMaterials,  // Array of {lootTableId, tokenId, transactionId, quantity, quantityNeeded, ...}
      inputItems,
      outputItem,
      userPublicKey,
      paymentTx,        // User's payment transaction BEEF (WalletP2PKH locked)
      walletParams,     // Wallet derivation params for unlocking { protocolID, keyID, counterparty }
    } = body;

    // Validate required fields
    if (!transferredMaterials || !Array.isArray(transferredMaterials) || transferredMaterials.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid transferredMaterials' },
        { status: 400 }
      );
    }

    if (!outputItem || !userPublicKey) {
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
    const { userInventoryCollection, nftLootCollection, materialTokensCollection } = await connectToMongo();

    // 4. Get server wallet and public key
    const serverWallet = await getServerWallet();
    const serverPublicKey = await getServerPublicKey();
    const ordinalP2PKH = new OrdinalsP2PKH();

    // 5. Parse and validate payment transaction
    const paymentTransaction = Transaction.fromBEEF(paymentTx);
    const paymentTxId = paymentTransaction.id('hex');

    console.log('📥 [PAYMENT] Received WalletP2PKH payment transaction:', {
      txid: paymentTxId,
      walletParams,
    });

    console.log('📥 [PAYMENT] Parsed payment transaction:', {
      txid: paymentTxId,
      inputs: paymentTransaction.inputs.length,
      outputs: paymentTransaction.outputs.length,
      output0Satoshis: paymentTransaction.outputs[0]?.satoshis,
      output0Script: paymentTransaction.outputs[0]?.lockingScript.toHex(),
    });

    // Find output locked to server with WalletP2PKH (should be output 0)
    const paymentOutput = paymentTransaction.outputs[0];
    if (!paymentOutput || !paymentOutput.satoshis || paymentOutput.satoshis < 100) {
      return NextResponse.json(
        { error: 'Invalid payment: must be at least 100 satoshis' },
        { status: 400 }
      );
    }

    const paymentOutpoint = `${paymentTxId}.0`;

    // Create WalletP2PKH unlocking script template using wallet params from client
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
      protocolID: walletParams.protocolID,
      keyID: walletParams.keyID,
      counterparty: walletParams.counterparty,
    });

    console.log('Server crafting with transfer-to-server:', {
      recipeId,
      materialCount: transferredMaterials.length,
      outputName: outputItem.name,
      userId,
      paymentAmount: paymentOutput.satoshis,
      paymentOutpoint,
    });

    // ========================================
    // STEP 1: Validate transferred material tokens
    // ========================================

    for (const material of transferredMaterials) {
      const transferTxData = await getTransactionByTxID(material.transactionId);

      if (!transferTxData || !transferTxData.outputs || !transferTxData.outputs[0] || !transferTxData.outputs[0].beef) {
        return NextResponse.json(
          { error: `Could not find transfer transaction: ${material.transactionId}` },
          { status: 404 }
        );
      }

      const transferTransaction = Transaction.fromBEEF(transferTxData.outputs[0].beef);

      // Verify transferred output is locked to server public key
      const transferOutputIndex = parseInt(material.tokenId.split('.')[1]);
      const transferOutput = transferTransaction.outputs[transferOutputIndex];

      if (!transferOutput) {
        return NextResponse.json(
          { error: `Transfer output not found: ${material.tokenId}` },
          { status: 404 }
        );
      }

      // Extract the P2PKH portion to validate public key
      const transferScriptHex = transferOutput.lockingScript.toHex();
      const expectedScriptPattern = new P2PKH().lock(serverPublicKey).toHex();

      console.log('🔍 [VALIDATE] Validating transferred material:', {
        lootTableId: material.lootTableId,
        tokenId: material.tokenId,
        containsExpectedP2PKH: transferScriptHex.includes(expectedScriptPattern),
      });

      if (!transferScriptHex.includes(expectedScriptPattern)) {
        return NextResponse.json(
          { error: `Material ${material.lootTableId} not locked to server public key` },
          { status: 400 }
        );
      }
    }

    console.log('✅ [VALIDATE] All transferred materials validated');

    // ========================================
    // STEP 2: Calculate material consumption and change
    // ========================================

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
        const changeAmount = material.quantity - material.quantityNeeded;
        materialChanges.push({
          lootTableId: material.lootTableId,
          itemName: material.itemName,
          description: material.description,
          icon: material.icon,
          rarity: material.rarity,
          tier: material.tier,
          changeAmount,
        });
        console.log(`🔄 [CHANGE] Material ${material.lootTableId}: ${material.quantity} - ${material.quantityNeeded} = ${changeAmount} change`);
      } else if (material.quantity < material.quantityNeeded) {
        return NextResponse.json(
          { error: `Insufficient ${material.lootTableId}: need ${material.quantityNeeded}, have ${material.quantity}` },
          { status: 400 }
        );
      }
    }

    console.log(`✅ [CHANGE] Calculated material changes: ${materialChanges.length} materials need change`);

    // ========================================
    // STEP 3: Mint crafted item
    // ========================================

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
      enhancements: {
        prefix: null,
        suffix: null,
      },
      visual: {
        borderGradient: outputItem.borderGradient,
      },
      acquiredFrom: null,
      craftingProof: {
        recipeId,
        materialTokens: transferredMaterials.map(m => m.tokenId),
      }
    };

    console.log('🔨 [MINT-CRAFT] Minting crafted item with WalletP2PKH payment:', outputItem.name);

    const craftedItemLockingScript = ordinalP2PKH.lock(
      serverPublicKey,
      '',
      craftedItemMetadata,
      'deploy+mint',
      1  // Items always have amt=1
    );

    // Step 1: Call createAction with unlockingScriptLength
    const craftedItemMintActionRes = await serverWallet.createAction({
      description: "Minting crafted item with user WalletP2PKH payment",
      inputBEEF: paymentTx,
      inputs: [
        {
          inputDescription: "User WalletP2PKH payment for fees",
          outpoint: paymentOutpoint,
          unlockingScriptLength: walletP2pkhUnlockingLength,
        }
      ],
      outputs: [{
        outputDescription: "Crafted item",
        lockingScript: craftedItemLockingScript.toHex(),
        satoshis: 1,
      }],
      options: { randomizeOutputs: false },
    });

    if (!craftedItemMintActionRes.signableTransaction) {
      throw new Error('Failed to create signable crafted item mint transaction');
    }

    // Step 2: Extract signable transaction and sign it
    const craftedItemMintReference = craftedItemMintActionRes.signableTransaction.reference;
    const craftedItemTxToSign = Transaction.fromBEEF(craftedItemMintActionRes.signableTransaction.tx);

    // Add WalletP2PKH unlocking script template and source transaction
    craftedItemTxToSign.inputs[0].unlockingScriptTemplate = walletP2pkhUnlockTemplate;
    craftedItemTxToSign.inputs[0].sourceTransaction = paymentTransaction;

    // Sign the transaction
    await craftedItemTxToSign.sign();

    // Extract the unlocking script
    const craftedItemUnlockingScript = craftedItemTxToSign.inputs[0].unlockingScript;
    if (!craftedItemUnlockingScript) {
      throw new Error('Missing unlocking script after signing crafted item');
    }

    console.log('🔓 [MINT-CRAFT] Transaction signed, WalletP2PKH unlocking script generated:', {
      scriptLength: craftedItemUnlockingScript.toHex().length,
      scriptHex: craftedItemUnlockingScript.toHex(),
    });

    // Step 3: Sign the action with actual unlocking scripts
    const craftedItemMintAction = await serverWallet.signAction({
      reference: craftedItemMintReference,
      spends: {
        '0': { unlockingScript: craftedItemUnlockingScript.toHex() }
      }
    });

    if (!craftedItemMintAction.tx) {
      throw new Error('Failed to sign crafted item mint action');
    }

    const craftedItemTx = Transaction.fromAtomicBEEF(craftedItemMintAction.tx);
    const craftedItemBroadcast = await broadcastTX(craftedItemTx);
    const craftedItemTxId = craftedItemBroadcast.txid!;
    const craftedItemOutpoint = `${craftedItemTxId}.0`;

    console.log(`✅ [MINT-CRAFT] Minted crafted item with payment: ${craftedItemOutpoint}`);

    // ========================================
    // STEP 4: Prepare material change references (no new mints needed)
    // ========================================
    // We'll transfer the original material tokens back to the user with updated quantities
    // This is more efficient than minting new tokens and maintains provenance

    const changeOutpoints: Array<{
      lootTableId: string;
      outpoint: string;  // Original tokenId from transferredMaterials
      amount: number;
    }> = [];

    for (const change of materialChanges) {
      // Find the original transferred material
      const originalMaterial = transferredMaterials.find(m => m.lootTableId === change.lootTableId);
      if (!originalMaterial) {
        throw new Error(`Could not find original transferred material for ${change.lootTableId}`);
      }

      changeOutpoints.push({
        lootTableId: change.lootTableId,
        outpoint: originalMaterial.tokenId,  // Use original tokenId
        amount: change.changeAmount,
      });

      console.log(`🔄 [CHANGE] Will transfer original token back: ${change.lootTableId} (amt=${change.changeAmount})`);
    }

    // ========================================
    // STEP 5: Transfer all to user (crafted item + material changes with reduced amt)
    // ========================================

    console.log('🔀 [TRANSFER] Creating transfer transaction: Original materials + Crafted item → Crafted item + Changes to user');

    const unlockTemplate = ordinalP2PKH.unlock(serverWallet, "all", false);
    const unlockingScriptLength = await unlockTemplate.estimateLength();

    // Fetch all source transactions and build inputs array
    const sourceTransactions: Transaction[] = [];
    const inputs: any[] = [];

    // Add transferred material inputs
    for (const material of transferredMaterials) {
      const txData = await getTransactionByTxID(material.transactionId);
      if (!txData || !txData.outputs || !txData.outputs[0]) {
        throw new Error(`Could not find material transfer transaction: ${material.transactionId}`);
      }
      const tx = Transaction.fromBEEF(txData.outputs[0].beef);
      sourceTransactions.push(tx);
      inputs.push({
        inputDescription: `Material: ${material.lootTableId}`,
        outpoint: material.tokenId,
        unlockingScriptLength,
      });
    }

    // Add crafted item input
    const craftedItemTxData = await getTransactionByTxID(craftedItemTxId);
    if (!craftedItemTxData || !craftedItemTxData.outputs || !craftedItemTxData.outputs[0]) {
      throw new Error(`Could not find crafted item transaction: ${craftedItemTxId}`);
    }
    const craftedItemTransaction = Transaction.fromBEEF(craftedItemTxData.outputs[0].beef);
    sourceTransactions.push(craftedItemTransaction);
    inputs.push({
      inputDescription: "Crafted item",
      outpoint: craftedItemOutpoint,
      unlockingScriptLength,
    });

    // Note: Change token inputs are already included in transferredMaterials above
    // We don't need to add them again since we're transferring the original tokens back

    // Build outputs array (transfer to user)
    const outputs: any[] = [];

    // Output 1: Crafted item to user
    const craftedAssetId = craftedItemOutpoint.replace('.', '_');
    outputs.push({
      outputDescription: "Crafted item to user",
      lockingScript: ordinalP2PKH.lock(
        userPublicKey,
        craftedAssetId,
        { ...craftedItemMetadata, serverMinted: true },
        'transfer',
        1  // amt=1 for items
      ).toHex(),
      satoshis: 1,
    });

    // Outputs 2+: Material change tokens to user
    for (const change of changeOutpoints) {
      // Find the original transferred material to get its assetId
      const originalMaterial = transferredMaterials.find(m => m.lootTableId === change.lootTableId);
      if (!originalMaterial) {
        throw new Error(`Could not find original material for ${change.lootTableId}`);
      }

      // Extract assetId from the original material's tokenId
      // The tokenId is the outpoint from the previous transfer, which contains the assetId
      const changeAssetId = change.outpoint.replace('.', '_');

      outputs.push({
        outputDescription: `Material change: ${change.lootTableId}`,
        lockingScript: ordinalP2PKH.lock(
          userPublicKey,
          changeAssetId,
          {
            name: 'material_token',
            lootTableId: change.lootTableId,
            // Use original material metadata
            itemName: originalMaterial.itemName,
            description: originalMaterial.description,
            icon: originalMaterial.icon,
            rarity: originalMaterial.rarity,
            tier: originalMaterial.tier,
          },
          'transfer',
          change.amount  // Updated amt field with reduced quantity
        ).toHex(),
        satoshis: 1,
      });
    }

    // Merge BEEFs for multiple inputs
    const mergedBeef = new Beef();
    for (const tx of sourceTransactions) {
      mergedBeef.mergeBeef(tx.toBEEF());
    }
    const inputBEEF = mergedBeef.toBinary();

    // Create transfer transaction
    const transferActionRes = await serverWallet.createAction({
      description: "Transferring crafted item and changes to user",
      inputBEEF,
      inputs,
      outputs,
      options: { randomizeOutputs: false },
    });

    if (!transferActionRes.signableTransaction) {
      throw new Error('Failed to create signable transfer transaction');
    }

    // Sign with createAction → signAction flow
    const reference = transferActionRes.signableTransaction.reference;
    const txToSign = Transaction.fromBEEF(transferActionRes.signableTransaction.tx);

    // Add unlocking script templates for all inputs
    for (let i = 0; i < txToSign.inputs.length; i++) {
      txToSign.inputs[i].unlockingScriptTemplate = unlockTemplate;
      txToSign.inputs[i].sourceTransaction = sourceTransactions[i];
    }

    await txToSign.sign();

    // Extract unlocking scripts
    const spends: Record<string, any> = {};
    for (let i = 0; i < txToSign.inputs.length; i++) {
      const unlockingScript = txToSign.inputs[i].unlockingScript;
      if (!unlockingScript) {
        throw new Error(`Missing unlocking script for input ${i}`);
      }
      spends[String(i)] = { unlockingScript: unlockingScript.toHex() };
    }

    const transferAction = await serverWallet.signAction({
      reference,
      spends,
    });

    if (!transferAction.tx) {
      throw new Error('Failed to sign transfer action');
    }

    const transferTx = Transaction.fromAtomicBEEF(transferAction.tx);
    const transferBroadcast = await broadcastTX(transferTx);
    const transferTxId = transferBroadcast.txid!;

    console.log(`✅ [TRANSFER] Transferred crafted item + ${changeOutpoints.length} change tokens to user: ${transferTxId}`);

    // ========================================
    // STEP 6: Update database
    // ========================================

    // Create NFTLoot document for crafted item
    const nftLootDoc = {
      lootTableId: outputItem.lootTableId,
      name: outputItem.name,
      description: outputItem.description,
      icon: outputItem.icon,
      rarity: outputItem.rarity,
      type: outputItem.type,
      attributes: craftedItemMetadata,
      mintOutpoint: craftedItemOutpoint,  // Full outpoint: ${craftedItemTxId}.0
      createdAt: new Date(),
    };

    const nftResult = await nftLootCollection.insertOne(nftLootDoc);
    const nftLootId = nftResult.insertedId.toString();

    // Update UserInventory with NFT reference for crafted item
    const userCraftedTokenId = `${transferTxId}.0`;
    await userInventoryCollection.updateOne(
      { _id: new ObjectId(outputItem.inventoryItemId) },
      {
        $set: {
          nftLootId: nftResult.insertedId,
          tokenId: userCraftedTokenId,
          updatedAt: new Date(),
        }
      }
    );

    // Create/update MaterialToken documents for change tokens
    const materialChangeTokens: Array<{
      lootTableId: string;
      tokenId: string;
      quantity: number;
    }> = [];

    for (let i = 0; i < changeOutpoints.length; i++) {
      const change = changeOutpoints[i];
      const changeTokenId = `${transferTxId}.${i + 1}`;  // Output indices: 0=crafted item, 1+=changes

      materialChangeTokens.push({
        lootTableId: change.lootTableId,
        tokenId: changeTokenId,
        quantity: change.amount,
      });

      // Find original material to get full metadata
      const originalMaterial = transferredMaterials.find(m => m.lootTableId === change.lootTableId);
      if (!originalMaterial) {
        throw new Error(`Could not find original material for ${change.lootTableId}`);
      }

      // Update existing MaterialToken document with new change token
      await materialTokensCollection.updateOne(
        { userId, lootTableId: change.lootTableId },
        {
          $set: {
            tokenId: changeTokenId,
            quantity: change.amount,
            updatedAt: new Date(),
          },
          $push: {
            updateHistory: {
              operation: 'subtract',
              previousQuantity: originalMaterial.quantity,
              newQuantity: change.amount,
              transactionId: transferTxId,
              reason: `Consumed in crafting recipe: ${recipeId}`,
              timestamp: new Date(),
            },
          },
        }
      );
    }

    // Mark consumed input items as consumed
    if (inputItems && Array.isArray(inputItems)) {
      for (const input of inputItems) {
        if (input.inventoryItemId) {
          await userInventoryCollection.updateOne(
            { _id: new ObjectId(input.inventoryItemId), userId },
            {
              $set: {
                consumed: true,
                consumedAt: new Date(),
                consumedInRecipe: recipeId,
                consumptionTxId: transferTxId,
              }
            }
          );
        }
      }
    }

    console.log('✅ [DATABASE] Updated all database documents');

    return NextResponse.json({
      success: true,
      nftId: nftLootId,
      tokenId: userCraftedTokenId,       // Full outpoint: ${transferTxId}.0
      transferTransactionId: transferTxId,
      materialChangeTokens,              // Array of {lootTableId, tokenId, quantity}
    });

  } catch (error) {
    console.error('Crafting mint and transfer error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to craft item' },
      { status: 500 }
    );
  }
}
