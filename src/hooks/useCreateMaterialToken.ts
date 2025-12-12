import { useState, useCallback } from 'react';
import { WalletClient } from '@bsv/sdk';

/**
 * Hook for creating material tokens on the BSV blockchain
 *
 * Material tokens are fungible-like tokens that track quantities of materials.
 * Uses SERVER-SIDE minting architecture where:
 * 1. Server wallet mints material tokens (single source of truth)
 * 2. Server stores mintOutpoint (proof of legitimate mint)
 * 3. Server immediately transfers to user
 * 4. Server stores transferTransactionId
 *
 * This prevents fraudulent materials and simplifies SIGHASH handling.
 *
 * Features:
 * - One token per material type per user (e.g., one "Iron Ore" token with quantity)
 * - Quantity tracking on-chain
 * - Batch creation for multiple material types
 * - Provenance tracking via acquiredFrom array
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
   * Server-side minting process:
   * 1. Validate wallet connection and get user's public key
   * 2. Call server API with materials data and user's public key
   * 3. Server mints each material token (proof via mintOutpoint)
   * 4. Server immediately transfers each token to user
   * 5. Server creates MaterialToken documents
   * 6. Return token IDs and quantities
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

      console.log('Requesting server-side mint for materials:', {
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

      // Call server API for mint-and-transfer
      const apiResult = await fetch('/api/materials/mint-and-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materials: materials.map(material => ({
            lootTableId: material.lootTableId,
            itemName: material.itemName,
            description: material.description,
            icon: material.icon,
            rarity: material.rarity,
            tier: material.tier || 1,
            quantity: material.quantity,
            acquiredFrom: material.acquiredFrom || [],
          })),
          userPublicKey: publicKey,
        }),
      });

      if (!apiResult.ok) {
        const errorData = await apiResult.json();
        throw new Error(errorData.error || 'Failed to mint and transfer materials');
      }

      const response = await apiResult.json();

      console.log('Server minted and transferred materials:', response.results);

      // Transform server response to match expected format
      const results: MaterialTokenResult[] = response.results.map((result: any) => ({
        lootTableId: result.lootTableId,
        tokenId: result.tokenId,
        transactionId: result.transactionId,
        quantity: result.quantity,
        success: true,
      }));

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
