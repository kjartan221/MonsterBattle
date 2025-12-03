'use client';

import { useState } from 'react';
import { LootItem } from '@/lib/loot-table';
import toast from 'react-hot-toast';
import { tierToRoman } from '@/utils/tierUtils';
import StatRangeIndicator from '@/components/crafting/StatRangeIndicator';
import { getInscribedItemName } from '@/utils/itemNameHelpers';
import type { Inscription } from '@/lib/types';
import { useMintItemNFT } from '@/hooks/useMintItemNFT';
import { useCreateMaterialToken } from '@/hooks/useCreateMaterialToken';
import { useUpdateMaterialToken } from '@/hooks/useUpdateMaterialToken';
import { useAuthContext } from '@/contexts/WalletContext';
import MaterialMintModal from './MaterialMintModal';

interface InventoryDetailsModalProps {
  item: LootItem & {
    acquiredAt: Date;
    inventoryId: string;
    nftLootId?: string;
    mintTransactionId?: string;
    isMinted: boolean;
    borderGradient?: { color1: string; color2: string }; // User-specific gradient
    count?: number; // Number of items in stack (if stacked)
    items?: any[]; // All individual items in the stack (if stacked)
    tier: number; // Item tier (1-5)
    crafted?: boolean; // Whether item was crafted
    statRoll?: number; // Stat roll for crafted items
    isEmpowered?: boolean; // Whether item was dropped by corrupted monster
    prefix?: Inscription; // Prefix inscription
    suffix?: Inscription; // Suffix inscription
    enhanced?: boolean; // Phase 3.5: Enhanced consumable (infinite uses)
  };
  onClose: () => void;
  onMintSuccess?: () => void; // Callback to refresh inventory after minting
}

export default function InventoryDetailsModal({ item, onClose, onMintSuccess }: InventoryDetailsModalProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [isMintingMaterial, setIsMintingMaterial] = useState(false);

  // Blockchain minting hooks and wallet context
  const { mintItemNFT, isMinting, error: mintError } = useMintItemNFT();
  const { createMaterialToken, isCreating } = useCreateMaterialToken();
  const { updateMaterialToken, isUpdating } = useUpdateMaterialToken();
  const { userWallet, isAuthenticated, initializeWallet } = useAuthContext();

  // Detect if this is a material item
  const isMaterial = item.type === 'material';

  const rarityColors = {
    common: 'text-gray-400 border-gray-400',
    rare: 'text-blue-400 border-blue-400',
    epic: 'text-purple-400 border-purple-400',
    legendary: 'text-amber-400 border-amber-400'
  };

  const handleConnectWallet = async () => {
    setIsConnectingWallet(true);
    try {
      await initializeWallet();
    } catch (error) {
      console.error('Wallet connection error:', error);
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleMaterialMint = async (quantity: number) => {
    setIsMintingMaterial(true);
    const mintingToast = toast.loading('Checking existing tokens...');

    try {
      // Check wallet connection
      if (!userWallet) {
        throw new Error('Wallet not connected. Please connect your BSV wallet first.');
      }

      if (!isAuthenticated) {
        throw new Error('Wallet not authenticated. Please authenticate your wallet.');
      }

      // Check if this material+tier already has a token
      const checkResponse = await fetch('/api/materials/check-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lootTableId: item.lootId,
          tier: item.tier || 1,
        }),
      });

      const checkData = await checkResponse.json();
      const existingToken = checkData.exists ? checkData.token : null;

      if (existingToken) {
        // Token exists - update quantity
        toast.loading('Updating existing token...', { id: mintingToast });

        const updateResult = await updateMaterialToken({
          wallet: userWallet,
          updates: [{
            name: 'material_token',
            lootTableId: item.lootId,
            itemName: item.name,
            description: item.description,
            icon: item.icon,
            rarity: item.rarity,
            tier: item.tier || 1,
            currentTokenId: existingToken.tokenId,
            currentQuantity: existingToken.quantity,
            operation: 'add',
            quantity: quantity,
            reason: 'Minting additional materials from inventory',
          }],
        });

        if (!updateResult.success || !updateResult.results[0]?.success) {
          throw new Error(updateResult.error || updateResult.results[0]?.error || 'Failed to update material token');
        }

        toast.success(`Token updated! Added ${quantity} to existing ${item.name}`, {
          id: mintingToast,
          duration: 5000
        });

      } else {
        // Token doesn't exist - create new
        toast.loading('Creating new material token...', { id: mintingToast });

        const createResult = await createMaterialToken({
          wallet: userWallet,
          materials: [{
            name: 'material_token',
            lootTableId: item.lootId,
            itemName: item.name,
            description: item.description,
            icon: item.icon,
            rarity: item.rarity,
            tier: item.tier || 1,
            quantity: quantity,
          }],
        });

        if (!createResult.success || !createResult.results[0]?.success) {
          throw new Error(createResult.error || createResult.results[0]?.error || 'Failed to create material token');
        }

        toast.success(`Material token created! Minted ${quantity}x ${item.name}`, {
          id: mintingToast,
          duration: 5000
        });
      }

      // Call the callback to refresh inventory
      if (onMintSuccess) {
        onMintSuccess();
      }

      // Close modals after successful minting
      setShowMaterialModal(false);
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Material minting error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to mint material token', { id: mintingToast });
    } finally {
      setIsMintingMaterial(false);
    }
  };

  const handleMintNFT = async () => {
    const mintingToast = toast.loading('Connecting to wallet...');

    try {
      // Check wallet connection
      if (!userWallet) {
        throw new Error('Wallet not connected. Please connect your BSV wallet first.');
      }

      if (!isAuthenticated) {
        throw new Error('Wallet not authenticated. Please authenticate your wallet.');
      }

      toast.loading('Preparing NFT metadata...', { id: mintingToast });

      // Prepare item data for blockchain minting
      const itemData = {
        inventoryItemId: item.inventoryId,
        lootTableId: item.lootId,
        name: item.name,
        description: item.description,
        icon: item.icon,
        rarity: item.rarity,
        type: item.type as 'weapon' | 'armor' | 'consumable' | 'artifact', // Exclude material type
        tier: item.tier || 1,
        equipmentStats: item.equipmentStats ? { ...item.equipmentStats } as Record<string, number> : undefined,
        prefix: item.prefix?.name,
        suffix: item.suffix?.name,
        borderGradient: item.borderGradient || { color1: '#ffffff', color2: '#cccccc' },
        acquiredFrom: undefined, // TODO: Add provenance data if available in the future
      };

      toast.loading('Creating blockchain transaction...', { id: mintingToast });

      // Call the blockchain minting hook
      const result = await mintItemNFT({
        wallet: userWallet,
        itemData,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to mint NFT');
      }

      toast.success(`NFT minted successfully! TX: ${result.transactionId?.slice(0, 8)}...`, {
        id: mintingToast,
        duration: 5000
      });

      // Call the callback to refresh inventory
      if (onMintSuccess) {
        onMintSuccess();
      }

      // Close modal after successful minting
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Minting error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to mint NFT', { id: mintingToast });
    }
  };

  // Phase 3.5: Handle consumable enhancement
  const handleEnhanceConsumable = async () => {
    setIsEnhancing(true);
    const enhancingToast = toast.loading('Enhancing consumable...');

    try {
      const response = await fetch('/api/consumables/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetItemId: item.inventoryId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enhance consumable');
      }

      toast.success(`${data.itemName} enhanced! It now has infinite uses with cooldown.`, { id: enhancingToast, duration: 4000 });

      // Call the callback to refresh inventory
      if (onMintSuccess) {
        onMintSuccess();
      }

      // Close modal after successful enhancement
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Enhancement error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enhance consumable', { id: enhancingToast });
    } finally {
      setIsEnhancing(false);
    }
  };

  // Calculate enhancement cost based on rarity
  const getEnhancementCost = (rarity: string): number => {
    const costs: Record<string, number> = {
      common: 500,
      rare: 2000,
      epic: 5000,
      legendary: 10000
    };
    return costs[rarity] || 500;
  };

  const typeLabels = {
    weapon: 'Weapon',
    armor: 'Armor',
    consumable: 'Consumable',
    material: 'Material',
    artifact: 'Artifact',
    spell_scroll: 'Spell Scroll',
    inscription_scroll: 'Inscription Scroll'
  };

  // Use custom gradient border if available
  const modalBorderStyle = item.borderGradient ? {
    borderImage: `linear-gradient(135deg, ${item.borderGradient.color1}, ${item.borderGradient.color2}) 1`,
    boxShadow: `0 0 30px ${item.borderGradient.color1}60, 0 0 30px ${item.borderGradient.color2}60, 0 20px 25px -5px rgba(0, 0, 0, 0.3)` // Gradient glow + shadow
  } : {};

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border-2 border-amber-600 max-w-md w-full p-6 shadow-2xl relative"
        style={modalBorderStyle}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Item icon and name */}
        <div className="text-center mb-6">
          <div className="text-7xl mb-3">{item.icon}</div>
          <h2 className={`text-2xl font-bold ${rarityColors[item.rarity].split(' ')[0]}`}>
            {getInscribedItemName(item.name, item.prefix, item.suffix)}
          </h2>
          {item.count && item.count > 1 && (
            <div className="mt-2 inline-block bg-gray-800 border-2 border-white text-white text-sm font-bold px-3 py-1 rounded-full">
              You have {item.count} of these
            </div>
          )}
        </div>

        {/* Metadata grid */}
        <div className="space-y-4">
          {/* Rarity */}
          <div className="flex justify-between items-center pb-3 border-b border-gray-700">
            <span className="text-gray-400 text-sm font-medium">Rarity</span>
            <span className={`font-bold uppercase text-sm ${rarityColors[item.rarity].split(' ')[0]}`}>
              {item.rarity}
            </span>
          </div>

          {/* Type */}
          <div className="flex justify-between items-center pb-3 border-b border-gray-700">
            <span className="text-gray-400 text-sm font-medium">Type</span>
            <span className="text-white font-medium">{typeLabels[item.type]}</span>
          </div>

          {/* Tier */}
          <div className="flex justify-between items-center pb-3 border-b border-gray-700">
            <span className="text-gray-400 text-sm font-medium">Tier</span>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">{tierToRoman(item.tier || 1)}</span>
              <span className="text-gray-500 text-xs">({item.tier || 1})</span>
            </div>
          </div>

          {/* Phase 3.5: Consumable Enhancement Section */}
          {item.type === 'consumable' && (
            <div className="pb-3 border-b border-gray-700">
              <span className="text-gray-400 text-sm font-medium block mb-2">Enhancement</span>

              {item.enhanced ? (
                // Already enhanced
                <div className="bg-cyan-900/30 border-2 border-cyan-500/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 text-lg">✨</span>
                    <span className="text-cyan-300 font-bold text-sm">Enhanced Consumable</span>
                  </div>
                  <div className="text-cyan-200 text-xs leading-relaxed">
                    This consumable has <span className="font-bold text-cyan-300">infinite uses</span>. Cooldown still applies.
                  </div>
                </div>
              ) : (
                // Can be enhanced
                <div className="space-y-3">
                  <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-lg">💎</span>
                      <span className="text-gray-300 font-medium text-sm">Not Enhanced</span>
                    </div>
                    <div className="text-gray-400 text-xs leading-relaxed">
                      Enhance this consumable to make it <span className="font-bold text-white">infinite-use</span> (with cooldown).
                    </div>
                    <div className="text-gray-400 text-xs">
                      <div>💰 Cost: <span className="text-yellow-400 font-bold">{getEnhancementCost(item.rarity)} gold</span></div>
                      <div>📦 Required: <span className="text-white font-bold">5 copies</span> of this consumable</div>
                      <div className="mt-1">📊 You have: <span className="text-white font-bold">{item.count || 1} copies</span></div>
                    </div>
                  </div>

                  {(item.count || 1) >= 5 ? (
                    <button
                      onClick={handleEnhanceConsumable}
                      disabled={isEnhancing}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isEnhancing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Enhancing...</span>
                        </>
                      ) : (
                        <>
                          <span>✨</span>
                          <span>Enhance Consumable</span>
                          <span className="text-sm opacity-80">({getEnhancementCost(item.rarity)}g)</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                      <div className="text-red-400 text-xs text-center">
                        Need {5 - (item.count || 1)} more copies to enhance
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empowered Status */}
          {item.isEmpowered && (
            <div className="pb-3 border-b border-gray-700">
              <span className="text-gray-400 text-sm font-medium block mb-2">Empowered Item</span>
              <div className="bg-purple-900/30 border-2 border-purple-500/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 text-lg">⚡</span>
                  <span className="text-purple-300 font-bold text-sm">Corrupted Monster Drop</span>
                </div>
                <div className="text-purple-200 text-xs leading-relaxed">
                  This item was dropped by a corrupted monster and grants <span className="font-bold text-purple-300">+20% bonus stats</span> if it has equipment stats.
                </div>
              </div>
            </div>
          )}

          {/* Crafted Status & Stat Roll */}
          {item.crafted && (
            <div className="pb-3 border-b border-gray-700">
              <span className="text-gray-400 text-sm font-medium block mb-2">Crafted Item</span>
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 text-lg">🔨</span>
                  <span className="text-purple-300 font-medium text-sm">Player Crafted</span>
                </div>
                {item.statRoll && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400">
                      Stat Quality:
                    </div>
                    <StatRangeIndicator statRoll={item.statRoll} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="pb-3 border-b border-gray-700">
            <span className="text-gray-400 text-sm font-medium block mb-2">Description</span>
            <p className="text-white text-sm leading-relaxed">{item.description}</p>
          </div>

          {/* Equipment Stats */}
          {item.equipmentStats && (
            <div className="pb-3 border-b border-gray-700">
              <span className="text-gray-400 text-sm font-medium block mb-2">Equipment Stats</span>
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                {item.equipmentStats.damageBonus !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Damage Bonus:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.damageBonus}</span>
                  </div>
                )}
                {item.equipmentStats.critChance !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Crit Chance:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.critChance}%</span>
                  </div>
                )}
                {item.equipmentStats.defense !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Defense:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.defense}</span>
                  </div>
                )}
                {item.equipmentStats.maxHpBonus !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Max HP Bonus:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.maxHpBonus}</span>
                  </div>
                )}
                {item.equipmentStats.attackSpeed !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Attack Speed:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.attackSpeed}</span>
                  </div>
                )}
                {item.equipmentStats.coinBonus !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Coin Bonus:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.coinBonus}%</span>
                  </div>
                )}
                {item.equipmentStats.healBonus !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Heal Bonus:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.healBonus}%</span>
                  </div>
                )}
                {item.equipmentStats.lifesteal !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Lifesteal (Offense):</span>
                    <span className="text-red-400 font-bold">+{item.equipmentStats.lifesteal}%</span>
                  </div>
                )}
                {item.equipmentStats.defensiveLifesteal !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Tank Heal (Defense):</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.defensiveLifesteal}%</span>
                  </div>
                )}
                {item.equipmentStats.thorns !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Thorns (Reflect):</span>
                    <span className="text-orange-400 font-bold">+{item.equipmentStats.thorns}%</span>
                  </div>
                )}
                {item.equipmentStats.autoClickRate !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Auto-Click Rate:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.autoClickRate}/sec</span>
                  </div>
                )}
                {item.equipmentStats.fireResistance !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Fire Resistance:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.fireResistance}%</span>
                  </div>
                )}
                {item.equipmentStats.poisonResistance !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Poison Resistance:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.poisonResistance}%</span>
                  </div>
                )}
                {item.equipmentStats.bleedResistance !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Bleed Resistance:</span>
                    <span className="text-green-400 font-bold">+{item.equipmentStats.bleedResistance}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NFT Status */}
          <div className="pb-3 border-b border-gray-700">
            <span className="text-gray-400 text-sm font-medium block mb-2">NFT Status</span>
            {!item.isMinted ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-gray-500/10 border border-gray-500/30 rounded-lg p-3">
                  <span className="text-gray-400 text-lg">📋</span>
                  <div>
                    <div className="text-gray-300 font-medium text-sm">Not Minted Yet</div>
                    <div className="text-gray-400 text-xs mt-1">
                      Mint this item as an NFT to preserve it on the blockchain
                    </div>
                  </div>
                </div>

                {/* Wallet Connection Status */}
                {!userWallet || !isAuthenticated ? (
                  <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-amber-400 text-lg">⚠️</span>
                      <span className="text-amber-300 font-medium text-sm">Wallet Not Connected</span>
                    </div>
                    <div className="text-amber-200 text-xs mb-3">
                      You need to connect your BSV wallet to mint items as NFTs. The wallet will be used to sign the blockchain transaction.
                    </div>
                    <button
                      onClick={handleConnectWallet}
                      disabled={isConnectingWallet}
                      className={`w-full text-white text-sm font-medium py-2 px-4 rounded transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                        isConnectingWallet
                          ? 'bg-amber-800 cursor-not-allowed'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {isConnectingWallet ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        'Connect Wallet'
                      )}
                    </button>
                  </div>
                ) : null}

                <button
                  onClick={isMaterial ? () => setShowMaterialModal(true) : handleMintNFT}
                  disabled={isMinting || !userWallet || !isAuthenticated}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isMinting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Minting on Blockchain...</span>
                    </>
                  ) : !userWallet || !isAuthenticated ? (
                    <>
                      <span>🔒</span>
                      <span>Connect Wallet to Mint</span>
                    </>
                  ) : isMaterial ? (
                    <>
                      <span>💎</span>
                      <span>Mint Material Token</span>
                      <span className="text-sm opacity-80">(costs BSV)</span>
                    </>
                  ) : (
                    <>
                      <span>💎</span>
                      <span>Mint as NFT</span>
                      <span className="text-sm opacity-80">(costs BSV)</span>
                    </>
                  )}
                </button>
              </div>
            ) : item.mintTransactionId ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-lg">✓</span>
                  <span className="text-green-400 font-medium text-sm">Minted on Blockchain</span>
                </div>
                <div className="text-xs text-gray-500 font-mono break-all">
                  TX: {item.mintTransactionId}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <div className="flex-shrink-0">
                  <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <div className="text-yellow-400 font-medium text-sm">Minting Your NFT...</div>
                  <div className="text-yellow-300/70 text-xs mt-1">
                    Transaction is being created on the blockchain
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Acquired date */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm font-medium">Acquired</span>
            <span className="text-white text-sm">
              {new Date(item.acquiredAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>

          {/* Custom Border Gradient */}
          {item.borderGradient && (
            <div className="pb-3 border-b border-gray-700">
              <span className="text-gray-400 text-sm font-medium block mb-2">Your Unique Gradient</span>
              <div className="space-y-3">
                {/* Gradient preview */}
                <div
                  className="w-full h-16 rounded-lg border-2"
                  style={{
                    background: `linear-gradient(135deg, ${item.borderGradient.color1}, ${item.borderGradient.color2})`,
                    borderImage: `linear-gradient(135deg, ${item.borderGradient.color1}, ${item.borderGradient.color2}) 1`,
                    boxShadow: `0 0 15px ${item.borderGradient.color1}80, 0 0 15px ${item.borderGradient.color2}80`
                  }}
                />
                {/* Color codes */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border"
                      style={{
                        backgroundColor: item.borderGradient.color1,
                        boxShadow: `0 0 8px ${item.borderGradient.color1}80`
                      }}
                    />
                    <div className="text-white text-xs font-mono">{item.borderGradient.color1}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded border"
                      style={{
                        backgroundColor: item.borderGradient.color2,
                        boxShadow: `0 0 8px ${item.borderGradient.color2}80`
                      }}
                    />
                    <div className="text-white text-xs font-mono">{item.borderGradient.color2}</div>
                  </div>
                </div>
                <div className="text-gray-500 text-xs text-center">Generated from your public key</div>
              </div>
            </div>
          )}

          {/* Item ID (for reference) */}
          <div className="pt-3 border-t border-gray-700">
            <span className="text-gray-500 text-xs font-mono block">ID: {item.lootId}</span>
          </div>
        </div>

        {/* Close button at bottom */}
        <button
          onClick={onClose}
          className="mt-6 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>

      {/* Material Mint Modal */}
      {showMaterialModal && (
        <MaterialMintModal
          materialName={item.name}
          tier={item.tier || 1}
          totalCount={item.count || 1}
          icon={item.icon}
          rarity={item.rarity}
          onConfirm={handleMaterialMint}
          onCancel={() => setShowMaterialModal(false)}
          isProcessing={isMintingMaterial}
        />
      )}
    </div>
  );
}
