/**
 * Server-Side Crafting: Auth-Linked Mint and Transfer
 *
 * This route receives an auth outpoint from the client's material consumption transaction
 * and uses it to mint a crafted item, creating a provable on-chain link:
 *
 * CLIENT TRANSACTION (materials → auth):
 *   - Inputs: Material tokens
 *   - Outputs: Material change + Auth output (locked to server)
 *
 * SERVER TRANSACTION (auth → crafted item):
 *   - Input: Auth output (proves link to material consumption)
 *   - Outputs: Minted crafted item + Transfer to user
 *
 * This architecture:
 * - Proves on-chain link between materials and crafted item
 * - Server validates auth output before minting
 * - Prevents fraudulent crafted items
 * - Client controls material consumption, server controls minting
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { getServerWallet, getServerPublicKey } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { Transaction, P2PKH } from '@bsv/sdk';
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
      authOutpoint,          // Auth output from client material consumption
      consumptionTxId,
      materialChanges,
      inputItems,
      outputItem,
      userPublicKey,
    } = body;

    // Validate required fields
    if (!authOutpoint || !outputItem || !userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 3. Connect to MongoDB
    const { userInventoryCollection, nftLootCollection, materialTokensCollection } = await connectToMongo();

    // 4. Get server wallet and public key
    const serverWallet = await getServerWallet();
    const serverPublicKey = await getServerPublicKey();
    const ordinalP2PKH = new OrdinalsP2PKH();

    console.log('Server crafting with auth link:', {
      recipeId,
      authOutpoint,
      consumptionTxId,
      outputName: outputItem.name,
      userId,
    });

    // ========================================
    // Validate and unlock auth output
    // ========================================

    // Fetch auth transaction
    const authTxid = authOutpoint.split('.')[0];
    const authOutputIndex = parseInt(authOutpoint.split('.')[1]);
    const authTxData = await getTransactionByTxID(authTxid);

    if (!authTxData || !authTxData.outputs || !authTxData.outputs[0] || !authTxData.outputs[0].beef) {
      return NextResponse.json(
        { error: `Could not find auth transaction: ${authTxid}` },
        { status: 404 }
      );
    }

    const authTransaction = Transaction.fromBEEF(authTxData.outputs[0].beef);

    // Verify auth output is locked to server public key
    const authOutput = authTransaction.outputs[authOutputIndex];
    if (!authOutput) {
      return NextResponse.json(
        { error: 'Auth output not found' },
        { status: 404 }
      );
    }

    // Extract the P2PKH portion (without the metadata) to validate public key
    // OrdinalP2PKH format: OP_FALSE OP_RETURN [metadata] [P2PKH script]
    const authScriptHex = authOutput.lockingScript.toHex();
    const expectedScriptPattern = new P2PKH().lock(serverPublicKey).toHex();

    console.log('🔍 [AUTH-VALIDATE] Validating auth output:', {
      authOutpoint,
      authOutputSatoshis: authOutput.satoshis,
      actualLockingScript: authScriptHex,
      containsExpectedP2PKH: authScriptHex.includes(expectedScriptPattern),
      authScriptLength: authScriptHex.length,
    });

    // Validate that the auth output contains the server's P2PKH script
    if (!authScriptHex.includes(expectedScriptPattern)) {
      return NextResponse.json(
        { error: 'Auth output not locked to server public key' },
        { status: 400 }
      );
    }

    console.log('✅ [AUTH-VALIDATE] Auth output validated:', authOutpoint);

    // Create unlocking script for auth output using OrdinalP2PKH
    console.log('🔓 [AUTH-UNLOCK] Creating unlocking script for auth output:', {
      authOutpoint,
      sighashType: 'single',
    });

    const authUnlockTemplate = ordinalP2PKH.unlock(serverWallet, "single");
    const authUnlockingScript = await authUnlockTemplate.sign(authTransaction, authOutputIndex);

    console.log('🔓 [AUTH-UNLOCK] Auth unlocking script created:', {
      scriptLength: authUnlockingScript.toHex().length,
      scriptHex: authUnlockingScript.toHex(),
    });

    // ========================================
    // Mint crafted item using auth input
    // ========================================

    // Prepare crafted item metadata
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
        consumptionTxId,
        authOutpoint,
        recipeId,
      }
    };

    console.log('🔨 [MINT-CRAFT] Minting crafted item with auth link:', outputItem.name);

    // Create minting locking script
    const mintLockingScript = ordinalP2PKH.lock(
      serverPublicKey,
      '',
      craftedItemMetadata,
      'deploy+mint'
    );

    console.log('🔨 [MINT-CRAFT] Creating mint locking script:', {
      operation: 'deploy+mint',
      publicKey: serverPublicKey,
      itemName: outputItem.name,
      authOutpoint,
      scriptLength: mintLockingScript.toHex().length,
      scriptHex: mintLockingScript.toHex(),
    });

    // Create mint transaction using auth output as input
    const mintAction = await serverWallet.createAction({
      description: "Server minting crafted item with auth link",
      inputBEEF: authTxData.outputs[0].beef,
      inputs: [
        {
          inputDescription: "Auth output from material consumption",
          outpoint: authOutpoint,
          unlockingScript: authUnlockingScript.toHex(),
        }
      ],
      outputs: [
        {
          outputDescription: "Minted crafted item",
          lockingScript: mintLockingScript.toHex(),
          satoshis: 1,
        }
      ],
      options: {
        randomizeOutputs: false,
      }
    });

    if (!mintAction.tx) {
      throw new Error('Failed to create mint transaction');
    }

    // Broadcast mint transaction
    const mintTx = Transaction.fromAtomicBEEF(mintAction.tx);

    console.log('📦 [MINT-CRAFT] Transaction structure before broadcast:', {
      txid: mintTx.id('hex'),
      inputs: mintTx.inputs.length,
      outputs: mintTx.outputs.length,
      inputOutpoints: mintTx.inputs.map(i => `${i.sourceTXID}.${i.sourceOutputIndex}`),
      outputSatoshis: mintTx.outputs.map(o => o.satoshis),
      txHex: mintTx.toHex(),
    });

    const mintBroadcast = await broadcastTX(mintTx);
    const mintTxId = mintBroadcast.txid;

    if (!mintTxId) {
      throw new Error('Failed to get transaction ID from broadcast');
    }

    const mintOutpoint = `${mintTxId}.0`;

    console.log('✅ [MINT-CRAFT] Server minted crafted item:', {
      mintTxId,
      mintOutpoint,
      broadcastResponse: mintBroadcast
    });

    // ========================================
    // Transfer crafted item to user
    // ========================================

    const mintTxData = await getTransactionByTxID(mintTxId);

    if (!mintTxData || !mintTxData.outputs || !mintTxData.outputs[0] || !mintTxData.outputs[0].beef) {
      throw new Error(`Could not find mint transaction: ${mintTxId}`);
    }

    const mintTransaction = Transaction.fromBEEF(mintTxData.outputs[0].beef!);

    // Create unlocking script for server wallet
    console.log('🔓 [TRANSFER-CRAFT] Creating unlocking script for crafted item:', {
      mintOutpoint,
      sighashType: 'single',
    });

    const unlockTemplate = ordinalP2PKH.unlock(serverWallet, "single");
    const unlockingScript = await unlockTemplate.sign(mintTransaction, 0);

    console.log('🔓 [TRANSFER-CRAFT] Unlocking script created:', {
      scriptLength: unlockingScript.toHex().length,
      scriptHex: unlockingScript.toHex(),
    });

    // Create transfer locking script to user
    const assetId = mintOutpoint.replace('.', '_');
    const transferLockingScript = ordinalP2PKH.lock(
      userPublicKey,
      assetId,
      { ...craftedItemMetadata, serverMinted: true, mintedBy: 'server' },
      'transfer'
    );

    console.log('🔒 [TRANSFER-CRAFT] Creating transfer locking script:', {
      operation: 'transfer',
      assetId,
      userPublicKey: userPublicKey,
      itemName: outputItem.name,
      scriptLength: transferLockingScript.toHex().length,
      scriptHex: transferLockingScript.toHex(),
    });

    const transferAction = await serverWallet.createAction({
      description: "Transferring crafted item to user",
      inputBEEF: mintTxData.outputs[0].beef,
      inputs: [
        {
          inputDescription: "Server minted crafted item",
          outpoint: mintOutpoint,
          unlockingScript: unlockingScript.toHex(),
        }
      ],
      outputs: [
        {
          outputDescription: "Transfer to user",
          lockingScript: transferLockingScript.toHex(),
          satoshis: 1,
        }
      ],
      options: {
        randomizeOutputs: false,
      }
    });

    if (!transferAction.tx) {
      throw new Error('Failed to create transfer transaction');
    }

    // Broadcast transfer transaction
    const transferTx = Transaction.fromAtomicBEEF(transferAction.tx);

    console.log('📦 [TRANSFER-CRAFT] Transaction structure before broadcast:', {
      txid: transferTx.id('hex'),
      inputs: transferTx.inputs.length,
      outputs: transferTx.outputs.length,
      inputOutpoints: transferTx.inputs.map(i => `${i.sourceTXID}.${i.sourceOutputIndex}`),
      outputSatoshis: transferTx.outputs.map(o => o.satoshis),
      txHex: transferTx.toHex(),
    });

    const transferBroadcast = await broadcastTX(transferTx);
    const transferTxId = transferBroadcast.txid;
    const userTokenId = `${transferTxId}.0`;

    console.log('✅ [TRANSFER-CRAFT] Transferred crafted item to user:', {
      transferTxId,
      userTokenId,
      itemName: outputItem.name,
      broadcastResponse: transferBroadcast
    });

    // ========================================
    // Update database
    // ========================================

    // Update material tokens with new tokenIds from client transaction
    if (materialChanges && Array.isArray(materialChanges)) {
      for (const change of materialChanges) {
        await materialTokensCollection.updateOne(
          { userId, tokenId: change.previousTokenId },
          {
            $set: {
              tokenId: change.newTokenId,  // Full outpoint: ${consumptionTxId}.${index}
              quantity: change.newQuantity,
              updatedAt: new Date(),
            }
          }
        );
      }
    }

    // Create NFTLoot document for crafted item
    const nftLootDoc = {
      lootTableId: outputItem.lootTableId,
      name: outputItem.name,
      description: outputItem.description,
      icon: outputItem.icon,
      rarity: outputItem.rarity,
      type: outputItem.type,
      attributes: craftedItemMetadata,
      mintOutpoint: mintOutpoint,  // Full outpoint: ${mintTxId}.0
      createdAt: new Date(),
    };

    const nftResult = await nftLootCollection.insertOne(nftLootDoc);
    const nftLootId = nftResult.insertedId.toString();

    // Update UserInventory with NFT reference
    await userInventoryCollection.updateOne(
      { _id: new ObjectId(outputItem.inventoryItemId) },
      {
        $set: {
          nftLootId: nftResult.insertedId,
          tokenId: userTokenId,
          updatedAt: new Date(),
        }
      }
    );

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
                consumptionTxId: consumptionTxId,
              }
            }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      nftId: nftLootId,
      tokenId: userTokenId,       // Full outpoint: ${transferTxId}.0
      mintOutpoint: mintOutpoint,  // Full outpoint: ${mintTxId}.0
      authOutpoint: authOutpoint,  // Full outpoint: ${consumptionTxId}.${index}
    });

  } catch (error) {
    console.error('Crafting mint and transfer error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to craft item' },
      { status: 500 }
    );
  }
}
