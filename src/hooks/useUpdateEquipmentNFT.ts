import { useState, useCallback } from 'react';
import { WalletClient, Transaction, Beef } from '@bsv/sdk';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { createWalletPayment } from '@/utils/createWalletPayment';
import { getTransactionByTxID, broadcastTX } from './useOverlayFunctions';

/**
 * Hook for updating equipment NFTs with inscription scrolls
 *
 * This hook updates an existing equipment NFT by applying prefix or suffix inscriptions.
 * Uses batched transfers: transfers equipment + all scrolls to server in ONE transaction.
 *
 * The update process:
 * 1. Batch transfer: equipment + scroll(s) → server (single transaction, much cheaper)
 * 2. Server unlocks all inputs + payment
 * 3. Server creates updated equipment with new inscriptions
 * 4. Server broadcasts transaction
 * 5. Database updated with new item
 *
 * Supports applying multiple scrolls at once (e.g., prefix + suffix in one update).
 *
 * @example
 * const { updateEquipmentNFT, isUpdating, error } = useUpdateEquipmentNFT();
 *
 * const result = await updateEquipmentNFT({
 *   wallet: connectedWallet,
 *   equipmentItem: originalEquipment,
 *   inscriptionScrolls: [prefixScroll], // Can be 1 or 2 scrolls
 * });
 */

export interface EquipmentNFTItem {
  inventoryItemId: string;       // UserInventory document ID
  nftLootId: string;             // NFTLoot document ID
  tokenId: string;               // Blockchain token ID (txid.vout)
  transactionId: string;         // Original transaction ID
  lootTableId: string;           // Reference to loot-table.ts
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'weapon' | 'armor' | 'artifact';
  tier: number;
  equipmentStats: Record<string, number>;  // Base equipment stats
  crafted?: {                    // Crafting data (only for crafted equipment)
    statRoll: number;            // 0.8-1.2 multiplier
    craftedBy: string;           // Public key of crafter
  };
  borderGradient: {
    color1: string;
    color2: string;
  };
  prefix?: {                     // Current prefix inscription
    type: string;                // InscriptionType
    value: number;
    name: string;
  };
  suffix?: {                     // Current suffix inscription
    type: string;                // InscriptionType
    value: number;
    name: string;
  };
}

export interface InscriptionScrollItem {
  inventoryItemId: string;       // UserInventory document ID
  nftLootId: string;             // NFTLoot document ID
  tokenId: string;               // Blockchain token ID (txid.vout)
  transactionId: string;         // Original transaction ID
  lootTableId: string;           // Reference to loot-table.ts
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'consumable';
  inscriptionData: {             // InscriptionData from loot-table
    inscriptionType: string;     // InscriptionType
    statValue: number;
    slot: 'prefix' | 'suffix';
    name: string;                // e.g., "Blazing", "of the Bear"
    description: string;
  };
}

export interface UpdateEquipmentNFTParams {
  wallet: WalletClient;
  equipmentItem: EquipmentNFTItem;
  inscriptionScrolls: InscriptionScrollItem[]; // Array: 1 or 2 scrolls
}

export interface UpdateEquipmentNFTResult {
  nftId?: string;                // New NFT document ID
  tokenId?: string;              // New blockchain token ID (txid.vout)
  transactionId?: string;        // BSV transaction ID
  previousEquipmentTokenId?: string;
  consumedScrollTokenIds?: string[];
  success: boolean;
  error?: string;
}

export function useUpdateEquipmentNFT() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update equipment NFT with inscription scroll(s) - Batched Transfer Pattern
   *
   * Process (optimized with batch transfer):
   * 1. Validate wallet connection and authentication
   * 2. CLIENT: Transfer equipment + all scrolls to server in ONE transaction (much cheaper!)
   * 3. CLIENT: Create WalletP2PKH payment for fees
   * 4. SERVER: Validates transferred tokens
   * 5. SERVER: Unlocks equipment + scroll(s) + payment
   * 6. SERVER: Creates updated equipment token with new inscriptions
   * 7. SERVER: Broadcasts transaction
   * 8. SERVER: Updates database
   * 9. Return new NFT ID and transaction ID
   *
   * @param params - Update parameters including wallet, equipment, and scrolls
   * @returns Result with new NFT ID and consumed token IDs
   */
  const updateEquipmentNFT = useCallback(async (
    params: UpdateEquipmentNFTParams
  ): Promise<UpdateEquipmentNFTResult> => {
    setIsUpdating(true);
    setError(null);

    try {
      const { wallet, equipmentItem, inscriptionScrolls } = params;

      // Validate inputs
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      if (!inscriptionScrolls || inscriptionScrolls.length === 0) {
        throw new Error('At least one inscription scroll required');
      }

      if (inscriptionScrolls.length > 2) {
        throw new Error('Maximum 2 inscription scrolls allowed (prefix + suffix)');
      }

      const isAuthenticated = await wallet.isAuthenticated();
      if (!isAuthenticated) {
        throw new Error('Wallet not authenticated');
      }

      // Get player public key
      const { publicKey } = await wallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
      });

      // Fetch server identity key for payment counterparty
      const serverIdentityKeyResponse = await fetch('/api/server-identity-key');
      if (!serverIdentityKeyResponse.ok) {
        throw new Error('Failed to fetch server identity key');
      }
      const { publicKey: serverIdentityKey } = await serverIdentityKeyResponse.json();

      console.log('Creating WalletP2PKH payment transaction (100 sats)...');

      // Create WalletP2PKH payment with derivation params
      const { paymentTx, paymentTxId, walletParams } = await createWalletPayment(
        wallet,
        serverIdentityKey,
        100,
        'Payment for equipment update fees'
      );

      console.log('WalletP2PKH payment transaction created:', {
        txid: paymentTxId,
        satoshis: 100,
        walletParams,
      });

      console.log('Updating equipment NFT (batched transfer-to-server flow):', {
        equipmentName: equipmentItem.name,
        scrollCount: inscriptionScrolls.length,
        scrollNames: inscriptionScrolls.map(s => s.name),
        publicKey,
        paymentTxId,
        walletParams,
      });

      // Fetch server public key for token transfers
      const serverKeyResponse = await fetch('/api/server-public-key');
      if (!serverKeyResponse.ok) {
        throw new Error('Failed to fetch server public key');
      }
      const { publicKey: serverPublicKey } = await serverKeyResponse.json();

      // ===================================================
      // CLIENT TRANSACTION: Batch transfer equipment + scrolls to server in ONE transaction
      // ===================================================

      const ordinalP2PKH = new OrdinalsP2PKH();

      console.log(`[TRANSFER] Batching ${1 + inscriptionScrolls.length} items to server in single transaction`);

      // Step 1: Fetch all source transactions
      const allItems = [equipmentItem, ...inscriptionScrolls];
      const sourceTransactions: Transaction[] = [];

      for (const item of allItems) {
        console.log(`[TRANSFER] Fetching ${item.name}...`);
        const previousTxid = item.tokenId.split('.')[0];
        const oldTx = await getTransactionByTxID(previousTxid);

        if (!oldTx || !oldTx.outputs || !oldTx.outputs[0]) {
          throw new Error(`Could not find previous transaction: ${previousTxid} for ${item.name}`);
        }

        const previousTransaction = Transaction.fromBEEF(oldTx.outputs[0].beef);
        sourceTransactions.push(previousTransaction);
      }

      // Step 2: Merge all BEEFs for multi-input transaction
      const mergedBeef = new Beef();
      for (const sourceTx of sourceTransactions) {
        mergedBeef.mergeBeef(sourceTx.toBEEF());
      }
      const inputBEEF = mergedBeef.toBinary();

      // Step 3: Build inputs and outputs arrays for all items
      const unlockTemplate = ordinalP2PKH.unlock(wallet, "all", false);
      const unlockingScriptLength = await unlockTemplate.estimateLength();

      // Build inputs: equipment first, then scrolls
      const inputs = allItems.map((item, index) => ({
        inputDescription: index === 0
          ? `Equipment: ${item.name}`
          : `Inscription scroll: ${item.name}`,
        outpoint: item.tokenId,
        unlockingScriptLength,
      }));

      // Build outputs: equipment first, then scrolls
      const outputs = [];

      // Output 0: Equipment
      const equipmentAssetId = equipmentItem.tokenId.replace('.', '_');
      const equipmentLockingScript = ordinalP2PKH.lock(
        serverPublicKey,
        equipmentAssetId,
        {
          name: 'game_item',
          itemName: equipmentItem.name,
          description: equipmentItem.description,
          icon: equipmentItem.icon,
          rarity: equipmentItem.rarity,
          itemType: equipmentItem.type,
          tier: equipmentItem.tier,
          stats: equipmentItem.equipmentStats,
          crafted: equipmentItem.crafted || null,
          enhancements: {
            prefix: equipmentItem.prefix || null,
            suffix: equipmentItem.suffix || null,
          },
          visual: {
            borderGradient: equipmentItem.borderGradient,
          },
        },
        'transfer',
        undefined  // No amt field for equipment
      );

      outputs.push({
        outputDescription: `Transfer ${equipmentItem.name} to server`,
        lockingScript: equipmentLockingScript.toHex(),
        satoshis: 1,
      });

      // Outputs 1+: Scrolls
      for (const scroll of inscriptionScrolls) {
        const scrollAssetId = scroll.tokenId.replace('.', '_');
        const scrollLockingScript = ordinalP2PKH.lock(
          serverPublicKey,
          scrollAssetId,
          {
            name: 'inscription_scroll',
            itemName: scroll.name,
            description: scroll.description,
            icon: scroll.icon,
            rarity: scroll.rarity,
            inscriptionData: scroll.inscriptionData,
          },
          'transfer',
          undefined  // No amt field for scrolls
        );

        outputs.push({
          outputDescription: `Transfer ${scroll.name} to server`,
          lockingScript: scrollLockingScript.toHex(),
          satoshis: 1,
        });
      }

      // Step 4: Create single batched action
      const transferActionRes = await wallet.createAction({
        description: `Transferring ${equipmentItem.name} + ${inscriptionScrolls.length} scroll(s) to server for inscription`,
        inputBEEF,
        inputs,
        outputs,
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false,
        },
      });

      if (!transferActionRes.signableTransaction) {
        throw new Error('Failed to create signable batch transfer transaction');
      }

      // Step 5: Sign all inputs in the single transaction
      const reference = transferActionRes.signableTransaction.reference;
      const txToSign = Transaction.fromBEEF(transferActionRes.signableTransaction.tx);

      // Assign unlocking script templates and source transactions for all inputs
      for (let i = 0; i < allItems.length; i++) {
        txToSign.inputs[i].unlockingScriptTemplate = unlockTemplate;
        txToSign.inputs[i].sourceTransaction = sourceTransactions[i];
      }

      await txToSign.sign();

      // Extract all unlocking scripts
      const spends: Record<string, { unlockingScript: string }> = {};
      for (let i = 0; i < allItems.length; i++) {
        const unlockingScript = txToSign.inputs[i].unlockingScript;
        if (!unlockingScript) {
          throw new Error(`Missing unlocking script for input ${i} (${allItems[i].name})`);
        }
        spends[i.toString()] = { unlockingScript: unlockingScript.toHex() };
      }

      // Step 6: Sign action with all unlocking scripts
      const transferAction = await wallet.signAction({
        reference,
        spends,
      });

      if (!transferAction.tx) {
        throw new Error('Failed to sign batch transfer action');
      }

      // Step 7: Broadcast batched transfer
      const transferTx = Transaction.fromAtomicBEEF(transferAction.tx);
      const transferBroadcast = await broadcastTX(transferTx);
      const transferTxId = transferBroadcast.txid;

      // Transferred token IDs: equipment at output 0, scrolls at outputs 1+
      const transferredEquipmentTokenId = `${transferTxId}.0`;
      const transferredScrollTokenIds = inscriptionScrolls.map((_, i) => `${transferTxId}.${i + 1}`);

      console.log(`[TRANSFER] Batch transfer complete:`, {
        txid: transferTxId,
        equipmentTokenId: transferredEquipmentTokenId,
        scrollTokenIds: transferredScrollTokenIds,
      });

      // ===================================================
      // SERVER TRANSACTION: Update equipment
      // ===================================================

      // Prepare updated inscription data
      let updatedPrefix = equipmentItem.prefix || null;
      let updatedSuffix = equipmentItem.suffix || null;

      for (const scroll of inscriptionScrolls) {
        if (scroll.inscriptionData.slot === 'prefix') {
          updatedPrefix = {
            type: scroll.inscriptionData.inscriptionType,
            value: scroll.inscriptionData.statValue,
            name: scroll.inscriptionData.name,
          };
        } else if (scroll.inscriptionData.slot === 'suffix') {
          updatedSuffix = {
            type: scroll.inscriptionData.inscriptionType,
            value: scroll.inscriptionData.statValue,
            name: scroll.inscriptionData.name,
          };
        }
      }

      // Call server API to update equipment
      const apiResult = await fetch('/api/equipment/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Original item IDs for database tracking
          originalEquipmentInventoryId: equipmentItem.inventoryItemId,
          originalEquipmentTokenId: equipmentItem.tokenId,
          inscriptionScrollInventoryIds: inscriptionScrolls.map(s => s.inventoryItemId),
          inscriptionScrollTokenIds: inscriptionScrolls.map(s => s.tokenId),

          // Transferred tokens (server will unlock these)
          transferredEquipmentTokenId,
          transferredScrollTokenIds,
          batchTransferTransactionId: transferTxId,

          // Equipment data
          equipmentData: {
            lootTableId: equipmentItem.lootTableId,
            name: equipmentItem.name,
            description: equipmentItem.description,
            icon: equipmentItem.icon,
            rarity: equipmentItem.rarity,
            type: equipmentItem.type,
            tier: equipmentItem.tier,
            equipmentStats: equipmentItem.equipmentStats,
            crafted: equipmentItem.crafted || null,
            borderGradient: equipmentItem.borderGradient,
          },

          // Scroll data
          scrollsData: inscriptionScrolls.map(s => s.inscriptionData),

          // Updated inscriptions
          updatedPrefix,
          updatedSuffix,

          // User public key for final transfer back to user
          userPublicKey: publicKey,

          // WalletP2PKH payment data
          paymentTx,
          walletParams,
        }),
      });

      if (!apiResult.ok) {
        const errorData = await apiResult.json();
        throw new Error(errorData.error || 'Failed to update equipment on server');
      }

      const result = await apiResult.json();

      console.log('Equipment update successful:', result);

      return {
        nftId: result.nftId,
        tokenId: result.tokenId,
        transactionId: result.transactionId,
        previousEquipmentTokenId: equipmentItem.tokenId,
        consumedScrollTokenIds: inscriptionScrolls.map(s => s.tokenId),
        success: true,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during equipment update';
      console.error('Equipment update error:', err);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    updateEquipmentNFT,
    isUpdating,
    error,
  };
}
