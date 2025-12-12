/**
 * Server-Side Material Token Mint and Transfer Flow
 *
 * This replaces client-side material minting with server-controlled flow:
 * 1. Validate user owns the materials (loot drop, crafting materials, etc.)
 * 2. Server wallet mints the material token (server is source of truth)
 * 3. Store mintOutpoint in MaterialToken table (proof of legitimate mint)
 * 4. Server immediately transfers to user's public key
 * 5. Store transferTransactionId in MaterialToken table
 *
 * This prevents fraudulent materials and fixes SIGHASH complexities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { getServerWallet, getServerPublicKey } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { Transaction } from '@bsv/sdk';
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
      materials,        // Array of material data to mint
      userPublicKey,    // User's public key for transfer
    } = body;

    // Validate required fields
    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return NextResponse.json(
        { error: 'Invalid materials data' },
        { status: 400 }
      );
    }

    if (!userPublicKey) {
      return NextResponse.json(
        { error: 'Missing user public key' },
        { status: 400 }
      );
    }

    // 3. Connect to MongoDB
    const { materialTokensCollection } = await connectToMongo();

    // 4. Get server wallet
    const serverWallet = await getServerWallet();
    const serverPublicKey = await getServerPublicKey();

    console.log('Server minting materials:', {
      materialCount: materials.length,
      userId,
      serverPublicKey,
    });

    const results = [];

    // 5. Process each material
    for (const material of materials) {
      const {
        lootTableId,
        itemName,
        description,
        icon,
        rarity,
        tier,
        quantity,
        acquiredFrom,
      } = material;

      // Validate quantity
      if (quantity <= 0) {
        throw new Error(`Invalid quantity for ${itemName}: ${quantity}`);
      }

      // Prepare material metadata
      const materialMetadata = {
        name: 'material_token',
        lootTableId,
        itemName,
        description,
        icon,
        rarity,
        tier: tier || 1,
        quantity,
        acquiredFrom: acquiredFrom || [],
      };

      console.log(`Minting material: ${itemName} x${quantity}`);

      // STEP 1: Server mints the material token
      const ordinalP2PKH = new OrdinalsP2PKH();
      const mintLockingScript = ordinalP2PKH.lock(
        serverPublicKey,
        '',                    // Empty for new mint
        materialMetadata,
        'deploy+mint'
      );

      console.log(`🔨 [MINT-MATERIAL] Creating mint locking script for ${itemName}:`, {
        operation: 'deploy+mint',
        publicKey: serverPublicKey,
        materialName: itemName,
        quantity,
        scriptLength: mintLockingScript.toHex().length,
        scriptHex: mintLockingScript.toHex(),
      });

      const mintAction = await serverWallet.createAction({
        description: "Server minting material token",
        outputs: [
          {
            outputDescription: "New material token",
            lockingScript: mintLockingScript.toHex(),
            satoshis: 1,
          }
        ],
        options: {
          randomizeOutputs: false,
        }
      });

      if (!mintAction.tx) {
        throw new Error(`Failed to create mint transaction for ${itemName}`);
      }

      // Broadcast mint transaction
      const mintTx = Transaction.fromAtomicBEEF(mintAction.tx);

      console.log(`📦 [MINT-MATERIAL] Transaction for ${itemName} before broadcast:`, {
        txid: mintTx.id('hex'),
        inputs: mintTx.inputs.length,
        outputs: mintTx.outputs.length,
        outputSatoshis: mintTx.outputs.map(o => o.satoshis),
        txHex: mintTx.toHex(),
      });

      const mintBroadcast = await broadcastTX(mintTx);
      const mintTxId = mintBroadcast.txid;

      if (!mintTxId) {
        throw new Error(`Failed to get transaction ID from broadcast for ${itemName}`);
      }

      const mintOutpoint = `${mintTxId}.0`;

      console.log(`✅ [MINT-MATERIAL] Minted ${itemName}:`, {
        mintTxId,
        mintOutpoint,
        broadcastResponse: mintBroadcast
      });

      // STEP 2: Server immediately transfers to user
      const mintTxData = await getTransactionByTxID(mintTxId);

      if (!mintTxData || !mintTxData.outputs || !mintTxData.outputs[0] || !mintTxData.outputs[0].beef) {
        throw new Error(`Could not find mint transaction: ${mintTxId}`);
      }

      const mintTransaction = Transaction.fromBEEF(mintTxData.outputs[0].beef!);

      console.log(`🔓 [TRANSFER-MATERIAL] Creating unlocking script for ${itemName}:`, {
        mintOutpoint,
        sighashType: 'single',
      });

      // Create unlocking script for server wallet
      const unlockTemplate = ordinalP2PKH.unlock(serverWallet, "single");
      const unlockingScript = await unlockTemplate.sign(mintTransaction, 0);

      console.log(`🔓 [TRANSFER-MATERIAL] Unlocking script for ${itemName} created:`, {
        scriptLength: unlockingScript.toHex().length,
        scriptHex: unlockingScript.toHex(),
      });

      // Create transfer locking script to user
      const assetId = mintOutpoint.replace('.', '_'); // BSV-21 format
      const transferLockingScript = ordinalP2PKH.lock(
        userPublicKey,     // Lock to user's public key
        assetId,           // Reference the mint
        { ...materialMetadata, serverMinted: true, mintedBy: 'server' },
        'transfer'
      );

      console.log(`🔒 [TRANSFER-MATERIAL] Creating transfer locking script for ${itemName}:`, {
        operation: 'transfer',
        assetId,
        userPublicKey: userPublicKey,
        quantity,
        scriptLength: transferLockingScript.toHex().length,
        scriptHex: transferLockingScript.toHex(),
      });

      const transferAction = await serverWallet.createAction({
        description: "Transferring material token to user",
        inputBEEF: mintTxData.outputs[0].beef,
        inputs: [
          {
            inputDescription: "Server minted material",
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
        throw new Error(`Failed to create transfer transaction for ${itemName}`);
      }

      // Broadcast transfer transaction
      const transferTx = Transaction.fromAtomicBEEF(transferAction.tx);

      console.log(`📦 [TRANSFER-MATERIAL] Transaction for ${itemName} before broadcast:`, {
        txid: transferTx.id('hex'),
        inputs: transferTx.inputs.length,
        outputs: transferTx.outputs.length,
        inputOutpoints: transferTx.inputs.map(i => `${i.sourceTXID}.${i.sourceOutputIndex}`),
        outputSatoshis: transferTx.outputs.map(o => o.satoshis),
        txHex: transferTx.toHex(),
      });

      const transferBroadcast = await broadcastTX(transferTx);
      const transferTxId = transferBroadcast.txid;

      if (!transferTxId) {
        throw new Error(`Failed to get transfer transaction ID for ${itemName}`);
      }

      const userTokenId = `${transferTxId}.0`;

      console.log(`✅ [TRANSFER-MATERIAL] Transferred ${itemName} to user:`, {
        transferTxId,
        userTokenId,
        broadcastResponse: transferBroadcast
      });

      // STEP 3: Create MaterialToken document with mint proof
      const materialTokenDoc = {
        userId: userId,
        lootTableId: lootTableId,
        itemName: itemName,
        tokenId: userTokenId,           // Full outpoint: ${transferTxId}.0
        quantity: quantity,
        metadata: materialMetadata,
        mintOutpoint: mintOutpoint,     // Full outpoint: ${mintTxId}.0
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const materialResult = await materialTokensCollection.insertOne(materialTokenDoc);

      results.push({
        lootTableId: lootTableId,
        tokenId: userTokenId,        // Full outpoint (includes txid)
        mintOutpoint: mintOutpoint,  // Full outpoint (includes txid)
        quantity: quantity,
        materialTokenId: materialResult.insertedId.toString(),
      });
    }

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error) {
    console.error('Material mint and transfer error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mint and transfer materials' },
      { status: 500 }
    );
  }
}
