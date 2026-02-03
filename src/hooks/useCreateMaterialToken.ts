import { useState, useCallback } from 'react';
import { WalletClient } from '@bsv/sdk';
import { createWalletPayment } from '@/utils/createWalletPayment';

/**
 * Hook for creating material tokens on the BSV blockchain
 *
 * Material tokens are fungible-like tokens that track quantities of materials.
 * Uses SERVER-SIDE minting architecture where:
 * 1. Client creates WalletP2PKH payment to server (with derivation params)
 * 2. Server wallet mints material tokens (single source of truth)
 * 3. Server stores mintOutpoint (proof of legitimate mint)
 * 4. Server immediately transfers to user
 * 5. Server stores transferTransactionId
 *
 * This prevents fraudulent materials and simplifies SIGHASH handling.
 *
 * Payment System:
 * - Uses WalletP2PKH (not plain P2PKH) for proper derivation
 * - Client provides protocolID, keyID, and counterparty for unlocking
 * - Server can unlock using wallet parameters and source transaction
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
  inventoryItemIds?: string[];  // UserInventory IDs to consume after minting
  acquiredFrom?: Array<{        // Optional: Track where materials came from (game data only)
    monsterName: string;
    biome: string;
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

      // Fetch server identity key for payment counterparty
      const serverPubKeyResponse = await fetch('/api/server-identity-key');
      if (!serverPubKeyResponse.ok) {
        throw new Error('Failed to fetch server identity key');
      }
      const { publicKey: serverIdentityKey } = await serverPubKeyResponse.json();

      console.log('Creating WalletP2PKH payment transaction (100 sats)...');

      // Create WalletP2PKH payment with derivation params
      const { paymentTx, paymentTxId, walletParams } = await createWalletPayment(
        wallet,
        serverIdentityKey,
        100,
        'Payment for material minting fees'
      );

      console.log('WalletP2PKH payment transaction created:', {
        txid: paymentTxId,
        satoshis: 100,
        walletParams,
      });

      console.log('Requesting server-side mint for materials:', {
        materialCount: materials.length,
        materials: materials.map(m => `${m.itemName} x${m.quantity}`),
        publicKey,
        paymentTxId,
        walletParams,
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
            inventoryItemIds: material.inventoryItemIds || [],  // IDs to consume
            acquiredFrom: material.acquiredFrom || [],
          })),
          userPublicKey: publicKey,
          paymentTx,          // WalletP2PKH payment BEEF
          walletParams,       // Derivation params for unlocking
        }),
      });

      if (!apiResult.ok) {
        const errorData = await apiResult.json();

        // If 409 Conflict (token already exists), this is expected
        // Frontend should handle this by calling useUpdateMaterialToken instead
        if (apiResult.status === 409 && errorData.shouldUseAddAndMerge) {
          console.warn('Token already exists, should use add-and-merge route:', errorData);
          throw new Error('SWITCH_TO_ADD_AND_MERGE'); // Special error code for frontend
        }

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
