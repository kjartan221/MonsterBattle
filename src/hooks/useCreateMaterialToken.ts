import { useState, useCallback } from 'react';
import { WalletClient, Transaction } from '@bsv/sdk';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { broadcastTX } from './useOverlayFunctions';

/**
 * Hook for creating material tokens on the BSV blockchain
 *
 * Material tokens are fungible-like tokens that track quantities of materials.
 * Instead of creating 35 separate NFTs for 35 iron ore, this creates a single
 * token with quantity=35 that can be updated as materials are collected/consumed.
 *
 * Uses a unified metadata structure with useUpdateMaterialToken.
 * All material operations use name: 'material_token' regardless of create/update.
 *
 * Features:
 * - One token per material type per user (e.g., one "Iron Ore" token with quantity)
 * - Quantity tracking on-chain
 * - Batch creation for multiple material types
 * - Provenance tracking via acquiredFrom array
 * - Same metadata structure for create and update operations
 *
 * @example
 * const { createMaterialToken, isCreating, error } = useCreateMaterialToken();
 *
 * const result = await createMaterialToken({
 *   wallet: connectedWallet,
 *   materials: [
 *     { lootTableId: 'iron_ore', name: 'Iron Ore', quantity: 10, ... },
 *     { lootTableId: 'coal', name: 'Coal', quantity: 5, ... },
 *   ],
 * });
 */

export interface MaterialTokenData {
  name: string;                 // Ordinal metadata header name
  lootTableId: string;          // Reference to loot-table.ts (e.g., "iron_ore")
  itemName: string;             // Material name
  description: string;          // Material description
  icon: string;                 // Emoji icon
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  tier?: number;                // Material tier (if applicable)
  quantity: number;             // Initial quantity
  acquiredFrom?: Array<{        // Optional: Track where materials came from
    monsterId?: string;
    monsterName?: string;
    biome?: string;
    acquiredAt: string;         // ISO timestamp
    quantity: number;           // How many from this source
  }>;
}

export interface CreateMaterialTokenParams {
  wallet: WalletClient;
  materials: MaterialTokenData[]; // Support batch creation
}

export interface MaterialTokenResult {
  lootTableId: string;
  tokenId?: string;              // Blockchain token ID
  transactionId?: string;        // BSV transaction ID
  quantity: number;
  success: boolean;
  error?: string;
}

export interface CreateMaterialTokenResult {
  results: MaterialTokenResult[];
  success: boolean;
  error?: string;
}

export function useCreateMaterialToken() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create material tokens on the BSV blockchain
   *
   * Process:
   * 1. Validate wallet connection and authentication
   * 2. For each material type:
   *    a. Prepare token metadata with quantity
   *    b. Create locking script with ordinalP2PKH (deploy+mint)
   *    c. Create BSV transaction via wallet.createAction()
   *    d. Broadcast transaction to BSV network
   * 3. Create MaterialToken documents in database
   * 4. Return token IDs and quantities
   *
   * @param params - Material data and wallet
   * @returns Results for each material token created
   */
  const createMaterialToken = useCallback(async (
    params: CreateMaterialTokenParams
  ): Promise<CreateMaterialTokenResult> => {
    setIsCreating(true);
    setError(null);

    try {
      const { wallet, materials } = params;

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

      console.log('Creating material tokens:', {
        materialCount: materials.length,
        materials: materials.map(m => `${m.itemName} x${m.quantity}`),
        publicKey,
      });

      // Validate materials
      if (materials.length === 0) {
        throw new Error('No materials provided');
      }

      for (const material of materials) {
        if (material.quantity <= 0) {
          throw new Error(`Invalid quantity for ${material.itemName}: ${material.quantity}`);
        }
      }

      const results: MaterialTokenResult[] = [];

      // Process each material
      for (const material of materials) {
        console.log(`Creating token for ${material.itemName} x${material.quantity}`);

        // Prepare token metadata (unified structure for all material tokens)
        const tokenMetadata = {
          name: 'material_token',
          lootTableId: material.lootTableId,
          itemName: material.itemName,
          description: material.description,
          icon: material.icon,
          rarity: material.rarity,
          tier: material.tier || 1,
          quantity: material.quantity,
          owner: publicKey,
          acquiredFrom: material.acquiredFrom || [],
        };

        console.log(`Token metadata for ${material.itemName}:`, tokenMetadata);

        // Create locking script for material token
        const ordinalP2PKH = new OrdinalsP2PKH();
        const lockingScript = ordinalP2PKH.lock(
          publicKey,
          '',                              // Empty for minting
          tokenMetadata,
          "deploy+mint"
        );

        // Create transaction
        const tokenCreationAction = await wallet.createAction({
          description: "Minting material token",
          outputs: [
            {
              outputDescription: "New material token",
              lockingScript: lockingScript.toHex(),
              satoshis: 1,
            }
          ],
          options: {
            randomizeOutputs: false,
          }
        });

        if (!tokenCreationAction.tx) {
          throw new Error('Failed to create material token transaction');
        }
        console.log('Token creation action:', tokenCreationAction);

        // Broadcast transaction
        const tx = Transaction.fromAtomicBEEF(tokenCreationAction.tx);
        const broadcastResponse = await broadcastTX(tx);

        // Extract token ID
        const txId = broadcastResponse.txid;
        const tokenId = `${txId}.0`;

        console.log(`Material token created for ${material.itemName}:`, {
          txId,
          tokenId,
          quantity: material.quantity,
        });

        results.push({
          lootTableId: material.lootTableId,
          tokenId: tokenId,
          transactionId: txId,
          quantity: material.quantity,
          success: true,
        });
      }

      // Call backend API to save material tokens
      const apiResult = await fetch('/api/materials/create-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: results.map((result, index) => ({
            lootTableId: materials[index].lootTableId,
            itemName: materials[index].itemName,
            tokenId: result.tokenId,
            transactionId: result.transactionId,
            quantity: result.quantity,
            metadata: materials[index],
          })),
        }),
      });

      if (!apiResult.ok) {
        const errorData = await apiResult.json();
        throw new Error(errorData.error || 'Failed to save material tokens to database');
      }

      console.log(`Material tokens created: ${results.length} tokens`);

      return {
        results,
        success: true,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create material tokens';
      console.error('Failed to create material tokens:', err);
      setError(errorMessage);

      return {
        results: [],
        success: false,
        error: errorMessage,
      };

    } finally {
      setIsCreating(false);
    }
  }, []);

  return {
    createMaterialToken,
    isCreating,
    error,
  };
}
