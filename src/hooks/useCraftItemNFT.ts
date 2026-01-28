import { useState, useCallback } from 'react';
import { WalletClient, Transaction, Beef } from '@bsv/sdk';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { createWalletPayment } from '@/utils/createWalletPayment';
import { getTransactionByTxID, broadcastTX } from './useOverlayFunctions';

/**
 * Hook for crafting items on the BSV blockchain
 *
 * Transfer-to-Server architecture (similar to material add/merge):
 *
 * CLIENT TRANSACTIONS: Transfer materials to server
 *   - For each material token: Create transfer transaction to server
 *   - Server receives full control of material tokens
 *   - Uses BSV-20 amt field for quantities
 *
 * SERVER TRANSACTION: Craft item + handle material change
 *   - Validates transferred material tokens
 *   - Calculates material consumption and change amounts
 *   - Mints crafted item
 *   - Mints material change tokens (if needed) with proper amt field
 *   - Creates single transaction: All inputs → Crafted item + Change outputs to user
 *
 * This architecture:
 * - Server has full control during operation (owns material tokens)
 * - Proper BSV-20 amt field usage for material quantities
 * - No duplicate stacks (change tokens minted with correct amt)
 * - Clean on-chain provenance (material consumption → crafted item)
 * - Simpler client (just transfers, server handles complex logic)
 *
 * @example
 * const { craftItemNFT, isCrafting, error } = useCraftItemNFT();
 *
 * const result = await craftItemNFT({
 *   wallet: connectedWallet,
 *   recipeId: 'steel_sword',
 *   inputItems: [materialToken1, materialToken2],
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
   * Transfer-to-Server process:
   * 1. Validate wallet and get user's public key
   * 2. Fetch server public key for transfers
   * 3. CLIENT: For each material, create transfer transaction to server
   *    - Transfer entire material token to server ownership
   *    - Server will handle consumption + change calculation
   * 4. CLIENT: Broadcast all transfer transactions
   * 5. SERVER: Validate transfers, mint crafted item, mint change tokens
   *    - Unlocks all transferred material tokens
   *    - Mints crafted item
   *    - Mints material change tokens (if needed) with proper amt field
   *    - Creates single transaction: All inputs → Crafted item + Changes to user
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
        'Payment for crafting fees'
      );

      console.log('WalletP2PKH payment transaction created:', {
        txid: paymentTxId,
        satoshis: 100,
        walletParams,
      });

      console.log('Crafting item NFT (transfer-to-server flow):', {
        recipeId,
        inputCount: inputItems.length,
        outputName: outputItem.name,
        publicKey,
        paymentTxId,
        walletParams,
      });

      // Fetch server public key for material transfers
      const serverKeyResponse = await fetch('/api/server-public-key');
      if (!serverKeyResponse.ok) {
        throw new Error('Failed to fetch server public key');
      }
      const { publicKey: serverPublicKey } = await serverKeyResponse.json();

      // ===================================================
      // CLIENT TRANSACTION: Transfer all materials to server in ONE transaction
      // ===================================================

      const ordinalP2PKH = new OrdinalsP2PKH();

      // Filter only material inputs
      const materialInputs = inputItems.filter(input => input.tokenId && input.itemType === 'material');

      console.log(`[TRANSFER] Transferring ${materialInputs.length} materials to server in single batch transaction`);

      // Step 1: Fetch all source transactions
      const sourceTransactions: Transaction[] = [];

      for (const input of materialInputs) {
        console.log(`[TRANSFER] Fetching ${input.name}...`);
        const previousTxid = input.tokenId!.split('.')[0];
        const oldTx = await getTransactionByTxID(previousTxid);

        if (!oldTx || !oldTx.outputs || !oldTx.outputs[0]) {
          throw new Error(`Could not find previous transaction: ${previousTxid}`);
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

      // Step 3: Build inputs and outputs arrays for all materials
      const unlockTemplate = ordinalP2PKH.unlock(wallet, "all", false);
      const unlockingScriptLength = await unlockTemplate.estimateLength();

      const inputs = materialInputs.map((input, index) => ({
        inputDescription: `Material token: ${input.name}`,
        outpoint: input.tokenId!,
        unlockingScriptLength,
      }));

      const outputs = materialInputs.map((input) => {
        const assetId = input.tokenId!.replace('.', '_');
        const transferLockingScript = ordinalP2PKH.lock(
          serverPublicKey,
          assetId,
          {
            name: 'material_token',
            lootTableId: input.lootTableId,
            itemName: input.name,
            description: input.description,
            icon: input.icon,
            rarity: input.rarity,
            tier: input.tier || 1,
          },
          'transfer',
          input.currentQuantity  // Transfer current amt to server
        );

        return {
          outputDescription: `Transfer ${input.name} to server`,
          lockingScript: transferLockingScript.toHex(),
          satoshis: 1,
        };
      });

      // Step 4: Create single action with all materials
      const transferActionRes = await wallet.createAction({
        description: `Transferring ${materialInputs.length} materials to server for crafting`,
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
      for (let i = 0; i < materialInputs.length; i++) {
        txToSign.inputs[i].unlockingScriptTemplate = unlockTemplate;
        txToSign.inputs[i].sourceTransaction = sourceTransactions[i];
      }

      await txToSign.sign();

      // Extract all unlocking scripts
      const spends: Record<string, { unlockingScript: string }> = {};
      for (let i = 0; i < materialInputs.length; i++) {
        const unlockingScript = txToSign.inputs[i].unlockingScript;
        if (!unlockingScript) {
          throw new Error(`Missing unlocking script for input ${i} (${materialInputs[i].name})`);
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

      // Step 7: Broadcast single transaction
      const transferTx = Transaction.fromAtomicBEEF(transferAction.tx);
      const transferBroadcast = await broadcastTX(transferTx);

      console.log(`[TRANSFER] ✓ Batch transaction broadcast: ${transferBroadcast.txid}`);

      // Build transferred materials array with correct output indices
      const transferredMaterials = materialInputs.map((input, index) => {
        const transferredToServerTokenId = `${transferBroadcast.txid}.${index}`;
        console.log(`[TRANSFER] ✓ ${input.name} at output ${index}: ${transferredToServerTokenId}`);

        return {
          lootTableId: input.lootTableId!,
          itemName: input.name,
          tokenId: transferredToServerTokenId,
          transactionId: transferBroadcast.txid!,
          quantity: input.currentQuantity!,
          quantityNeeded: input.quantityNeeded,
          description: input.description!,
          icon: input.icon!,
          rarity: input.rarity as 'common' | 'rare' | 'epic' | 'legendary',
          tier: input.tier || 1,
        };
      });

      console.log(`[TRANSFER] ✓ All ${transferredMaterials.length} materials transferred in single transaction`);

      // ===================================================
      // SERVER TRANSACTION: Craft item + handle materials
      // ===================================================

      // Call server API with transferred material tokens
      const apiResult = await fetch('/api/crafting/mint-and-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipeId,
          transferredMaterials,  // Array of {lootTableId, tokenId, quantity, quantityNeeded}
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
          paymentTx,          // WalletP2PKH payment BEEF
          walletParams,       // Derivation params for unlocking
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
        materialChangeTokens: result.materialChangeTokens,
      });

      return {
        nftId: result.nftId,
        tokenId: result.tokenId,
        transactionId: result.transferTransactionId,
        consumedTokenIds: transferredMaterials.map(m => m.tokenId),
        materialChanges: result.materialChangeTokens || [],
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
