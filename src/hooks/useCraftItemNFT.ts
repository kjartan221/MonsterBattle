import { useState, useCallback } from 'react';
import { WalletClient, Transaction, Beef } from '@bsv/sdk';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { getTransactionByTxID, broadcastTX } from './useOverlayFunctions';

/**
 * Hook for crafting items on the BSV blockchain
 *
 * Hybrid CLIENT + SERVER architecture with provable on-chain link:
 *
 * CLIENT TRANSACTION: Material consumption + Auth output
 *   - Unlocks material tokens (multi-input)
 *   - Creates material change outputs (if any)
 *   - Creates auth output locked to server public key (proves consumption)
 *   - Signs and broadcasts transaction
 *
 * SERVER TRANSACTION: Crafted item minting
 *   - Unlocks auth output (proves server control + links to materials)
 *   - Mints crafted item
 *   - Transfers to user
 *
 * This architecture:
 * - Proves on-chain link between material consumption and crafted item
 * - Server validates auth output before minting
 * - Client controls material consumption logic
 * - Server controls item minting (single source of truth)
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
   * Craft a new item NFT by consuming input items
   *
   * Hybrid CLIENT + SERVER process:
   * 1. Validate wallet and get user's public key
   * 2. Fetch server public key for auth output
   * 3. CLIENT: Create transaction consuming materials
   *    - Unlock material tokens (multi-input)
   *    - Create material change outputs (if any)
   *    - Create auth output locked to server (1 satoshi)
   * 4. CLIENT: Sign and broadcast material consumption transaction
   * 5. SERVER: Validate auth output and mint crafted item
   *    - Unlock auth output (proves link to materials)
   *    - Mint crafted item
   *    - Transfer to user
   * 6. Return NFT ID, token ID, and material changes
   *
   * @param params - Crafting parameters including wallet, recipe, inputs, and output
   * @returns Result with new NFT ID and material changes
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

      console.log('Crafting item NFT (hybrid flow):', {
        recipeId,
        inputCount: inputItems.length,
        outputName: outputItem.name,
        publicKey,
      });

      // Fetch server public key for auth output
      const serverKeyResponse = await fetch('/api/server-public-key');
      if (!serverKeyResponse.ok) {
        throw new Error('Failed to fetch server public key');
      }
      const { publicKey: serverPublicKey } = await serverKeyResponse.json();

      // ===================================================
      // CLIENT TRANSACTION: Material consumption + Auth
      // ===================================================

      const ordinalP2PKH = new OrdinalsP2PKH();
      const materialChanges: Array<{
        lootTableId: string;
        itemName: string;
        previousTokenId: string;
        previousQuantity: number;
        remainingQuantity: number;
        description: string;
        icon: string;
        rarity: string;
        tier: number;
      }> = [];

      // Build inputs from material tokens
      const inputs: any[] = [];
      const consumedTokenIds: string[] = [];

      for (const input of inputItems) {
        if (input.tokenId) {
          // Fetch material token transaction
          const previousTxid = input.tokenId.split('.')[0];
          const oldTx = await getTransactionByTxID(previousTxid);

          if (!oldTx || !oldTx.outputs || !oldTx.outputs[0]) {
            throw new Error(`Could not find input transaction: ${previousTxid}`);
          }

          const tx = Transaction.fromBEEF(oldTx.outputs[0].beef);

          // Create unlocking script
          const template = ordinalP2PKH.unlock(wallet, "single", true); // Use "single" and anyoneCanPay for createAction
          const unlockingScript = await template.sign(tx, 0);

          inputs.push({
            inputDescription: `Consuming ${input.name}`,
            outpoint: input.tokenId,
            unlockingScript: unlockingScript.toHex(),
            inputBEEF: oldTx.outputs[0].beef,
          });

          consumedTokenIds.push(input.tokenId);

          // Calculate material change if needed
          if (input.itemType === 'material' && input.currentQuantity && input.currentQuantity > input.quantityNeeded) {
            materialChanges.push({
              lootTableId: input.lootTableId!,
              itemName: input.name,
              previousTokenId: input.tokenId,
              previousQuantity: input.currentQuantity,
              remainingQuantity: input.currentQuantity - input.quantityNeeded,
              description: input.description!,
              icon: input.icon!,
              rarity: input.rarity as 'common' | 'rare' | 'epic' | 'legendary',
              tier: input.tier || 1,
            });
          }
        }
      }

      // Build outputs: material changes + auth output
      const outputs: any[] = [];

      // Add material change outputs
      for (const change of materialChanges) {
        const assetId = change.previousTokenId.replace('.', '_');

        const materialUpdateMetadata = {
          name: 'material_token',
          lootTableId: change.lootTableId,
          itemName: change.itemName,
          description: change.description,
          icon: change.icon,
          rarity: change.rarity,
          tier: change.tier,
          quantity: change.remainingQuantity,
          previousQuantity: change.previousQuantity,
          operation: 'subtract',
          changeAmount: change.previousQuantity - change.remainingQuantity,
          reason: `Consumed in crafting recipe: ${recipeId}`,
          updatedAt: new Date().toISOString(),
        };

        const changeLockingScript = ordinalP2PKH.lock(
          publicKey,
          assetId,
          materialUpdateMetadata,
          'transfer'
        );

        outputs.push({
          outputDescription: `Material change: ${change.itemName}`,
          lockingScript: changeLockingScript.toHex(),
          satoshis: 1,
        });
      }

      // Add auth output locked to server (last output)
      // Using OrdinalP2PKH to satisfy overlay requirements
      const authMetadata = {
        name: 'auth_token',
        purpose: 'crafting_authentication',
        recipeId: recipeId,
        timestamp: new Date().toISOString(),
      };
      const authLockingScript = ordinalP2PKH.lock(
        serverPublicKey,
        '', // Empty assetId for new auth token
        authMetadata,
        'deploy+mint'
      );
      outputs.push({
        outputDescription: "Auth output for server minting",
        lockingScript: authLockingScript.toHex(),
        satoshis: 1,
      });

      // Merge all BEEF data
      const beef = new Beef();
      for (const input of inputs) {
        beef.mergeBeef(input.inputBEEF);
      }
      const combinedBEEF = beef.toBinary();

      // Create material consumption transaction
      const consumptionAction = await wallet.createAction({
        description: "Consuming materials for crafting",
        inputBEEF: combinedBEEF,
        inputs: inputs.map(i => ({
          inputDescription: i.inputDescription,
          outpoint: i.outpoint,
          unlockingScript: i.unlockingScript,
        })),
        outputs: outputs,
        options: {
          randomizeOutputs: false,
        }
      });

      if (!consumptionAction.tx) {
        throw new Error('Failed to create material consumption transaction');
      }

      // Broadcast consumption transaction
      const consumptionTx = Transaction.fromAtomicBEEF(consumptionAction.tx);
      const consumptionBroadcast = await broadcastTX(consumptionTx);
      const consumptionTxId = consumptionBroadcast.txid;

      // Calculate auth outpoint (last output)
      const authOutputIndex = outputs.length - 1;
      const authOutpoint = `${consumptionTxId}.${authOutputIndex}`;

      console.log('Material consumption transaction:', {
        txId: consumptionTxId,
        authOutpoint,
        materialChanges: materialChanges.length,
      });

      // Build material change results
      const materialChangeResults = materialChanges.map((change, index) => ({
        lootTableId: change.lootTableId,
        itemName: change.itemName,
        previousTokenId: change.previousTokenId,
        newTokenId: `${consumptionTxId}.${index}`,
        previousQuantity: change.previousQuantity,
        newQuantity: change.remainingQuantity,
      }));

      // ===================================================
      // SERVER TRANSACTION: Mint crafted item using auth
      // ===================================================

      // Call server API with auth outpoint
      const apiResult = await fetch('/api/crafting/mint-and-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipeId,
          authOutpoint,  // Proves link to material consumption
          consumptionTxId,
          materialChanges: materialChangeResults,
          inputItems: inputItems.map(input => ({
            inventoryItemId: input.inventoryItemId,
            tokenId: input.tokenId,
            name: input.name,
            rarity: input.rarity,
            itemType: input.itemType,
            quantityNeeded: input.quantityNeeded,
          })),
          outputItem: {
            inventoryItemId: outputItem.inventoryItemId,
            lootTableId: outputItem.lootTableId,
            name: outputItem.name,
            description: outputItem.description,
            icon: outputItem.icon,
            rarity: outputItem.rarity,
            type: outputItem.type,
            tier: outputItem.tier || 1,
            equipmentStats: outputItem.equipmentStats || {},
            crafted: outputItem.crafted || null,
            borderGradient: outputItem.borderGradient,
          },
          userPublicKey: publicKey,
        }),
      });

      if (!apiResult.ok) {
        const errorData = await apiResult.json();
        throw new Error(errorData.error || 'Failed to craft item');
      }

      const result = await apiResult.json();

      console.log('Server crafted item:', {
        nftId: result.nftId,
        tokenId: result.tokenId,
        mintOutpoint: result.mintOutpoint,
      });

      return {
        nftId: result.nftId,
        tokenId: result.tokenId,
        transactionId: result.transferTransactionId,
        consumedTokenIds,
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
