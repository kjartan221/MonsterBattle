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
      inventoryItemId,  // UserInventory document ID (validate ownership)
      itemData,         // Full item metadata for minting
      userPublicKey,    // User's public key for transfer
      paymentTx,        // User's payment transaction BEEF (WalletP2PKH locked)
      walletParams,     // Wallet derivation params for unlocking { protocolID, keyID, counterparty }
    } = body;

    // Validate required fields
    if (!inventoryItemId || !itemData || !userPublicKey) {
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

    console.log('Server minting item:', {
      itemName: itemData.name,
      userId,
      serverPublicKey,
      paymentAmount: paymentOutput.satoshis,
      paymentOutpoint,
    });

    // 6. STEP 1: Server mints the item (with payment input for fees)
    const ordinalP2PKH = new OrdinalsP2PKH();
    const mintLockingScript = ordinalP2PKH.lock(
      serverPublicKey,
      '',                // Empty for new mint
      itemData,          // Full item metadata
      'deploy+mint'
    );

    console.log('🔨 [MINT-ITEM] Creating mint locking script:', {
      operation: 'deploy+mint',
      publicKey: serverPublicKey,
      itemName: itemData.itemName || itemData.name,
      scriptLength: mintLockingScript.toHex().length,
      scriptHex: mintLockingScript.toHex(),
    });

    // Step 1: Call createAction with unlockingScriptLength
    const mintActionRes = await serverWallet.createAction({
      description: "Server minting item NFT with user WalletP2PKH payment",
      inputBEEF: paymentTx,
      inputs: [
        {
          inputDescription: "User WalletP2PKH payment for fees",
          outpoint: paymentOutpoint,
          unlockingScriptLength: walletP2pkhUnlockingLength,
        }
      ],
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

    if (!mintActionRes.signableTransaction) {
      throw new Error('Failed to create signable mint transaction');
    }

    // Step 2: Extract signable transaction and sign it
    const mintReference = mintActionRes.signableTransaction.reference;
    const mintTxToSign = Transaction.fromBEEF(mintActionRes.signableTransaction.tx);

    // Add WalletP2PKH unlocking script template and source transaction
    mintTxToSign.inputs[0].unlockingScriptTemplate = walletP2pkhUnlockTemplate;
    mintTxToSign.inputs[0].sourceTransaction = paymentTransaction;

    // Sign the transaction
    await mintTxToSign.sign();

    // Extract the unlocking script
    const mintUnlockingScript = mintTxToSign.inputs[0].unlockingScript;
    if (!mintUnlockingScript) {
      throw new Error('Missing unlocking script after signing');
    }

    console.log('🔓 [MINT-ITEM] Transaction signed, WalletP2PKH unlocking script generated:', {
      scriptLength: mintUnlockingScript.toHex().length,
      scriptHex: mintUnlockingScript.toHex(),
    });

    // Step 3: Sign the action with actual unlocking scripts
    const mintAction = await serverWallet.signAction({
      reference: mintReference,
      spends: {
        '0': { unlockingScript: mintUnlockingScript.toHex() }
      }
    });

    if (!mintAction.tx) {
      throw new Error('Failed to sign mint action');
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

    console.log('🔓 [TRANSFER] Creating unlocking script template for mint output:', {
      mintOutpoint,
      sighashType: 'all',
      anyoneCanPay: false,
    });

    // Create unlocking script template for server wallet (using 'all' and false)
    const unlockTemplate = ordinalP2PKH.unlock(serverWallet, "all", false);
    const unlockingScriptLength = await unlockTemplate.estimateLength();

    console.log('🔓 [TRANSFER] Unlocking script template created:', {
      unlockingScriptLength,
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

    // Step 1: Call createAction with unlockingScriptLength
    const transferActionRes = await serverWallet.createAction({
      description: "Transferring minted item to user",
      inputBEEF: mintTxData.outputs[0].beef,
      inputs: [
        {
          inputDescription: "Server minted item",
          outpoint: mintOutpoint,
          unlockingScriptLength,
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

    if (!transferActionRes.signableTransaction) {
      throw new Error('Failed to create signable transaction');
    }

    // Step 2: Extract signable transaction and sign it
    const reference = transferActionRes.signableTransaction.reference;
    const txToSign = Transaction.fromBEEF(transferActionRes.signableTransaction.tx);

    // Add unlocking script template and source transaction
    txToSign.inputs[0].unlockingScriptTemplate = unlockTemplate;
    txToSign.inputs[0].sourceTransaction = mintTransaction;

    // Sign the transaction
    await txToSign.sign();

    // Extract the unlocking script
    const unlockingScript = txToSign.inputs[0].unlockingScript;
    if (!unlockingScript) {
      throw new Error('Missing unlocking script after signing');
    }

    console.log('🔓 [TRANSFER] Transaction signed, unlocking script generated:', {
      scriptLength: unlockingScript.toHex().length,
      scriptHex: unlockingScript.toHex(),
    });

    // Step 3: Sign the action with actual unlocking scripts
    const transferAction = await serverWallet.signAction({
      reference,
      spends: {
        '0': { unlockingScript: unlockingScript.toHex() }
      }
    });

    if (!transferAction.tx) {
      throw new Error('Failed to sign transfer action');
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
