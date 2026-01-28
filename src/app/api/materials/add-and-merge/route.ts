/**
 * Server-Side Material Add and Merge
 *
 * This route handles adding materials using the transfer-to-server pattern:
 *
 * CLIENT TRANSACTION (user → server):
 *   - Input: User's existing material token (amt=10)
 *   - Output: Transfer to server (amt=10, locked to server pubkey)
 *
 * SERVER TRANSACTION 1 (mint new amount):
 *   - No inputs
 *   - Output: New material token (amt=5, owned by server)
 *
 * SERVER TRANSACTION 2 (merge):
 *   - Input 1: Transferred token from user (amt=10, server unlocks)
 *   - Input 2: Newly minted token (amt=5, server unlocks)
 *   - Output: Merged token (amt=15, transfer back to user)
 *
 * This architecture:
 * - Prevents duplicate stacks (user ends with single token)
 * - Server has full control during operation
 * - Uses BSV-20 amt field properly
 * - Cleaner than auth-based pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { getServerWallet, getServerPublicKey } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { Transaction, P2PKH, Beef } from '@bsv/sdk';
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
      transferredTokenId,      // Token user transferred to server (e.g., "txid.0")
      transferTransactionId,   // TX where user transferred to server
      lootTableId,
      itemName,
      description,
      icon,
      rarity,
      tier = 1,
      addedQuantity,           // Amount to add (will mint this)
      currentQuantity,         // Amount in transferred token
      userPublicKey,           // User's pubkey (for final transfer back)
      paymentTx,               // User's payment transaction BEEF (WalletP2PKH locked)
      walletParams,            // Wallet derivation params for unlocking { protocolID, keyID, counterparty }
      reason,
      acquiredFrom,
    } = body;

    // Validate required fields
    if (!transferredTokenId || !lootTableId || !itemName || !userPublicKey) {
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

    if (addedQuantity <= 0 || !Number.isInteger(addedQuantity)) {
      return NextResponse.json(
        { error: `Invalid addedQuantity: ${addedQuantity}` },
        { status: 400 }
      );
    }

    if (currentQuantity <= 0 || !Number.isInteger(currentQuantity)) {
      return NextResponse.json(
        { error: `Invalid currentQuantity: ${currentQuantity}` },
        { status: 400 }
      );
    }

    // 3. Connect to MongoDB
    const { materialTokensCollection } = await connectToMongo();

    // 4. Verify user owns the material token being updated
    const existingToken = await materialTokensCollection.findOne({
      userId,
      lootTableId,
      tier,
      consumed: { $ne: true },
    });

    if (!existingToken) {
      return NextResponse.json(
        { error: 'Material token not found or already consumed' },
        { status: 404 }
      );
    }

    if (existingToken.quantity !== currentQuantity) {
      return NextResponse.json(
        { error: `Quantity mismatch: expected ${existingToken.quantity}, got ${currentQuantity}` },
        { status: 409 }
      );
    }

    // 5. Get server wallet and public key
    const serverWallet = await getServerWallet();
    const serverPublicKey = await getServerPublicKey();
    const ordinalP2PKH = new OrdinalsP2PKH();

    // 6. Parse and validate payment transaction
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

    console.log('Server adding and merging materials:', {
      lootTableId,
      itemName,
      transferredTokenId,
      currentQuantity,
      addedQuantity,
      userId,
      paymentAmount: paymentOutput.satoshis,
      paymentOutpoint,
    });

    // ========================================
    // STEP 1: Validate transferred token
    // ========================================

    // Fetch transfer transaction
    const transferTxData = await getTransactionByTxID(transferTransactionId);

    if (!transferTxData || !transferTxData.outputs || !transferTxData.outputs[0] || !transferTxData.outputs[0].beef) {
      return NextResponse.json(
        { error: `Could not find transfer transaction: ${transferTransactionId}` },
        { status: 404 }
      );
    }

    const transferTransaction = Transaction.fromBEEF(transferTxData.outputs[0].beef);

    // Verify transferred output is locked to server public key
    const transferOutputIndex = parseInt(transferredTokenId.split('.')[1]);
    const transferOutput = transferTransaction.outputs[transferOutputIndex];

    if (!transferOutput) {
      return NextResponse.json(
        { error: 'Transfer output not found' },
        { status: 404 }
      );
    }

    // Extract the P2PKH portion to validate public key
    const transferScriptHex = transferOutput.lockingScript.toHex();
    const expectedScriptPattern = new P2PKH().lock(serverPublicKey).toHex();

    console.log('🔍 [VALIDATE] Validating transferred token:', {
      transferredTokenId,
      transferOutputSatoshis: transferOutput.satoshis,
      containsExpectedP2PKH: transferScriptHex.includes(expectedScriptPattern),
    });

    if (!transferScriptHex.includes(expectedScriptPattern)) {
      return NextResponse.json(
        { error: 'Transfer output not locked to server public key' },
        { status: 400 }
      );
    }

    console.log('✅ [VALIDATE] Transferred token validated');

    // ========================================
    // STEP 2: Mint new material token
    // ========================================

    const materialMetadata = {
      name: 'material_token',
      lootTableId,
      itemName,
      description,
      icon,
      rarity,
      tier,
      acquiredFrom: acquiredFrom ? [acquiredFrom] : [],
    };

    const mintLockingScript = ordinalP2PKH.lock(
      serverPublicKey,
      '',
      materialMetadata,
      'deploy+mint',
      addedQuantity  // amt field
    );

    console.log('🔨 [MINT] Minting new material token with WalletP2PKH payment:', {
      lootTableId,
      addedQuantity,
      amt: addedQuantity,
    });

    // Step 1: Call createAction with unlockingScriptLength
    const mintActionRes = await serverWallet.createAction({
      description: "Minting additional materials for merge with user WalletP2PKH payment",
      inputBEEF: paymentTx,
      inputs: [
        {
          inputDescription: "User WalletP2PKH payment for fees",
          outpoint: paymentOutpoint,
          unlockingScriptLength: walletP2pkhUnlockingLength,
        }
      ],
      outputs: [{
        outputDescription: "New material token",
        lockingScript: mintLockingScript.toHex(),
        satoshis: 1,
      }],
      options: {
        randomizeOutputs: false,
        acceptDelayedBroadcast: false,
      },
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

    console.log('🔓 [MINT] Transaction signed, WalletP2PKH unlocking script generated:', {
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

    const mintTx = Transaction.fromAtomicBEEF(mintAction.tx);
    const mintBroadcast = await broadcastTX(mintTx);
    const mintTxId = mintBroadcast.txid!;
    const mintOutpoint = `${mintTxId}.0`;

    console.log(`✅ [MINT] Minted ${addedQuantity}x ${itemName} with payment: ${mintOutpoint}`);

    // ========================================
    // STEP 3: Merge both tokens
    // ========================================

    // Fetch mint transaction
    const mintTxData = await getTransactionByTxID(mintTxId);

    if (!mintTxData || !mintTxData.outputs || !mintTxData.outputs[0] || !mintTxData.outputs[0].beef) {
      throw new Error(`Mint transaction not found: ${mintTxId}`);
    }

    const mintTransaction = Transaction.fromBEEF(mintTxData.outputs[0].beef);

    // Create unlocking script template
    const unlockTemplate = ordinalP2PKH.unlock(serverWallet, "all", false);
    const unlockingScriptLength = await unlockTemplate.estimateLength();

    const newQuantity = currentQuantity + addedQuantity;
    const mergedAssetId = mintOutpoint.replace('.', '_'); // Use mint as asset reference

    const mergedMetadata = {
      ...materialMetadata,
      // mergeHistory removed - not game data, just blockchain provenance
    };

    const mergeLockingScript = ordinalP2PKH.lock(
      userPublicKey,
      mergedAssetId,
      mergedMetadata,
      'transfer',
      newQuantity  // Combined amt
    );

    console.log('🔀 [MERGE] Creating merge transaction:', {
      input1: transferredTokenId,
      input1Amt: currentQuantity,
      input2: mintOutpoint,
      input2Amt: addedQuantity,
      outputAmt: newQuantity,
    });

    // Merge BEEFs for multiple inputs
    const mergedBeef = new Beef();
    mergedBeef.mergeBeef(transferTransaction.toBEEF());
    mergedBeef.mergeBeef(mintTransaction.toBEEF());
    const inputBEEF = mergedBeef.toBinary();

    // Create merge transaction with 2 inputs → 1 output
    const mergeActionRes = await serverWallet.createAction({
      description: "Merging material tokens",
      inputBEEF,
      inputs: [
        {
          inputDescription: "Transferred token from user",
          outpoint: transferredTokenId,
          unlockingScriptLength,
        },
        {
          inputDescription: "Newly minted token",
          outpoint: mintOutpoint,
          unlockingScriptLength,
        },
      ],
      outputs: [{
        outputDescription: "Merged token back to user",
        lockingScript: mergeLockingScript.toHex(),
        satoshis: 1,
      }],
      options: {
        randomizeOutputs: false,
        acceptDelayedBroadcast: false,
      },
    });

    if (!mergeActionRes.signableTransaction) {
      throw new Error('Failed to create signable merge transaction');
    }

    // Sign the merge transaction
    const reference = mergeActionRes.signableTransaction.reference;
    const txToSign = Transaction.fromBEEF(mergeActionRes.signableTransaction.tx);

    // Add unlocking script templates for both inputs
    txToSign.inputs[0].unlockingScriptTemplate = unlockTemplate;
    txToSign.inputs[0].sourceTransaction = transferTransaction;
    txToSign.inputs[1].unlockingScriptTemplate = unlockTemplate;
    txToSign.inputs[1].sourceTransaction = mintTransaction;

    await txToSign.sign();

    // Extract unlocking scripts
    const unlockingScript0 = txToSign.inputs[0].unlockingScript;
    const unlockingScript1 = txToSign.inputs[1].unlockingScript;

    if (!unlockingScript0 || !unlockingScript1) {
      throw new Error('Missing unlocking scripts after signing');
    }

    // Sign the action with actual unlocking scripts
    const mergeAction = await serverWallet.signAction({
      reference,
      spends: {
        '0': { unlockingScript: unlockingScript0.toHex() },
        '1': { unlockingScript: unlockingScript1.toHex() },
      },
    });

    if (!mergeAction.tx) {
      throw new Error('Failed to sign merge action');
    }

    const mergeTx = Transaction.fromAtomicBEEF(mergeAction.tx);
    const mergeBroadcast = await broadcastTX(mergeTx);
    const mergeTxId = mergeBroadcast.txid!;
    const mergedTokenId = `${mergeTxId}.0`;

    console.log(`✅ [MERGE] Merged tokens: ${mergedTokenId} (${newQuantity}x ${itemName})`);

    // ========================================
    // STEP 4: Update database
    // ========================================

    await materialTokensCollection.updateOne(
      { _id: existingToken._id },
      {
        $set: {
          tokenId: mergedTokenId,
          quantity: newQuantity,
          metadata: mergedMetadata,
          previousTokenId: transferredTokenId,
          lastTransactionId: mergeTxId,
          updatedAt: new Date(),
        },
        $push: {
          updateHistory: {
            operation: 'add',
            previousQuantity: currentQuantity,
            newQuantity,
            transactionId: mergeTxId,
            mergedFrom: [transferredTokenId, mintOutpoint],
            reason: reason || 'Material addition (server merge)',
            timestamp: new Date(),
          },
        },
      }
    );

    console.log('✅ [DATABASE] Updated material token document');

    return NextResponse.json({
      success: true,
      mergedTokenId,
      mergeTransactionId: mergeTxId,
      newQuantity,
      previousQuantity: currentQuantity,
      addedQuantity,
    });

  } catch (error) {
    console.error('Add and merge error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add and merge materials' },
      { status: 500 }
    );
  }
}
