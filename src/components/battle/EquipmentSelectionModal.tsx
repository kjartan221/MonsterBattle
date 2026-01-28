'use client';

import { useState, useEffect } from 'react';
import { useEquipment, EquipmentSlot } from '@/contexts/EquipmentContext';
import { getLootItemById, LootItem } from '@/lib/loot-table';
import toast from 'react-hot-toast';
import { colorToRGBA } from '@/utils/publicKeyToColor';
import { tierToRoman, getTierBadgeClassName } from '@/utils/tierUtils';
import StatRangeIndicator from '@/components/crafting/StatRangeIndicator';
import CorruptionOverlay from '@/components/battle/CorruptionOverlay';
import { scaleItemStats } from '@/utils/itemTierScaling';
import type { Tier } from '@/lib/biome-config';
import { getInscribedItemName } from '@/utils/itemNameHelpers';
import type { Inscription, InscriptionType } from '@/lib/types';

/**
 * Maps inscription types to equipment stat keys
 */
function getInscriptionStatKey(inscriptionType: InscriptionType): string | null {
  const mapping: Record<InscriptionType, string> = {
    damage: 'damageBonus',
    critical: 'critChance',
    protection: 'hpReduction', // defense
    vitality: 'maxHpBonus',
    haste: 'attackSpeed',
    fortune: 'coinBonus',
    healing: 'healBonus',
    lifesteal: 'lifesteal',
    defensiveLifesteal: 'defensiveLifesteal',
    thorns: 'thorns',
    autoclick: 'autoClickRate'
  };
  return mapping[inscriptionType] || null;
}

interface UserInventoryItem {
  _id: string;
  lootTableId: string;
  tier: number;
  borderGradient: { color1: string; color2: string };
  acquiredAt: string;
  crafted?: boolean;
  statRoll?: number;
  isEmpowered?: boolean;
  prefix?: Inscription;
  suffix?: Inscription;
}

interface EquipmentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: EquipmentSlot;
}

export default function EquipmentSelectionModal({ isOpen, onClose, slot }: EquipmentSelectionModalProps) {
  const { equipItem, unequipItem, equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2 } = useEquipment();
  const [items, setItems] = useState<UserInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEquipping, setIsEquipping] = useState(false);

  const getCurrentlyEquipped = () => {
    switch (slot) {
      case 'weapon':
        return equippedWeapon;
      case 'armor':
        return equippedArmor;
      case 'accessory1':
        return equippedAccessory1;
      case 'accessory2':
        return equippedAccessory2;
    }
  };

  const getSlotLabel = () => {
    switch (slot) {
      case 'weapon':
        return 'Weapon';
      case 'armor':
        return 'Armor';
      case 'accessory1':
        return 'Accessory 1';
      case 'accessory2':
        return 'Accessory 2';
    }
  };

  const getFilterType = (): string => {
    switch (slot) {
      case 'weapon':
        return 'weapon';
      case 'armor':
        return 'armor';
      case 'accessory1':
      case 'accessory2':
        return 'artifact';
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInventoryItems();
    }
  }, [isOpen, slot]);

  const fetchInventoryItems = async () => {
    setIsLoading(true);
    try {
      // Only fetch minted items (backend filtering)
      const response = await fetch('/api/inventory/get?mintedOnly=true');
      if (!response.ok) {
        throw new Error('Failed to fetch inventory');
      }

      const data = await response.json();
      const filterType = getFilterType();

      // Get all currently equipped inventory IDs (from all slots)
      const equippedInventoryIds = [
        equippedWeapon?.inventoryId,
        equippedArmor?.inventoryId,
        equippedAccessory1?.inventoryId,
        equippedAccessory2?.inventoryId
      ].filter(Boolean); // Remove undefined/null values

      // Filter items by type that can be equipped in this slot
      // AND exclude items already equipped in ANY slot
      const filteredItems = (data.inventory || []).filter((item: any) => {
        const lootItem = getLootItemById(item.lootId);
        const isCorrectType = lootItem && lootItem.type === filterType && lootItem.equipmentStats;
        const isNotEquippedElsewhere = !equippedInventoryIds.includes(item.inventoryId);
        return isCorrectType && isNotEquippedElsewhere;
      });

      // Map to UserInventoryItem format
      const mappedItems: UserInventoryItem[] = filteredItems.map((item: any) => ({
        _id: item.inventoryId,
        lootTableId: item.lootId,
        tier: item.tier,
        borderGradient: item.borderGradient,
        acquiredAt: item.acquiredAt,
        crafted: item.crafted,
        statRoll: item.statRoll,
        isEmpowered: item.isEmpowered,
        prefix: item.prefix,
        suffix: item.suffix
      }));

      setItems(mappedItems);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      toast.error('Failed to load items');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEquip = async (inventoryId: string, lootTableId: string) => {
    setIsEquipping(true);
    try {
      await equipItem(inventoryId, lootTableId, slot);
      toast.success('Item equipped!');
      onClose();
    } catch (error) {
      console.error('Failed to equip item:', error);
      toast.error('Failed to equip item');
    } finally {
      setIsEquipping(false);
    }
  };

  const handleUnequip = async () => {
    setIsEquipping(true);
    try {
      await unequipItem(slot);
      toast.success('Item unequipped!');
      onClose();
    } catch (error) {
      console.error('Failed to unequip item:', error);
      toast.error('Failed to unequip item');
    } finally {
      setIsEquipping(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'text-gray-400';
      case 'rare':
        return 'text-blue-400';
      case 'epic':
        return 'text-purple-400';
      case 'legendary':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getRarityBgGradient = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'from-gray-900/80 to-gray-800/80';
      case 'rare':
        return 'from-blue-900/50 to-blue-800/50';
      case 'epic':
        return 'from-purple-900/50 to-purple-800/50';
      case 'legendary':
        return 'from-yellow-900/50 to-yellow-800/50';
      default:
        return 'from-gray-900/80 to-gray-800/80';
    }
  };

  if (!isOpen) return null;

  const currentlyEquipped = getCurrentlyEquipped();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-900/98 border-2 border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚔️</span>
              <span className="text-lg font-bold text-gray-100">Select {getSlotLabel()}</span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer text-xl"
              disabled={isEquipping}
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-amber-400 font-semibold">
            ⚠️ Only minted NFTs can be equipped. Mint items from your inventory to use them here.
          </p>
        </div>

        {/* Currently Equipped */}
        {currentlyEquipped && (
          <div className="relative px-6 py-4 bg-gray-800/50 border-b border-gray-700">
            <div className="text-sm text-gray-400 mb-2">Currently Equipped:</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{currentlyEquipped.lootItem.icon}</span>
                <div>
                  <div className={`text-base font-semibold ${getRarityColor(currentlyEquipped.lootItem.rarity)}`}>
                    {getInscribedItemName(currentlyEquipped.lootItem.name, currentlyEquipped.prefix, currentlyEquipped.suffix)}
                  </div>
                  {currentlyEquipped.lootItem.equipmentStats && (
                    <div className="text-xs text-gray-500 mt-1">
                      {Object.entries(currentlyEquipped.lootItem.equipmentStats).map(([key, value]) => (
                        <span key={key} className="mr-3">
                          {formatStatName(key)}: +{value}{getStatUnit(key)}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Stat Roll indicator (for crafted items only) */}
                  {currentlyEquipped.crafted && currentlyEquipped.statRoll !== undefined && (
                    <div className="mt-2">
                      <StatRangeIndicator statRoll={currentlyEquipped.statRoll} />
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleUnequip}
                disabled={isEquipping}
                className="px-4 py-2 bg-red-900/50 text-red-200 border border-red-700 rounded hover:bg-red-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isEquipping ? 'Unequipping...' : 'Unequip'}
              </button>
            </div>

            {/* Tier badge (top right corner) */}
            <div className="absolute top-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/40">
              {tierToRoman(currentlyEquipped.tier)}
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-3">📦</div>
              <div>No minted items available for this slot</div>
              <div className="text-sm mt-2">Mint equipment from your inventory to equip it!</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => {
                const lootItem = getLootItemById(item.lootTableId);
                if (!lootItem) return null;

                const isCurrentlyEquipped = currentlyEquipped?.inventoryId === item._id;

                // Calculate empowered stats if applicable
                let displayStats = lootItem.equipmentStats;
                if (item.isEmpowered && lootItem.equipmentStats) {
                  // Apply tier scaling first
                  const baseStats = lootItem.equipmentStats as Record<string, number>;
                  const scaledStats = scaleItemStats(baseStats, item.tier as Tier);
                  // Apply empowered bonus (20%) with round up
                  displayStats = Object.entries(scaledStats).reduce((acc, [key, value]) => {
                    acc[key] = Math.ceil(value * 1.2);
                    return acc;
                  }, {} as Record<string, number>);
                } else if (lootItem.equipmentStats) {
                  // Just apply tier scaling
                  const baseStats = lootItem.equipmentStats as Record<string, number>;
                  displayStats = scaleItemStats(baseStats, item.tier as Tier);
                }

                // Apply inscription bonuses (add after tier + empowered)
                if (displayStats && (item.prefix || item.suffix)) {
                  const statsRecord = displayStats as Record<string, number>;
                  displayStats = { ...statsRecord }; // Clone to avoid mutation

                  // Add prefix inscription bonus
                  if (item.prefix) {
                    const statKey = getInscriptionStatKey(item.prefix.type);
                    if (statKey && displayStats) {
                      const statsWithInscriptions = displayStats as Record<string, number>;
                      statsWithInscriptions[statKey] = (statsWithInscriptions[statKey] || 0) + item.prefix.value;
                    }
                  }

                  // Add suffix inscription bonus
                  if (item.suffix) {
                    const statKey = getInscriptionStatKey(item.suffix.type);
                    if (statKey && displayStats) {
                      const statsWithInscriptions = displayStats as Record<string, number>;
                      statsWithInscriptions[statKey] = (statsWithInscriptions[statKey] || 0) + item.suffix.value;
                    }
                  }
                }

                return (
                  <button
                    key={item._id}
                    onClick={() => !isCurrentlyEquipped && handleEquip(item._id, item.lootTableId)}
                    disabled={isEquipping || isCurrentlyEquipped}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all text-left overflow-hidden
                      ${isCurrentlyEquipped ? 'border-green-500 bg-green-900/30 cursor-default' : 'border-gray-700 hover:border-blue-500 hover:bg-gray-800/70 cursor-pointer'}
                      ${isEquipping ? 'opacity-50 cursor-not-allowed' : ''}
                      bg-gradient-to-br ${getRarityBgGradient(lootItem.rarity)}
                    `}
                    style={{
                      boxShadow: `0 0 15px ${colorToRGBA(item.borderGradient.color1, 0.3)}, 0 0 25px ${colorToRGBA(item.borderGradient.color2, 0.2)}`
                    }}
                  >
                    {/* Corruption overlay for empowered items */}
                    {item.isEmpowered && (
                      <CorruptionOverlay showLabel={false} size="small" />
                    )}

                    {/* Item Icon and Name */}
                    <div className="flex items-center gap-3 mb-2 relative z-20">
                      <span className="text-3xl">{lootItem.icon}</span>
                      <div className="flex-1">
                        <div className={`text-base font-semibold ${getRarityColor(lootItem.rarity)}`}>
                          {getInscribedItemName(lootItem.name, item.prefix, item.suffix)}
                        </div>
                        <div className="text-xs text-gray-500">{lootItem.description}</div>
                      </div>
                    </div>

                    {/* Equipment Stats */}
                    {displayStats && (
                      <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-700 relative z-20">
                        {Object.entries(displayStats).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span>{formatStatName(key)}:</span>
                            <span className={item.isEmpowered ? 'text-purple-400' : 'text-green-400'}>
                              +{value}{getStatUnit(key)}
                            </span>
                          </div>
                        ))}
                        {item.isEmpowered && (
                          <div className="text-[10px] text-purple-400 mt-1 italic">
                            ⚡ Empowered (+20%)
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stat Roll indicator (for crafted items only) */}
                    {item.crafted && item.statRoll !== undefined && (
                      <div className="mt-2 pt-2 border-t border-gray-700 relative z-20">
                        <StatRangeIndicator statRoll={item.statRoll} />
                      </div>
                    )}

                    {/* Currently Equipped Badge */}
                    {isCurrentlyEquipped && (
                      <div className="text-xs text-green-400 font-semibold mt-2 pt-2 border-t border-green-700 relative z-20">
                        ✓ Currently Equipped
                      </div>
                    )}

                    {/* Tier badge (top right corner) */}
                    <div className="absolute top-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/40 z-20">
                      {tierToRoman(item.tier)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatStatName(key: string): string {
  const nameMap: Record<string, string> = {
    damageBonus: 'Damage',
    critChance: 'Crit Chance',
    defense: 'Defense',
    maxHpBonus: 'Max HP',
    attackSpeed: 'Attack Speed',
    coinBonus: 'Coin Bonus'
  };
  return nameMap[key] || key;
}

function getStatUnit(key: string): string {
  const unitMap: Record<string, string> = {
    critChance: '%',
    defense: '',
    attackSpeed: '%',
    coinBonus: '%'
  };
  return unitMap[key] || '';
}
