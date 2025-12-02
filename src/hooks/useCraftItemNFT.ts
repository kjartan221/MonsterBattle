import { useState, useCallback } from 'react';
import { WalletClient, Transaction, Beef } from '@bsv/sdk';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { getTransactionByTxID, broadcastTX } from './useOverlayFunctions';

/**
 * Hook for crafting items on the BSV blockchain
 *
 * This hook creates a new crafted item NFT by consuming input item NFTs and/or materials.
 * Uses the SAME unified metadata structure as useMintItemNFT.
 * Blockchain transaction inputs provide immutable provenance (what was consumed, when, by whom).
 *
 * The crafting process:
 * 1. Burns/consumes the input item NFTs and materials (unlocks and spends inputs)
 * 2. Creates a new crafted item NFT at output index 0
 * 3. Creates material "change" tokens if materials had remaining quantity
 * 4. Transaction structure shows complete provenance
 *
 * @example
 * const { craftItemNFT, isCrafting, error } = useCraftItemNFT();
 *
 * const result = await craftItemNFT({
 *   wallet: connectedWallet,
 *   recipeId: 'steel_sword',
 *   inputItems: [itemNFT1, materialToken1, materialToken2],
 *   outputItem: craftedItemData,
 * });
 */

export interface CraftingInputItem {
  inventoryItemId: string;       // UserInventory document ID
  nftLootId?: string;            // NFTLoot document ID (if already minted)
  tokenId?: string;              // Blockchain token ID (if already minted)
  transactionId?: string;        // Original mint transaction ID
  name: string;
  rarity: string;
  type: string;
  itemType: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact';
  lootTableId?: string;          // For materials (to identify material type)
  currentQuantity?: number;      // Current quantity in token (for materials)
  quantityNeeded: number;        // Quantity needed for this recipe
  description?: string;          // For material tokens
  icon?: string;                 // For material tokens
  tier?: number;                 // For material tokens
}

export interface CraftItemNFTParams {
  wallet: WalletClient;
  recipeId: string;              // Recipe identifier from recipe-table.ts
  inputItems: CraftingInputItem[]; // Items being consumed for crafting
  outputItem: {
    inventoryItemId: string;     // Newly crafted item's inventory ID
    lootTableId: string;         // Reference to loot-table.ts
    name: string;
    description: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    type: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact';
    tier?: number;
    equipmentStats?: Record<string, number>;  // Base equipment stats
    crafted?: {                  // Crafting data (only for crafted items)
      statRoll: number;          // 0.8-1.2 multiplier - frontend calculates final values
      craftedBy: string;         // Public key of crafter
    };
    borderGradient: {
      color1: string;
      color2: string;
    };
  };
}

export interface CraftItemNFTResult {
  nftId?: string;                // New NFT document ID
  tokenId?: string;              // New blockchain token ID (crafted item at output 0)
  transactionId?: string;        // BSV transaction ID
  consumedTokenIds?: string[];   // List of input token IDs that were consumed
  materialChanges?: Array<{      // Material tokens that got change back
    lootTableId: string;
    itemName: string;
    previousTokenId: string;
    newTokenId: string;          // txid.outputIndex format
    previousQuantity: number;
    newQuantity: number;
  }>;
  success: boolean;
  error?: string;
}

export function useCraftItemNFT() {
  const [isCrafting, setIsCrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Craft a new item NFT by consuming input item NFTs
   *
   * Process:
   * 1. Validate wallet connection and authentication
   * 2. For each input item that's an NFT:
   *    - Fetch previous transaction from overlay
   *    - Create unlocking script with ordinalP2PKH.unlock()
   * 3. Merge all input BEEFs using Beef class
   * 4. Prepare crafted item metadata:
   *    - Include recipe ID and input item references
   *    - Include stat roll data (if equipment)
   *    - Add crafting provenance (when, what was used)
   * 5. Create locking script for new crafted item with ordinalP2PKH.lock()
   * 6. Create BSV transaction with:
   *    - Inputs: All consumed item tokens (with unlocking scripts)
   *    - Output: New crafted item NFT inscription
   * 7. Broadcast transaction to BSV network
   * 8. Create NFTLoot document for new crafted item
   * 9. Update input items as consumed in database
   * 10. Update output item with nftLootId reference
   * 11. Return new NFT ID and transaction ID
   *
   * @param params - Crafting parameters including wallet, recipe, inputs, and output
   * @returns Result with new NFT ID and consumed token IDs
   */
  const craftItemNFT = useCallback(async (
    params: CraftItemNFTParams
  ): Promise<CraftItemNFTResult> => {
    setIsCrafting(true);
    setError(null);

    try {
      const { wallet, recipeId, inputItems, outputItem } = params;

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

      console.log('Crafting item NFT:', {
        recipeId,
        inputCount: inputItems.length,
        outputName: outputItem.name,
        publicKey,
      });

      // Prepare crafted item NFT metadata
      // Uses same unified structure as useMintItemNFT - transaction inputs show provenance
      const craftedNFTMetadata = {
        name: 'game_item',
        itemName: outputItem.name,
        description: outputItem.description,
        icon: outputItem.icon,
        rarity: outputItem.rarity,
        itemType: outputItem.type,
        tier: outputItem.tier || 1,
        stats: outputItem.equipmentStats || {},
        crafted: outputItem.crafted || null,  // { statRoll, craftedBy } for crafted items, null for drops
        enhancements: {
          prefix: null,
          suffix: null,
        },
        visual: {
          borderGradient: outputItem.borderGradient,
        },
        acquiredFrom: null,  // Crafted items don't have monster drop data
      };

      console.log('Crafted NFT metadata:', craftedNFTMetadata);

      // Prepare inputs by unlocking all input item NFTs and calculate material changes
      const inputs: any[] = [];
      const consumedTokenIds: string[] = [];
      const materialChanges: Array<{
        lootTableId: string;
        itemName: string;
        description: string;
        icon: string;
        rarity: string;
        tier: number;
        previousTokenId: string;
        previousQuantity: number;
        remainingQuantity: number;
      }> = [];
      const ordinalP2PKH = new OrdinalsP2PKH();

      for (const input of inputItems) {
        if (input.tokenId) {
          // Get previous token transaction from overlay
          const previousTxid = input.tokenId.split('.')[0];
          const oldTx = await getTransactionByTxID(previousTxid);

          if (!oldTx || !oldTx.outputs || !oldTx.outputs[0]) {
            throw new Error(`Could not find input transaction: ${previousTxid}`);
          }

          // Parse transaction from BEEF
          const tx = Transaction.fromBEEF(oldTx.outputs[0].beef);

          // Create unlocking script template
          const template = ordinalP2PKH.unlock(wallet);

          // Generate actual unlocking script
          const unlockingScript = await template.sign(tx, 0);

          // Outpoint string (uses period separator)
          const outpoint = `${previousTxid}.0`;

          inputs.push({
            inputDescription: `Consuming ${input.name}`,
            outpoint,
            unlockingScript: unlockingScript.toHex(),
            inputBEEF: oldTx.outputs[0].beef,
          });

          consumedTokenIds.push(input.tokenId);

          // Calculate material change (if this is a material token)
          if (input.itemType === 'material' && input.currentQuantity && input.currentQuantity > input.quantityNeeded) {
            const remainingQuantity = input.currentQuantity - input.quantityNeeded;
            materialChanges.push({
              lootTableId: input.lootTableId!,
              itemName: input.name,
              description: input.description!,
              icon: input.icon!,
              rarity: input.rarity as 'common' | 'rare' | 'epic' | 'legendary',
              tier: input.tier || 1,
              previousTokenId: input.tokenId,
              previousQuantity: input.currentQuantity,
              remainingQuantity: remainingQuantity,
            });
          }
        }
      }

      // Create locking script for new crafted item (reuse ordinalP2PKH instance)
      const craftedItemLockingScript = ordinalP2PKH.lock(
        publicKey,
        '',                    // Empty for minting new item
        craftedNFTMetadata,
        "deploy+mint"          // Type: creating new crafted item
      );

      // Build outputs array starting with crafted item (output index 0)
      const outputs: any[] = [
        {
          outputDescription: "Crafted NFT item",
          lockingScript: craftedItemLockingScript.toHex(),
          satoshis: 1,
        }
      ];

      // Create locking scripts for material change outputs (output indices 1, 2, 3, etc.)
      for (const materialChange of materialChanges) {
        // Convert to BSV-21 format for assetId
        const assetId = materialChange.previousTokenId.replace('.', '_');

        // Prepare material token update metadata
        const materialUpdateMetadata = {
          name: 'material_token_update',
          lootTableId: materialChange.lootTableId,
          itemName: materialChange.itemName,
          description: materialChange.description,
          icon: materialChange.icon,
          rarity: materialChange.rarity,
          tier: materialChange.tier,
          quantity: materialChange.remainingQuantity,
          previousQuantity: materialChange.previousQuantity,
          owner: publicKey,
          previousTokenId: materialChange.previousTokenId,
          operation: 'subtract',
          changeAmount: materialChange.previousQuantity - materialChange.remainingQuantity,
          reason: `Consumed in crafting recipe: ${recipeId}`,
          updatedAt: new Date().toISOString(),
        };

        // Create locking script for material change
        const materialLockingScript = ordinalP2PKH.lock(
          publicKey,
          assetId,                    // Reference previous token
          materialUpdateMetadata,
          "transfer"                  // Type: transfer/update
        );

        outputs.push({
          outputDescription: `Material change: ${materialChange.itemName}`,
          lockingScript: materialLockingScript.toHex(),
          satoshis: 1,
        });
      }

      // Build the inputs array with BEEF data
      const inputsForAction = inputs.map(input => ({
        inputDescription: input.inputDescription,
        outpoint: input.outpoint,
        unlockingScript: input.unlockingScript,
      }));

      // Merge all BEEF data from input transactions
      let combinedBEEF: number[] | undefined = undefined;
      if (inputs.length > 0) {
        const beef = new Beef();
        for (const input of inputs) {
          beef.mergeBeef(input.inputBEEF);
        }
        combinedBEEF = beef.toBinary();
      }

      // Create crafting transaction (consumes inputs, creates crafted item + material changes)
      const craftingAction = await wallet.createAction({
        description: "Crafting new item NFT",
        inputBEEF: combinedBEEF,
        inputs: inputsForAction,
        outputs: outputs,
        options: {
          randomizeOutputs: false,
        }
      });

      if (!craftingAction.tx) {
        throw new Error('Failed to create crafting transaction');
      }
      console.log('Crafting action:', craftingAction);

      // Broadcast transaction
      const tx = Transaction.fromAtomicBEEF(craftingAction.tx);
      const broadcastResponse = await broadcastTX(tx);

      // Extract new token IDs with correct output indices
      const txId = broadcastResponse.txid;
      const craftedItemTokenId = `${txId}.0`; // Crafted item is always output 0

      // Build material change results with correct output indices (starting at 1)
      const materialChangeResults = materialChanges.map((change, index) => ({
        lootTableId: change.lootTableId,
        itemName: change.itemName,
        previousTokenId: change.previousTokenId,
        newTokenId: `${txId}.${index + 1}`, // Output indices 1, 2, 3, etc.
        previousQuantity: change.previousQuantity,
        newQuantity: change.remainingQuantity,
      }));

      console.log('Crafted item NFT created on blockchain:', {
        txId,
        craftedItemTokenId,
        consumedTokenIds,
        materialChanges: materialChangeResults,
      });

      // Call backend API to handle database updates
      const apiResult = await fetch('/api/crafting/blockchain-craft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventoryItemId: outputItem.inventoryItemId,
          transactionId: txId,
          tokenId: craftedItemTokenId,
          metadata: craftedNFTMetadata,
          consumedItems: inputItems.map(i => ({
            inventoryItemId: i.inventoryItemId,
            tokenId: i.tokenId,
          })),
          materialChanges: materialChangeResults,
        }),
      });

      if (!apiResult.ok) {
        const errorData = await apiResult.json();
        throw new Error(errorData.error || 'Failed to save crafted item to database');
      }

      const { nftId } = await apiResult.json();

      return {
        nftId: nftId,
        tokenId: craftedItemTokenId,
        transactionId: txId,
        consumedTokenIds: consumedTokenIds,
        materialChanges: materialChangeResults,
        success: true,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to craft item NFT';
      console.error('Failed to craft item NFT:', err);
      setError(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };

    } finally {
      setIsCrafting(false);
    }
  }, []);

  return {
    craftItemNFT,
    isCrafting,
    error,
  };
}
