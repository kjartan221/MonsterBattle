import { useState, useCallback } from 'react';
import { WalletClient, Transaction } from '@bsv/sdk';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { broadcastTX } from './useOverlayFunctions';

/**
 * Hook for minting a dropped item as an NFT on the BSV blockchain
 *
 * This hook converts an inventory item (dropped from monsters) into a blockchain NFT.
 * Users collect items from battles, and can choose to mint valuable items as NFTs
 * by paying a BSV transaction fee.
 *
 * NOTE: This hook does NOT handle material tokens. Use useCreateMaterialToken for materials.
 *
 * @example
 * const { mintItemNFT, isMinting, error } = useMintItemNFT();
 *
 * const result = await mintItemNFT({
 *   wallet: connectedWallet,
 *   itemData: inventoryItem,
 * });
 */

export interface MintItemNFTParams {
  wallet: WalletClient;
  itemData: {
    inventoryItemId: string;      // UserInventory document ID
    lootTableId: string;          // Reference to loot-table.ts
    name: string;                 // Item name (e.g., "Dragon Scale")
    description: string;          // Item description
    icon: string;                 // Emoji icon
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    type: 'weapon' | 'armor' | 'consumable' | 'artifact';  // NO materials - use useCreateMaterialToken
    tier?: number;                // Item tier (1-5)
    equipmentStats?: Record<string, number>;  // Stats if equipment
    prefix?: string;              // Optional prefix for equipment
    suffix?: string;              // Optional suffix for equipment
    borderGradient: {             // User-specific gradient colors
      color1: string;
      color2: string;
    };
    acquiredFrom?: {              // Provenance data (from monster drop)
      monsterId: string;
      monsterName: string;
      biome: string;
      tier: number;
      acquiredAt: string;         // ISO timestamp
    };
  };
}

export interface MintItemNFTResult {
  nftId?: string;              // NFT document ID (NFTLoot collection)
  tokenId?: string;            // Blockchain token identifier
  transactionId?: string;      // BSV transaction ID
  success: boolean;
  error?: string;
}

export function useMintItemNFT() {
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Mint an inventory item as an NFT on the BSV blockchain
   *
   * Process:
   * 1. Validate wallet connection and authentication
   * 2. Prepare NFT metadata (item stats, provenance, gradient colors)
   * 3. Create locking script with ordinalP2PKH (deploy+mint)
   * 4. Create BSV transaction via wallet.createAction()
   * 5. Broadcast transaction to BSV network
   * 6. Create NFTLoot document in database with transaction ID
   * 7. Update UserInventory with nftLootId reference
   * 8. Return NFT ID and transaction ID
   *
   * @param params - Minting parameters including wallet and item data
   * @returns Result with NFT ID, token ID, and transaction ID
   */
  const mintItemNFT = useCallback(async (
    params: MintItemNFTParams
  ): Promise<MintItemNFTResult> => {
    setIsMinting(true);
    setError(null);

    try {
      const { wallet, itemData } = params;

      // Validate wallet
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      const isAuthenticated = await wallet.isAuthenticated();
      if (!isAuthenticated) {
        throw new Error('Wallet not authenticated');
      }

      // Get player public key for NFT ownership
      const { publicKey } = await wallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
      });

      console.log('Minting item NFT:', {
        itemName: itemData.name,
        rarity: itemData.rarity,
        type: itemData.type,
        publicKey,
      });

      // Prepare NFT metadata for blockchain inscription
      const nftMetadata = {
        name: 'game_item',
        itemName: itemData.name,
        description: itemData.description,
        icon: itemData.icon,
        rarity: itemData.rarity,
        itemType: itemData.type,
        tier: itemData.tier || 1,
        stats: itemData.equipmentStats || {},
        crafted: null,  // Dropped items are not crafted
        enhancements: {
          prefix: itemData.prefix || null,
          suffix: itemData.suffix || null,
        },
        visual: {
          borderGradient: itemData.borderGradient,
        },
        acquiredFrom: itemData.acquiredFrom || null,
      };

      console.log('NFT metadata:', nftMetadata);

      // Create the locking script for new NFT token
      const ordinalP2PKH = new OrdinalsP2PKH();
      const lockingScript = ordinalP2PKH.lock(
        publicKey,        // Lock to user's public key
        '',               // Empty string for minting (no previous token)
        nftMetadata,      // Token metadata
        "deploy+mint"     // Type: creating new token
      );

      // Create the transaction
      const tokenCreationAction = await wallet.createAction({
        description: "Minting new item NFT",
        outputs: [
          {
            outputDescription: "New NFT item",
            lockingScript: lockingScript.toHex(),
            satoshis: 1,
          }
        ],
        options: {
          randomizeOutputs: false,
        }
      });

      if (!tokenCreationAction.tx) {
        throw new Error('Failed to create minting transaction');
      }
      console.log('Token creation action:', tokenCreationAction);

      // Broadcast to blockchain using overlay functions
      const tx = Transaction.fromAtomicBEEF(tokenCreationAction.tx);
      const broadcastResponse = await broadcastTX(tx);

      // Extract txid from response
      const txId = broadcastResponse.txid;
      const tokenId = `${txId}.0`;

      console.log('Item NFT minted on blockchain:', {
        txId,
        tokenId,
      });

      // Call backend API to create NFTLoot document and update UserInventory
      const apiResult = await fetch('/api/nft/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventoryItemId: itemData.inventoryItemId,
          transactionId: txId,
          tokenId: tokenId,
          metadata: nftMetadata,
        }),
      });

      if (!apiResult.ok) {
        const errorData = await apiResult.json();
        throw new Error(errorData.error || 'Failed to save NFT to database');
      }

      const { nftId } = await apiResult.json();

      return {
        nftId: nftId,
        tokenId: tokenId,
        transactionId: txId,
        success: true,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mint item NFT';
      console.error('Failed to mint item NFT:', err);
      setError(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };

    } finally {
      setIsMinting(false);
    }
  }, []);

  return {
    mintItemNFT,
    isMinting,
    error,
  };
}
