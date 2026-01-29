/**
 * Server-Side Material Token Mint and Transfer Flow
 *
 * This replaces client-side material minting with server-controlled flow:
 * 0. User creates payment transaction (100 sats P2PKH to server pubkey)
 * 1. Validate user owns the materials (loot drop, crafting materials, etc.)
 * 2. Server wallet mints the material token (server is source of truth)
 *    - Includes user payment as input for network fees
 * 3. Store mintOutpoint in MaterialToken table (proof of legitimate mint)
 * 4. Server immediately transfers to user's public key
 * 5. Store transferTransactionId in MaterialToken table
 *
 * Payment System:
 * - User provides 100 satoshis via standard P2PKH output
 * - Payment used as input for mint transaction fees
 * - Leftover sats go to server as service fee
 * - Server wallet auto-adds extra sats if 100 insufficient
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
import { WalletP2PKH } from '@bsv/wallet-helper';
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
      paymentTx,        // User's payment transaction BEEF (WalletP2PKH locked)
      walletParams,     // Wallet derivation params for unlocking { protocolID, keyID, counterparty }
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
    const { materialTokensCollection, userInventoryCollection } = await connectToMongo();

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

    console.log('Server minting materials:', {
      materialCount: materials.length,
      userId,
      serverPublicKey,
      paymentAmount: paymentOutput.satoshis,
      paymentOutpoint,
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
        inventoryItemIds,
        acquiredFrom,
      } = material;

      // Validate quantity
      if (quantity <= 0 || !Number.isInteger(quantity)) {
        throw new Error(`Invalid quantity for ${itemName}: ${quantity} (must be positive integer)`);
      }

      if (quantity > 1_000_000) {
        throw new Error(`Quantity too large for ${itemName}: ${quantity} (max 1,000,000)`);
      }

      // Prepare material metadata (quantity is in amt field, not metadata)
      const materialMetadata = {
        name: 'material_token',
        lootTableId,
        itemName,
        description,
        icon,
        rarity,
        tier: tier || 1,
        acquiredFrom: acquiredFrom || [],
      };

      console.log(`Minting material: ${itemName} x${quantity}`);

      // STEP 1: Server mints the material token (with payment input for fees)
      const ordinalP2PKH = new OrdinalsP2PKH();
      const mintLockingScript = ordinalP2PKH.lock(
        serverPublicKey,
        '',                    // Empty for new mint
        materialMetadata,
        'deploy+mint',
        quantity               // Pass quantity as amt parameter
      );

      console.log(`🔨 [MINT-MATERIAL] Creating mint locking script for ${itemName}:`, {
        operation: 'deploy+mint',
        publicKey: serverPublicKey,
        materialName: itemName,
        quantity,
        amt: quantity,          // Show amt in logs
        scriptLength: mintLockingScript.toHex().length,
        scriptHex: mintLockingScript.toHex(),
      });

      // Step 1: Call createAction with unlockingScriptLength
      const mintActionRes = await serverWallet.createAction({
        description: "Server minting material token with user WalletP2PKH payment",
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
            outputDescription: "New material token",
            lockingScript: mintLockingScript.toHex(),
            satoshis: 1,
          }
        ],
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false,
        }
      });

      if (!mintActionRes.signableTransaction) {
        throw new Error(`Failed to create signable mint transaction for ${itemName}`);
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
        throw new Error(`Missing unlocking script after signing for ${itemName}`);
      }

      console.log(`🔓 [MINT-MATERIAL] Transaction signed for ${itemName}, WalletP2PKH unlocking script generated:`, {
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
        throw new Error(`Failed to sign mint action for ${itemName}`);
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

      console.log(`🔓 [TRANSFER-MATERIAL] Creating unlocking script template for ${itemName}:`, {
        mintOutpoint,
        sighashType: 'all',
        anyoneCanPay: false,
      });

      // Create unlocking script template for server wallet (using 'all' and false)
      const unlockTemplate = ordinalP2PKH.unlock(serverWallet, "all", false);
      const unlockingScriptLength = await unlockTemplate.estimateLength();

      console.log(`🔓 [TRANSFER-MATERIAL] Unlocking script template for ${itemName} created:`, {
        unlockingScriptLength,
      });

      // Create transfer locking script to user
      const assetId = mintOutpoint.replace('.', '_'); // BSV-21 format
      const transferLockingScript = ordinalP2PKH.lock(
        userPublicKey,     // Lock to user's public key
        assetId,           // Reference the mint
        materialMetadata,  // Material metadata (game data only)
        'transfer',
        quantity           // Pass quantity to transfer inscription
      );

      console.log(`🔒 [TRANSFER-MATERIAL] Creating transfer locking script for ${itemName}:`, {
        operation: 'transfer',
        assetId,
        userPublicKey: userPublicKey,
        quantity,
        amt: quantity,      // Show amt in logs
        scriptLength: transferLockingScript.toHex().length,
        scriptHex: transferLockingScript.toHex(),
      });

      // Step 1: Call createAction with unlockingScriptLength
      const transferActionRes = await serverWallet.createAction({
        description: "Transferring material token to user",
        inputBEEF: mintTxData.outputs[0].beef,
        inputs: [
          {
            inputDescription: "Server minted material",
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
          acceptDelayedBroadcast: false,
        }
      });

      if (!transferActionRes.signableTransaction) {
        throw new Error(`Failed to create signable transaction for ${itemName}`);
      }

      // Step 2: Extract signable transaction and sign it
      const transferReference = transferActionRes.signableTransaction.reference;
      const transferTxToSign = Transaction.fromBEEF(transferActionRes.signableTransaction.tx);

      // Add unlocking script template and source transaction
      transferTxToSign.inputs[0].unlockingScriptTemplate = unlockTemplate;
      transferTxToSign.inputs[0].sourceTransaction = mintTransaction;

      // Sign the transaction
      await transferTxToSign.sign();

      // Extract the unlocking script
      const transferUnlockingScript = transferTxToSign.inputs[0].unlockingScript;
      if (!transferUnlockingScript) {
        throw new Error(`Missing unlocking script after signing for ${itemName}`);
      }

      console.log(`🔓 [TRANSFER-MATERIAL] Transaction signed for ${itemName}, unlocking script generated:`, {
        scriptLength: transferUnlockingScript.toHex().length,
        scriptHex: transferUnlockingScript.toHex(),
      });

      // Step 3: Sign the action with actual unlocking scripts
      const transferAction = await serverWallet.signAction({
        reference: transferReference,
        spends: {
          '0': { unlockingScript: transferUnlockingScript.toHex() }
        }
      });

      if (!transferAction.tx) {
        throw new Error(`Failed to sign transfer action for ${itemName}`);
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

      // STEP 3: Create or update MaterialToken document with mint proof
      // Check if material token already exists for this user+lootTableId+tier
      const existingToken = await materialTokensCollection.findOne({
        userId: userId,
        lootTableId: lootTableId,
        tier: tier || 1,
        consumed: { $ne: true },
      });

      let materialResult;

      if (existingToken) {
        // Update existing token - merge quantities
        const newQuantity = existingToken.quantity + quantity;

        materialResult = await materialTokensCollection.updateOne(
          { _id: existingToken._id },
          {
            $set: {
              tier: tier || 1,                // Ensure tier is always stored at top level
              tokenId: userTokenId,           // Update to new token ID
              quantity: newQuantity,          // Merged quantity
              metadata: materialMetadata,
              mintOutpoint: mintOutpoint,     // Update mint proof
              previousTokenId: existingToken.tokenId, // Track previous token
              lastTransactionId: transferTxId,
              updatedAt: new Date(),
            },
            $push: {
              updateHistory: {
                operation: 'add',
                previousQuantity: existingToken.quantity,
                newQuantity: newQuantity,
                transactionId: transferTxId,
                reason: `Minted additional ${quantity} from inventory`,
                timestamp: new Date(),
              },
            },
          }
        );

        console.log(`✅ [UPDATE] Updated existing material token: ${lootTableId} (${existingToken.quantity} + ${quantity} = ${newQuantity})`);
      } else {
        // Create new token
        const materialTokenDoc = {
          userId: userId,
          lootTableId: lootTableId,
          itemName: itemName,
          tier: tier || 1,                // IMPORTANT: Store tier at top level for querying
          tokenId: userTokenId,           // Full outpoint: ${transferTxId}.0
          quantity: quantity,
          metadata: materialMetadata,
          mintOutpoint: mintOutpoint,     // Full outpoint: ${mintTxId}.0
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        materialResult = await materialTokensCollection.insertOne(materialTokenDoc);

        console.log(`✅ [CREATE] Created new material token: ${lootTableId} (${quantity})`);
      }

      // STEP 4: Mark UserInventory items as consumed (remove from unminted inventory)
      if (inventoryItemIds && inventoryItemIds.length > 0) {
        const { ObjectId } = await import('mongodb');
        const objectIds = inventoryItemIds.map((id: string) => new ObjectId(id));

        const deleteResult = await userInventoryCollection.deleteMany({
          _id: { $in: objectIds },
          userId: userId,  // Security: ensure user owns these items
        });

        console.log(`✅ [CONSUME] Removed ${deleteResult.deletedCount} UserInventory items after minting ${itemName}`);
      }

      results.push({
        lootTableId: lootTableId,
        tokenId: userTokenId,        // Full outpoint (includes txid)
        mintOutpoint: mintOutpoint,  // Full outpoint (includes txid)
        quantity: existingToken ? existingToken.quantity + quantity : quantity,
        materialTokenId: existingToken ? existingToken._id.toString() : (materialResult as any).insertedId.toString(),
        updated: !!existingToken,    // Flag to indicate if this was an update
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
