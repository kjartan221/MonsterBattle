import { useState, useCallback } from 'react';
import { WalletClient, Transaction, Beef } from '@bsv/sdk';
import { OrdinalsP2PKH } from '@/utils/ordinalP2PKH';
import { createWalletPayment } from '@/utils/createWalletPayment';
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
   * Update equipment NFT with inscription scroll (Server-Side Pattern)
   *
   * Process (similar to crafting):
   * 1. Validate wallet connection and authentication
   * 2. CLIENT: Transfer equipment token to server
   * 3. CLIENT: Transfer inscription scroll token to server
   * 4. CLIENT: Create WalletP2PKH payment for fees
   * 5. SERVER: Validates transferred tokens
   * 6. SERVER: Unlocks equipment + scroll + payment
   * 7. SERVER: Creates updated equipment token with new prefix/suffix
   * 8. SERVER: Broadcasts transaction
   * 9. SERVER: Updates database
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

      console.log('Updating equipment NFT (transfer-to-server flow):', {
        equipmentName: equipmentItem.name,
        scrollName: inscriptionScroll.name,
        inscriptionType,
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
      // CLIENT TRANSACTIONS: Transfer tokens to server
      // ===================================================

      const ordinalP2PKH = new OrdinalsP2PKH();

      // TRANSFER 1: Equipment token to server
      console.log(`[TRANSFER] Transferring ${equipmentItem.name} to server for update`);

      const equipmentTxid = equipmentItem.tokenId.split('.')[0];
      const equipmentTx = await getTransactionByTxID(equipmentTxid);

      if (!equipmentTx || !equipmentTx.outputs || !equipmentTx.outputs[0]) {
        throw new Error(`Could not find equipment transaction: ${equipmentTxid}`);
      }

      const equipmentTransaction = Transaction.fromBEEF(equipmentTx.outputs[0].beef);
      const transferEquipmentTx = new Transaction();

      transferEquipmentTx.addInput({
        sourceTransaction: equipmentTransaction,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: ordinalP2PKH.unlock(wallet, "all", false),
      });

      const equipmentAssetId = equipmentItem.tokenId.replace('.', '_');
      transferEquipmentTx.addOutput({
        lockingScript: ordinalP2PKH.lock(
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
        ),
        satoshis: 1,
      });

      await transferEquipmentTx.sign();
      const equipmentTransferBroadcast = await broadcastTX(transferEquipmentTx);
      const transferredEquipmentTokenId = `${equipmentTransferBroadcast.txid}.0`;

      console.log(`[TRANSFER] Equipment transferred to server: ${transferredEquipmentTokenId}`);

      // TRANSFER 2: Inscription scroll token to server
      console.log(`[TRANSFER] Transferring ${inscriptionScroll.name} to server for consumption`);

      const scrollTxid = inscriptionScroll.tokenId.split('.')[0];
      const scrollTx = await getTransactionByTxID(scrollTxid);

      if (!scrollTx || !scrollTx.outputs || !scrollTx.outputs[0]) {
        throw new Error(`Could not find inscription scroll transaction: ${scrollTxid}`);
      }

      const scrollTransaction = Transaction.fromBEEF(scrollTx.outputs[0].beef);
      const transferScrollTx = new Transaction();

      transferScrollTx.addInput({
        sourceTransaction: scrollTransaction,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: ordinalP2PKH.unlock(wallet, "all", false),
      });

      const scrollAssetId = inscriptionScroll.tokenId.replace('.', '_');
      transferScrollTx.addOutput({
        lockingScript: ordinalP2PKH.lock(
          serverPublicKey,
          scrollAssetId,
          {
            name: 'inscription_scroll',
            itemName: inscriptionScroll.name,
            description: inscriptionScroll.description,
            icon: inscriptionScroll.icon,
            rarity: inscriptionScroll.rarity,
            inscriptionData: inscriptionScroll.inscriptionData,
          },
          'transfer',
          undefined  // No amt field for scrolls
        ),
        satoshis: 1,
      });

      await transferScrollTx.sign();
      const scrollTransferBroadcast = await broadcastTX(transferScrollTx);
      const transferredScrollTokenId = `${scrollTransferBroadcast.txid}.0`;

      console.log(`[TRANSFER] Scroll transferred to server: ${transferredScrollTokenId}`);

      // ===================================================
      // SERVER TRANSACTION: Update equipment
      // ===================================================

      // Prepare updated inscription data
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
          inscriptionScrollInventoryId: inscriptionScroll.inventoryItemId,
          inscriptionScrollTokenId: inscriptionScroll.tokenId,

          // Transferred tokens (server will unlock these)
          transferredEquipmentTokenId,
          transferredEquipmentTransactionId: equipmentTransferBroadcast.txid,
          transferredScrollTokenId,
          transferredScrollTransactionId: scrollTransferBroadcast.txid,

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
          scrollData: inscriptionScroll.inscriptionData,
          inscriptionType,

          // Updated inscriptions
          updatedPrefix,
          updatedSuffix,

          // User public key (for final transfer back)
          userPublicKey: publicKey,

          // Payment
          paymentTx,          // WalletP2PKH payment BEEF
          walletParams,       // Derivation params for unlocking
        }),
      });

      if (!apiResult.ok) {
        const errorData = await apiResult.json();
        throw new Error(errorData.error || 'Failed to update equipment');
      }

      const result = await apiResult.json();

      console.log('Server updated equipment:', {
        nftId: result.nftId,
        tokenId: result.tokenId,
        transactionId: result.transactionId,
      });

      return {
        nftId: result.nftId,
        tokenId: result.tokenId,
        transactionId: result.transactionId,
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
