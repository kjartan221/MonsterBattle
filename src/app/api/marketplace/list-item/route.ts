import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getLootItemById, LootItem, EquipmentStats } from '@/lib/loot-table';
import { getServerWallet } from '@/lib/serverWallet';
import OrdLock from '@/utils/orderLock';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { Transaction, P2PKH, PublicKey } from '@bsv/sdk';
import { broadcastTX, getTransactionByTxID } from '@/utils/overlayFunctions';
import { WalletP2PKH } from '@bsv/wallet-helper';

/**
 * POST /api/marketplace/list-item
 * List an item (NFT or material token) for sale on the marketplace
 * Creates an OrdLock transaction that locks the item for sale
 */
export async function POST(request: NextRequest) {
  try {
    // Get cookies using next/headers
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId as string;

    const body = await request.json();
    const { inventoryItemId, materialTokenId, price, userPublicKey, paymentTx, walletParams } = body;

    // Validate price
    if (!price || isNaN(price) || price <= 0) {
      return NextResponse.json({ error: 'Valid price is required' }, { status: 400 });
    }

    // Must provide either inventoryItemId or materialTokenId (not both)
    if ((!inventoryItemId && !materialTokenId) || (inventoryItemId && materialTokenId)) {
      return NextResponse.json(
        { error: 'Must provide either inventoryItemId or materialTokenId' },
        { status: 400 }
      );
    }

    // Validate required fields for on-chain listing
    if (!userPublicKey || !paymentTx || !walletParams) {
      return NextResponse.json(
        { error: 'Missing required fields: userPublicKey, paymentTx, walletParams' },
        { status: 400 }
      );
    }

    const {
      usersCollection,
      userInventoryCollection,
      materialTokensCollection,
      marketplaceItemsCollection
    } = await connectToMongo();

    // Get user info
    const user = await usersCollection.findOne({ userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate seller address from public key (for both cancel and payment)
    const payAddress = PublicKey.fromString(userPublicKey).toAddress();
    const cancelAddress = payAddress

    interface ItemData {
      inventoryItemId?: string;
      materialTokenId?: string;
      lootTableId: string;
      itemName: string;
      itemIcon: string;
      itemType: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact' | 'inscription_scroll' | 'spell_scroll';
      rarity: 'common' | 'rare' | 'epic' | 'legendary';
      tier: number;
      tokenId?: string;
      transactionId?: string;
      quantity?: number;
      equipmentStats?: EquipmentStats;
      crafted?: boolean;
      statRoll?: number;
      isEmpowered?: boolean;
      prefix?: any;
      suffix?: any;
    }

    let itemData: ItemData | null = null;
    let lootItem: LootItem | undefined;
    let currentTokenId: string | undefined;
    let assetId: string | undefined;

    if (inventoryItemId) {
      // Listing an NFT item from inventory
      const item = await userInventoryCollection.findOne({
        _id: new ObjectId(inventoryItemId),
        userId
      });

      if (!item) {
        return NextResponse.json({ error: 'Item not found in inventory' }, { status: 404 });
      }

      // Item must be minted (have nftLootId and tokenId)
      if (!item.nftLootId || !item.tokenId) {
        return NextResponse.json(
          { error: 'Item must be minted as NFT before listing' },
          { status: 400 }
        );
      }

      // Check if already listed
      const existingListing = await marketplaceItemsCollection.findOne({
        inventoryItemId: inventoryItemId,
        status: 'active'
      });

      if (existingListing) {
        return NextResponse.json(
          { error: 'Item is already listed on marketplace' },
          { status: 400 }
        );
      }

      lootItem = getLootItemById(item.lootTableId);
      if (!lootItem) {
        return NextResponse.json({ error: 'Item data not found' }, { status: 404 });
      }

      currentTokenId = item.tokenId; // txid.vout format
      assetId = item.mintOutpoint?.replace('.', '_'); // txid_vout format

      itemData = {
        inventoryItemId: inventoryItemId,
        lootTableId: item.lootTableId,
        itemName: lootItem.name,
        itemIcon: lootItem.icon,
        itemType: lootItem.type,
        rarity: lootItem.rarity,
        tier: item.tier,
        tokenId: currentTokenId,
        equipmentStats: lootItem.equipmentStats,
        crafted: item.crafted,
        statRoll: item.statRoll,
        isEmpowered: item.isEmpowered,
        prefix: item.prefix,
        suffix: item.suffix,
      };

    } else if (materialTokenId) {
      // Listing a material token
      const token = await materialTokensCollection.findOne({
        _id: new ObjectId(materialTokenId),
        userId
      });

      if (!token) {
        return NextResponse.json({ error: 'Material token not found' }, { status: 404 });
      }

      // Token must not be consumed
      if (token.consumed) {
        return NextResponse.json(
          { error: 'Material token has been consumed' },
          { status: 400 }
        );
      }

      // Check if already listed
      const existingListing = await marketplaceItemsCollection.findOne({
        materialTokenId: materialTokenId,
        status: 'active'
      });

      if (existingListing) {
        return NextResponse.json(
          { error: 'Material is already listed on marketplace' },
          { status: 400 }
        );
      }

      lootItem = getLootItemById(token.lootTableId);
      if (!lootItem) {
        return NextResponse.json({ error: 'Material data not found' }, { status: 404 });
      }

      currentTokenId = token.tokenId; // txid.vout format
      assetId = token.mintOutpoint?.replace('.', '_'); // txid_vout format

      const tokenMetadata = token.metadata as { tier?: number } | undefined;
      const tier = tokenMetadata?.tier || 1;

      itemData = {
        materialTokenId: materialTokenId,
        lootTableId: token.lootTableId,
        itemName: lootItem.name,
        itemIcon: lootItem.icon,
        itemType: lootItem.type,
        rarity: lootItem.rarity,
        tier: tier,
        tokenId: currentTokenId,
        transactionId: token.transactionId,
        quantity: token.quantity,
      };
    }

    // Ensure itemData and tokenId are valid
    if (!itemData || !currentTokenId || !assetId) {
      return NextResponse.json(
        { error: 'Failed to prepare item data or missing tokenId' },
        { status: 500 }
      );
    }

    // ===== CREATE ORDLOCK TRANSACTION =====

    const serverWallet = await getServerWallet();

    // Parse payment transaction
    const paymentTransaction = Transaction.fromBEEF(paymentTx);
    const paymentTxId = paymentTransaction.id('hex');
    const paymentOutpoint = `${paymentTxId}.0`;

    console.log('📥 [LIST-ITEM] Payment transaction:', {
      txid: paymentTxId,
      paymentOutpoint,
    });

    // Fetch the current item transaction for spending
    const [tokenTxId, tokenVout] = currentTokenId.split('.');
    const tokenTxData = await getTransactionByTxID(tokenTxId);

    if (!tokenTxData || !tokenTxData.outputs || !tokenTxData.outputs[parseInt(tokenVout)] || !tokenTxData.outputs[parseInt(tokenVout)].beef) {
      throw new Error(`Could not find token transaction: ${tokenTxId}`);
    }

    const tokenTransaction = Transaction.fromBEEF(tokenTxData.outputs[parseInt(tokenVout)].beef!);

    console.log('📥 [LIST-ITEM] Token transaction:', {
      tokenId: currentTokenId,
      txid: tokenTxId,
      vout: tokenVout,
    });

    // Create OrdLock locking script
    const ordLock = new OrdLock();
    const ordLockScript = ordLock.lock(
      cancelAddress,  // cancelAddress (seller can cancel)
      payAddress,  // payAddress (seller receives payment)
      parseInt(price, 10),
      assetId,
      itemData  // Full item metadata
    );

    console.log('🔒 [LIST-ITEM] Created OrdLock script:', {
      payAddress,
      price: parseInt(price, 10),
      assetId,
      scriptLength: ordLockScript.toHex().length,
    });

    // Create unlocking templates for both inputs
    const ordinalP2PKH = new OrdinalsP2PKH();
    const tokenUnlockTemplate = ordinalP2PKH.unlock(serverWallet, "all", false);
    const tokenUnlockingLength = await tokenUnlockTemplate.estimateLength();

    // Create WalletP2PKH unlocking template
    const walletp2pkh = new WalletP2PKH(serverWallet);
    const paymentUnlockTemplate = walletp2pkh.unlock({
      protocolID: walletParams.protocolID,
      keyID: walletParams.keyID,
      counterparty: walletParams.counterparty,
    });
    const paymentUnlockingLength = await paymentUnlockTemplate.estimateLength();

    // STEP 1: createAction - Prepare transaction
    const actionRes = await serverWallet.createAction({
      description: "Creating marketplace listing with OrdLock",
      inputBEEF: tokenTxData.outputs[parseInt(tokenVout)].beef,
      inputs: [
        {
          inputDescription: "Item to list",
          outpoint: currentTokenId,
          unlockingScriptLength: tokenUnlockingLength,
        },
        {
          inputDescription: "User payment for fees",
          outpoint: paymentOutpoint,
          unlockingScriptLength: paymentUnlockingLength,
        }
      ],
      outputs: [
        {
          outputDescription: "OrdLock listing",
          lockingScript: ordLockScript.toHex(),
          satoshis: 1,
        }
      ],
      options: {
        randomizeOutputs: false,
        acceptDelayedBroadcast: false,
      }
    });

    if (!actionRes.signableTransaction) {
      throw new Error('Failed to create signable transaction');
    }

    // STEP 2: Sign - Generate unlocking scripts
    const reference = actionRes.signableTransaction.reference;
    const txToSign = Transaction.fromBEEF(actionRes.signableTransaction.tx);

    // Attach templates and source transactions
    txToSign.inputs[0].unlockingScriptTemplate = tokenUnlockTemplate;
    txToSign.inputs[0].sourceTransaction = tokenTransaction;
    txToSign.inputs[1].unlockingScriptTemplate = paymentUnlockTemplate;
    txToSign.inputs[1].sourceTransaction = paymentTransaction;

    // Sign the transaction
    await txToSign.sign();

    // Extract unlocking scripts
    const tokenUnlockingScript = txToSign.inputs[0].unlockingScript;
    const paymentUnlockingScript = txToSign.inputs[1].unlockingScript;

    if (!tokenUnlockingScript || !paymentUnlockingScript) {
      throw new Error('Missing unlocking scripts after signing');
    }

    console.log('🔓 [LIST-ITEM] Transaction signed, unlocking scripts generated');

    // STEP 3: signAction - Finalize transaction
    const action = await serverWallet.signAction({
      reference,
      spends: {
        '0': { unlockingScript: tokenUnlockingScript.toHex() },
        '1': { unlockingScript: paymentUnlockingScript.toHex() }
      }
    });

    if (!action.tx) {
      throw new Error('Failed to sign action');
    }

    // Broadcast transaction
    const tx = Transaction.fromAtomicBEEF(action.tx);
    const broadcast = await broadcastTX(tx);
    const txid = broadcast.txid;

    if (!txid) {
      throw new Error('Failed to get transaction ID from broadcast');
    }

    const ordLockOutpoint = `${txid}.0`;

    console.log('✅ [LIST-ITEM] OrdLock transaction broadcast:', {
      txid,
      ordLockOutpoint,
    });

    // Create marketplace listing with OrdLock data
    const marketplaceItem = {
      sellerId: userId,
      sellerUsername: user.username,
      ...itemData,
      price: parseInt(price, 10),
      ordLockOutpoint: ordLockOutpoint,
      ordLockScript: ordLockScript.toHex(),
      payAddress: payAddress,
      assetId: assetId,
      status: 'active' as const,
      listedAt: new Date(),
    };

    const result = await marketplaceItemsCollection.insertOne(marketplaceItem);

    console.log('[MARKETPLACE LIST] Item listed with OrdLock:', {
      listingId: result.insertedId,
      itemName: itemData.itemName,
      price: price,
      ordLockOutpoint,
    });

    return NextResponse.json({
      success: true,
      listingId: result.insertedId.toString(),
      ordLockOutpoint,
      message: `${itemData.itemName} listed for ${price} satoshis`,
    });

  } catch (error) {
    console.error('Error listing item on marketplace:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list item' },
      { status: 500 }
    );
  }
}
