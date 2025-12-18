/**
 * Server-Side Mint and Transfer Flow
 *
 * This replaces client-side minting with a secure server-controlled flow:
 * 1. Validate user owns the items (loot drop, crafting materials, etc.)
 * 2. Server wallet mints the item (server is source of truth)
 * 3. Store mintOutpoint in NFTLoot table (proof of legitimate mint)
 * 4. Server immediately transfers to user's public key
 * 5. Store transferTransactionId in NFTLoot table
 *
 * This prevents fraudulent items and fixes SIGHASH complexities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { getServerWallet, getServerPublicKey } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { Transaction } from '@bsv/sdk';
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
      inventoryItemId,  // UserInventory document ID (validate ownership)
      itemData,         // Full item metadata for minting
      userPublicKey,    // User's public key for transfer
    } = body;

    // Validate required fields
    if (!inventoryItemId || !itemData || !userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 3. Connect to MongoDB and validate ownership
    const { userInventoryCollection, nftLootCollection } = await connectToMongo();
    const inventoryItem = await userInventoryCollection.findOne({
      _id: new ObjectId(inventoryItemId),
      userId: userId,
    });

    if (!inventoryItem) {
      return NextResponse.json(
        { error: 'Item not found or not owned by user' },
        { status: 404 }
      );
    }

    // Check if already minted
    if (inventoryItem.nftLootId) {
      return NextResponse.json(
        { error: 'Item already minted' },
        { status: 400 }
      );
    }

    // 4. Get server wallet
    const serverWallet = await getServerWallet();
    const serverPublicKey = await getServerPublicKey();

    console.log('Server minting item:', {
      itemName: itemData.name,
      userId,
      serverPublicKey,
    });

    // 5. STEP 1: Server mints the item
    const ordinalP2PKH = new OrdinalsP2PKH();
    const mintLockingScript = ordinalP2PKH.lock(
      serverPublicKey,
      '',                // Empty for new mint
      itemData,          // Full item metadata
      'deploy+mint'
    );

    console.log('🔨 [MINT] Creating mint locking script:', {
      operation: 'deploy+mint',
      publicKey: serverPublicKey,
      itemName: itemData.itemName || itemData.name,
      scriptLength: mintLockingScript.toHex().length,
      scriptHex: mintLockingScript.toHex(),
    });

    const mintAction = await serverWallet.createAction({
      description: "Server minting item NFT",
      outputs: [
        {
          outputDescription: "New NFT item",
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

    console.log('📦 [MINT] Transaction structure before broadcast:', {
      txid: mintTx.id('hex'),
      inputs: mintTx.inputs.length,
      outputs: mintTx.outputs.length,
      outputSatoshis: mintTx.outputs.map(o => o.satoshis),
      txHex: mintTx.toHex(),
    });

    const mintBroadcast = await broadcastTX(mintTx);
    const mintTxId = mintBroadcast.txid;

    if (!mintTxId) {
      throw new Error('Failed to get transaction ID from broadcast');
    }

    const mintOutpoint = `${mintTxId}.0`;

    console.log('✅ [MINT] Server minted item:', {
      mintTxId,
      mintOutpoint,
      broadcastResponse: mintBroadcast
    });

    // 6. STEP 2: Server immediately transfers to user
    // Fetch the mint transaction for spending
    const mintTxData = await getTransactionByTxID(mintTxId);

    if (!mintTxData || !mintTxData.outputs || !mintTxData.outputs[0] || !mintTxData.outputs[0].beef) {
      throw new Error(`Could not find mint transaction: ${mintTxId}`);
    }

    const mintTransaction = Transaction.fromBEEF(mintTxData.outputs[0].beef!);

    console.log('🔓 [TRANSFER] Creating unlocking script for mint output:', {
      mintOutpoint,
      sighashType: 'single',
    });

    // Create unlocking script for server wallet
    const unlockTemplate = ordinalP2PKH.unlock(serverWallet, "single", true);
    const unlockingScript = await unlockTemplate.sign(mintTransaction, 0);

    console.log('🔓 [TRANSFER] Unlocking script created:', {
      scriptLength: unlockingScript.toHex().length,
      scriptHex: unlockingScript.toHex(),
    });

    // Create transfer locking script to user
    const assetId = mintOutpoint.replace('.', '_'); // BSV-21 format
    const transferLockingScript = ordinalP2PKH.lock(
      userPublicKey,     // Lock to user's public key
      assetId,           // Reference the mint
      { ...itemData, serverMinted: true, mintedBy: 'server' },
      'transfer'
    );

    console.log('🔒 [TRANSFER] Creating transfer locking script:', {
      operation: 'transfer',
      assetId,
      userPublicKey: userPublicKey,
      scriptLength: transferLockingScript.toHex().length,
      scriptHex: transferLockingScript.toHex(),
    });

    const transferAction = await serverWallet.createAction({
      description: "Transferring minted item to user",
      inputBEEF: mintTxData.outputs[0].beef,
      inputs: [
        {
          inputDescription: "Server minted item",
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

    console.log('📦 [TRANSFER] Transaction structure before broadcast:', {
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

    console.log('✅ [TRANSFER] Transferred to user:', {
      transferTxId,
      userTokenId,
      broadcastResponse: transferBroadcast
    });

    // 7. Create NFTLoot document with mint proof
    const nftLootDoc = {
      lootTableId: inventoryItem.lootTableId,
      name: itemData.name || itemData.itemName,
      description: itemData.description,
      icon: itemData.icon,
      rarity: itemData.rarity,
      type: inventoryItem.itemType,
      attributes: itemData,
      mintOutpoint: mintOutpoint,          // Full outpoint: ${mintTxId}.0
      createdAt: new Date(),
    };

    const nftResult = await nftLootCollection.insertOne(nftLootDoc);
    const nftLootId = nftResult.insertedId.toString();

    // 8. Update UserInventory with NFT reference
    await userInventoryCollection.updateOne(
      { _id: new ObjectId(inventoryItemId) },
      {
        $set: {
          nftLootId: nftResult.insertedId,
          tokenId: userTokenId,
          updatedAt: new Date(),
        }
      }
    );

    return NextResponse.json({
      success: true,
      nftId: nftLootId,
      tokenId: userTokenId,      // Full outpoint: ${transferTxId}.0
      mintOutpoint: mintOutpoint, // Full outpoint: ${mintTxId}.0
    });

  } catch (error) {
    console.error('Mint and transfer error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mint and transfer item' },
      { status: 500 }
    );
  }
}
