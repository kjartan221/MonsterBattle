import { useState, useCallback } from 'react';
import { WalletClient, Transaction, Beef } from '@bsv/sdk';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { getTransactionByTxID, broadcastTX } from './useOverlayFunctions';

/**
 * Hook for updating equipment NFTs with inscription scrolls
 *
 * This hook updates an existing equipment NFT by applying a prefix or suffix inscription.
 * Uses the EXACT same metadata structure as useMintItemNFT - only prefix/suffix fields change.
 * Blockchain transaction history provides immutable provenance and timestamps.
 *
 * The update process:
 * 1. Unlocks the original equipment NFT (input 0)
 * 2. Unlocks the inscription scroll NFT (input 1)
 * 3. Merges BEEFs from both inputs
 * 4. Creates new equipment NFT with updated prefix/suffix (output 0)
 * 5. Both input tokens are consumed, new token is created
 *
 * @example
 * const { updateEquipmentNFT, isUpdating, error } = useUpdateEquipmentNFT();
 *
 * const result = await updateEquipmentNFT({
 *   wallet: connectedWallet,
 *   equipmentItem: originalEquipment,
 *   inscriptionScroll: prefixScroll,
 *   inscriptionType: 'prefix',
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
  inscriptionScroll: InscriptionScrollItem;
  inscriptionType: 'prefix' | 'suffix';
}

export interface UpdateEquipmentNFTResult {
  nftId?: string;                // New NFT document ID
  tokenId?: string;              // New blockchain token ID (txid.vout)
  transactionId?: string;        // BSV transaction ID
  previousEquipmentTokenId?: string;
  consumedScrollTokenId?: string;
  success: boolean;
  error?: string;
}

export function useUpdateEquipmentNFT() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update equipment NFT with inscription scroll
   *
   * Process:
   * 1. Validate wallet connection and authentication
   * 2. Fetch previous transactions for equipment and scroll from overlay
   * 3. Create unlocking scripts for both tokens
   * 4. Merge BEEFs from both input transactions
   * 5. Prepare updated equipment metadata (same structure as mint, only prefix/suffix change)
   * 6. Create locking script with ordinalP2PKH.lock() using "transfer" type
   * 7. Create BSV transaction with:
   *    - Input 0: Original equipment token (unlocking script)
   *    - Input 1: Inscription scroll token (unlocking script)
   *    - Output 0: New equipment NFT with updated prefix/suffix
   * 8. Broadcast transaction to BSV network
   * 9. Update database:
   *    - Mark old equipment as consumed
   *    - Mark inscription scroll as consumed
   *    - Create new NFTLoot for updated equipment (same structure as mint)
   *    - Create new UserInventory entry with updated prefix/suffix
   * 10. Return new NFT ID and transaction ID
   *
   * @param params - Update parameters including wallet, equipment, and scroll
   * @returns Result with new NFT ID and consumed token IDs
   */
  const updateEquipmentNFT = useCallback(async (
    params: UpdateEquipmentNFTParams
  ): Promise<UpdateEquipmentNFTResult> => {
    setIsUpdating(true);
    setError(null);

    try {
      const { wallet, equipmentItem, inscriptionScroll, inscriptionType } = params;

      // Validate wallet
      if (!wallet) {
        throw new Error('Wallet not connected');
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

      console.log('Updating equipment NFT:', {
        equipmentName: equipmentItem.name,
        scrollName: inscriptionScroll.name,
        inscriptionType,
        publicKey,
      });

      // Prepare inputs by unlocking both tokens
      const inputs: any[] = [];
      const ordinalP2PKH = new OrdinalsP2PKH();

      // Input 0: Unlock original equipment token
      const equipmentTxid = equipmentItem.tokenId.split('.')[0];
      const equipmentTx = await getTransactionByTxID(equipmentTxid);

      if (!equipmentTx || !equipmentTx.outputs || !equipmentTx.outputs[0]) {
        throw new Error(`Could not find equipment transaction: ${equipmentTxid}`);
      }

      const equipmentTransaction = Transaction.fromBEEF(equipmentTx.outputs[0].beef);
      const equipmentTemplate = ordinalP2PKH.unlock(wallet, "single", true);
      const equipmentUnlockingScript = await equipmentTemplate.sign(equipmentTransaction, 0);

      inputs.push({
        inputDescription: `Consuming ${equipmentItem.name}`,
        outpoint: `${equipmentTxid}.0`,
        unlockingScript: equipmentUnlockingScript.toHex(),
        inputBEEF: equipmentTx.outputs[0].beef,
      });

      // Input 1: Unlock inscription scroll token
      const scrollTxid = inscriptionScroll.tokenId.split('.')[0];
      const scrollTx = await getTransactionByTxID(scrollTxid);

      if (!scrollTx || !scrollTx.outputs || !scrollTx.outputs[0]) {
        throw new Error(`Could not find inscription scroll transaction: ${scrollTxid}`);
      }

      const scrollTransaction = Transaction.fromBEEF(scrollTx.outputs[0].beef);
      const scrollTemplate = ordinalP2PKH.unlock(wallet, "single", true);
      const scrollUnlockingScript = await scrollTemplate.sign(scrollTransaction, 0);

      inputs.push({
        inputDescription: `Consuming ${inscriptionScroll.name}`,
        outpoint: `${scrollTxid}.0`,
        unlockingScript: scrollUnlockingScript.toHex(),
        inputBEEF: scrollTx.outputs[0].beef,
      });

      // Merge BEEFs from both inputs
      const beef = new Beef();
      for (const input of inputs) {
        beef.mergeBeef(input.inputBEEF);
      }
      const combinedBEEF = beef.toBinary();

      // Prepare updated equipment metadata with new inscription
      // Uses same structure as useMintItemNFT - only prefix/suffix fields change
      // Preserves craftedStats if item was crafted
      const updatedPrefix = inscriptionType === 'prefix'
        ? {
            type: inscriptionScroll.inscriptionData.inscriptionType,
            value: inscriptionScroll.inscriptionData.statValue,
            name: inscriptionScroll.inscriptionData.name,
          }
        : equipmentItem.prefix || null;

      const updatedSuffix = inscriptionType === 'suffix'
        ? {
            type: inscriptionScroll.inscriptionData.inscriptionType,
            value: inscriptionScroll.inscriptionData.statValue,
            name: inscriptionScroll.inscriptionData.name,
          }
        : equipmentItem.suffix || null;

      const updatedEquipmentMetadata = {
        name: 'game_item',
        itemName: equipmentItem.name,
        description: equipmentItem.description,
        icon: equipmentItem.icon,
        rarity: equipmentItem.rarity,
        itemType: equipmentItem.type,
        tier: equipmentItem.tier,
        stats: equipmentItem.equipmentStats,
        crafted: equipmentItem.crafted || null,  // Preserve crafted data { statRoll, craftedBy }
        enhancements: {
          prefix: updatedPrefix,
          suffix: updatedSuffix,
        },
        visual: {
          borderGradient: equipmentItem.borderGradient,
        },
        acquiredFrom: null,  // Equipment from updates don't have monster drop data
      };

      console.log('Updated equipment metadata:', updatedEquipmentMetadata);

      // Create locking script for updated equipment (use "transfer" type with assetId)
      const assetId = equipmentItem.tokenId.replace('.', '_'); // Convert to BSV-21 format

      const updatedEquipmentLockingScript = ordinalP2PKH.lock(
        publicKey,
        assetId,                 // Reference previous equipment token
        updatedEquipmentMetadata,
        "transfer"               // Type: updating existing equipment
      );

      // Build inputs array for createAction
      const inputsForAction = inputs.map(input => ({
        inputDescription: input.inputDescription,
        outpoint: input.outpoint,
        unlockingScript: input.unlockingScript,
      }));

      // Build outputs array (updated equipment at output 0)
      const outputs = [{
        outputDescription: "Updated equipment NFT",
        lockingScript: updatedEquipmentLockingScript.toHex(),
        satoshis: 1,
      }];

      // Create update transaction (consumes equipment + scroll, creates updated equipment)
      const updateAction = await wallet.createAction({
        description: "Updating equipment with inscription",
        inputBEEF: combinedBEEF,
        inputs: inputsForAction,
        outputs: outputs,
        options: {
          randomizeOutputs: false,
        }
      });

      if (!updateAction.tx) {
        throw new Error('Failed to create update transaction');
      }
      console.log('Update action:', updateAction);

      // Broadcast transaction
      const tx = Transaction.fromAtomicBEEF(updateAction.tx);
      const broadcastResponse = await broadcastTX(tx);

      // Extract new token ID
      const txId = broadcastResponse.txid;
      const updatedEquipmentTokenId = `${txId}.0`;

      console.log('Equipment NFT updated on blockchain:', {
        txId,
        updatedEquipmentTokenId,
        previousEquipmentTokenId: equipmentItem.tokenId,
        consumedScrollTokenId: inscriptionScroll.tokenId,
      });

      // Call backend API to handle database updates
      const apiResult = await fetch('/api/equipment/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalEquipmentInventoryId: equipmentItem.inventoryItemId,
          originalEquipmentTokenId: equipmentItem.tokenId,
          inscriptionScrollInventoryId: inscriptionScroll.inventoryItemId,
          inscriptionScrollTokenId: inscriptionScroll.tokenId,
          transactionId: txId,
          tokenId: updatedEquipmentTokenId,
          metadata: updatedEquipmentMetadata,
        }),
      });

      if (!apiResult.ok) {
        const errorData = await apiResult.json();
        throw new Error(errorData.error || 'Failed to save updated equipment to database');
      }

      const { nftId } = await apiResult.json();

      return {
        nftId: nftId,
        tokenId: updatedEquipmentTokenId,
        transactionId: txId,
        previousEquipmentTokenId: equipmentItem.tokenId,
        consumedScrollTokenId: inscriptionScroll.tokenId,
        success: true,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update equipment NFT';
      console.error('Failed to update equipment NFT:', err);
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
