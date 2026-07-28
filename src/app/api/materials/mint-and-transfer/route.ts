// Single-tx mint: server builds/funds/signs one deploy+mint locked directly to
// the user's recipient-derived key (mintOutpoint === tokenId). Returns BEEF + nonce
// for the client to internalize into its wallet basket.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthProof } from '@/lib/requireAuthProof';
import { connectToMongo } from '@/lib/mongodb';
import { getServerWallet, getServerIdentityPublicKey } from '@/lib/serverWallet';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { Transaction } from '@bsv/sdk';
import { WalletP2PKH } from '@bsv/wallet-helper';
import { broadcastTX } from '@/utils/overlayFunctions';
import { decodeBeef, encodeBeef } from '@/utils/beefEncoding';
import { generateNonce, deriveRecipientKey } from '@/utils/tokenDerivation';
import type { AtomicBEEF } from '@bsv/sdk';

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body and verify auth proof
    const body = await request.json();
    const auth = await requireAuthProof(request, 'mint-material', body.proof);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    // 2. Destructure fields
    const {
      materials,        // Array of material data to mint (length must be 1)
      userIdentityKey,  // User's IDENTITY key — the derivation counterparty
      paymentTx,        // base64 WalletP2PKH payment BEEF
      walletParams,     // Wallet derivation params for unlocking { protocolID, keyID, counterparty }
    } = body;

    // Validate required fields
    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return NextResponse.json(
        { error: 'Invalid materials data' },
        { status: 400 }
      );
    }

    if (materials.length !== 1) {
      return NextResponse.json(
        { error: 'Only one material token can be minted per request' },
        { status: 400 }
      );
    }

    if (!userIdentityKey) {
      return NextResponse.json(
        { error: 'Missing user identity key' },
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

    // 5. Decode base64 payment BEEF and parse the payment transaction
    const paymentBeef = decodeBeef(paymentTx);
    const paymentTransaction = Transaction.fromBEEF(paymentBeef);
    const paymentTxId = paymentTransaction.id('hex');

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

    // 6. Check for existing tokens FIRST (before minting)
    for (const material of materials) {
      const existingToken = await materialTokensCollection.findOne({
        userId,
        lootTableId: material.lootTableId,
        tier: material.tier || 1,
        consumed: { $ne: true },
      });

      if (existingToken) {

        return NextResponse.json(
          {
            error: `Material token already exists`,
            details: `You already have a ${material.itemName} token. The system will now use the add-and-merge route to properly merge quantities on-chain.`,
            existingTokenId: existingToken.tokenId,
            existingQuantity: existingToken.quantity,
            lootTableId: material.lootTableId,
            tier: material.tier || 1,
            shouldUseAddAndMerge: true,
          },
          { status: 409 }
        );
      }
    }

    const results = [];
    // Hoisted so the single material's mintAction is accessible for the response
    let finalMintActionTx: AtomicBEEF | undefined;
    let finalNonce: string | undefined;
    let finalServerIdentityKey: string | undefined;

    // 7. Process each material (only one, enforced above)
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

      // Mint directly to the user's recipient-derived key (single tx)
      const ordinalP2PKH = new OrdinalsP2PKH();
      const nonce = generateNonce();
      const serverIdentityKey = await getServerIdentityPublicKey();
      const userKey = await deriveRecipientKey(serverWallet, userIdentityKey, nonce);
      const mintLockingScript = ordinalP2PKH.lock(userKey, '', materialMetadata, 'deploy+mint', quantity);

      // Step 1: createAction with unlockingScriptLength
      const mintActionRes = await serverWallet.createAction({
        description: "Server minting material token with user WalletP2PKH payment",
        inputBEEF: paymentBeef,
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

      // Step 2: Sign the payment input
      const mintReference = mintActionRes.signableTransaction.reference;
      const mintTxToSign = Transaction.fromBEEF(mintActionRes.signableTransaction.tx);

      mintTxToSign.inputs[0].unlockingScriptTemplate = walletP2pkhUnlockTemplate;
      mintTxToSign.inputs[0].sourceTransaction = paymentTransaction;

      await mintTxToSign.sign();

      const mintUnlockingScript = mintTxToSign.inputs[0].unlockingScript;
      if (!mintUnlockingScript) {
        throw new Error(`Missing unlocking script after signing for ${itemName}`);
      }

      // Step 3: signAction and broadcast
      const mintAction = await serverWallet.signAction({
        reference: mintReference,
        spends: {
          '0': { unlockingScript: mintUnlockingScript.toHex() }
        }
      });

      if (!mintAction.tx) {
        throw new Error(`Failed to sign mint action for ${itemName}`);
      }

      const mintTx = Transaction.fromAtomicBEEF(mintAction.tx);

      const mintBroadcast = await broadcastTX(mintTx);
      const mintTxId = mintBroadcast.txid;

      if (!mintTxId) {
        throw new Error(`Failed to get transaction ID from broadcast for ${itemName}`);
      }

      const tokenId = `${mintTxId}.0`; // mint proof and current location are the same outpoint

      // Store for top-level response (one material = one tx = one output)
      finalMintActionTx = mintAction.tx;
      finalNonce = nonce;
      finalServerIdentityKey = serverIdentityKey;

      // Create MaterialToken document
      const materialTokenDoc = {
        userId,
        lootTableId,
        itemName,
        tier: tier || 1,
        tokenId,
        quantity,
        metadata: materialMetadata,
        mintOutpoint: tokenId,
        keyId: nonce,
        counterparty: serverIdentityKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const materialResult = await materialTokensCollection.insertOne(materialTokenDoc);

      // Consume UserInventory items
      if (inventoryItemIds && inventoryItemIds.length > 0) {
        const { ObjectId } = await import('mongodb');
        const objectIds = inventoryItemIds.map((id: string) => new ObjectId(id));

        const deleteResult = await userInventoryCollection.deleteMany({
          _id: { $in: objectIds },
          userId,
        });

      }

      results.push({
        lootTableId,
        tokenId,
        mintOutpoint: tokenId,
        quantity,
        materialTokenId: materialResult.insertedId.toString(),
        updated: false,
      });
    }

    return NextResponse.json({
      success: true,
      results,
      transferBeef: encodeBeef(Array.from(finalMintActionTx!)),
      received: {
        outputIndex: 0,
        keyId: finalNonce!,
        counterparty: finalServerIdentityKey!,
        tags: ['type:material'],
      },
    });

  } catch (error) {
    console.error('Material mint and transfer error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mint and transfer materials' },
      { status: 500 }
    );
  }
}
