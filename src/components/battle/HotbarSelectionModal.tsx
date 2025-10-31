'use client';

import { useState, useEffect } from 'react';
import { getLootItemById, LootItem } from '@/lib/loot-table';
import toast from 'react-hot-toast';
import { colorToRGBA } from '@/utils/publicKeyToColor';
import { tierToRoman, getTierBadgeClassName } from '@/utils/tierUtils';

interface UserInventoryItem {
  _id: string;
  lootTableId: string;
  tier: number;
  borderGradient: { color1: string; color2: string };
  acquiredAt: string;
}

type HotbarSlotType = 'spell' | 'consumable';

interface HotbarSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotType: HotbarSlotType;
  slotIndex: number; // 0 for spell (Q), 0-2 for consumables (1-3)
  consumableSlots?: any[]; // Pass from parent to avoid separate hook instance
  equipConsumable?: (slotIndex: number, inventoryId: string) => Promise<boolean>;
  unequipConsumable?: (slotIndex: number) => Promise<boolean>;
}

export default function HotbarSelectionModal({ isOpen, onClose, slotType, slotIndex, consumableSlots = [], equipConsumable, unequipConsumable }: HotbarSelectionModalProps) {
  const [items, setItems] = useState<UserInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEquipping, setIsEquipping] = useState(false);

  const getSlotLabel = () => {
    if (slotType === 'spell') {
      return 'Spell (Q)';
    }
    return `Consumable ${slotIndex + 1} (${slotIndex + 1})`;
  };

  const getSlotIcon = (): string => {
    if (slotType === 'spell') {
      return '📜';
    }
    return '🧪';
  };

  const getCurrentlyEquipped = () => {
    if (slotType === 'spell') {
      return null; // TODO: Implement spell slots in usePlayerSpell hook
    }
    const slot = consumableSlots[slotIndex];
    if (!slot.itemId || !slot.inventoryId) return null;

    const lootItem = getLootItemById(slot.itemId);
    return lootItem ? { inventoryId: slot.inventoryId, lootItem } : null;
  };

  useEffect(() => {
    if (isOpen) {
      fetchInventoryItems();
    }
  }, [isOpen, slotType]);

  const fetchInventoryItems = async () => {
    setIsLoading(true);
    try {
      // Determine which API endpoint to use based on slot type
      const endpoint = slotType === 'spell'
        ? '/api/inventory/get'
        : '/api/consumables/get';

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch inventory');
      }

      const data = await response.json();

      // Filter items by type
      const filteredItems = slotType === 'spell'
        ? (data.inventory || []).filter((item: any) => {
            const lootItem = getLootItemById(item.lootId);
            return lootItem && lootItem.type === 'spell_scroll';
          }).map((item: any) => ({
            _id: item.inventoryId,
            lootTableId: item.lootId,
            tier: item.tier,
            borderGradient: item.borderGradient,
            acquiredAt: item.acquiredAt
          }))
        : (data.consumables || []).map((item: any) => ({
            _id: item._id,
            lootTableId: item.lootTableId,
            tier: 1, // Consumables don't have tiers in current system
            borderGradient: { color1: '#4b5563', color2: '#6b7280' }, // Default gray
            acquiredAt: new Date().toISOString()
          }));

      setItems(filteredItems);
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
      if (slotType === 'spell') {
        // TODO: Implement spell equipping with usePlayerSpell hook
        toast.error('Spell equipping not yet implemented');
      } else {
        if (!equipConsumable) {
          toast.error('Equip function not available');
          return;
        }
        await equipConsumable(slotIndex, inventoryId);
      }
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
      if (slotType === 'spell') {
        // TODO: Implement spell unequipping with usePlayerSpell hook
        toast.error('Spell unequipping not yet implemented');
      } else {
        if (!unequipConsumable) {
          toast.error('Unequip function not available');
          return;
        }
        await unequipConsumable(slotIndex);
      }
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

  // Group consumables by lootTableId and count them
  const groupedItems = items.reduce((acc, item) => {
    const existing = acc.find(i => i.lootTableId === item.lootTableId);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ ...item, count: 1 });
    }
    return acc;
  }, [] as (UserInventoryItem & { count: number })[]);

  if (!isOpen) return null;

  const currentlyEquipped = getCurrentlyEquipped();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-900/98 border-2 border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getSlotIcon()}</span>
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

        {/* Currently Equipped */}
        {currentlyEquipped && (
          <div className="relative px-6 py-4 bg-gray-800/50 border-b border-gray-700">
            <div className="text-sm text-gray-400 mb-2">Currently Equipped:</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{currentlyEquipped.lootItem.icon}</span>
                <div>
                  <div className={`text-base font-semibold ${getRarityColor(currentlyEquipped.lootItem.rarity)}`}>
                    {currentlyEquipped.lootItem.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {currentlyEquipped.lootItem.description}
                  </div>
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
          </div>
        )}

        {/* Keybind Usage Hint */}
        <div className="px-6 py-3 bg-blue-900/20 border-b border-gray-700 text-center">
          <div className="text-sm text-blue-300">
            💡 <strong>Tip:</strong> Use keybind <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono">
              {slotType === 'spell' ? 'Q' : (slotIndex + 1).toString()}
            </kbd> during battle to activate this item
          </div>
        </div>

        {/* Items List */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">Loading items...</div>
          ) : groupedItems.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-3">{getSlotIcon()}</div>
              <div>No {slotType === 'spell' ? 'spell scrolls' : 'consumables'} available</div>
              <div className="text-sm mt-2">Defeat monsters to collect items!</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {groupedItems.map((item) => {
                const lootItem = getLootItemById(item.lootTableId);
                if (!lootItem) return null;

                const isCurrentlyEquipped = currentlyEquipped?.inventoryId === item._id;

                return (
                  <button
                    key={item._id}
                    onClick={() => !isCurrentlyEquipped && handleEquip(item._id, item.lootTableId)}
                    disabled={isEquipping || isCurrentlyEquipped}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all text-left
                      ${isCurrentlyEquipped ? 'border-green-500 bg-green-900/30 cursor-default' : 'border-gray-700 hover:border-purple-500 hover:bg-gray-800/70 cursor-pointer'}
                      ${isEquipping ? 'opacity-50 cursor-not-allowed' : ''}
                      bg-gradient-to-br ${getRarityBgGradient(lootItem.rarity)}
                    `}
                    style={{
                      boxShadow: `0 0 15px ${colorToRGBA(item.borderGradient.color1, 0.3)}, 0 0 25px ${colorToRGBA(item.borderGradient.color2, 0.2)}`
                    }}
                  >
                    {/* Item Icon and Name */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{lootItem.icon}</span>
                      <div className="flex-1">
                        <div className={`text-base font-semibold ${getRarityColor(lootItem.rarity)}`}>
                          {lootItem.name}
                        </div>
                        <div className="text-xs text-gray-500">{lootItem.description}</div>
                      </div>
                    </div>

                    {/* Quantity Badge (for consumables) */}
                    {slotType === 'consumable' && item.count > 1 && (
                      <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-700">
                        Quantity: <span className="text-blue-400 font-semibold">{item.count}</span>
                      </div>
                    )}

                    {/* Currently Equipped Badge */}
                    {isCurrentlyEquipped && (
                      <div className="text-xs text-green-400 font-semibold mt-2 pt-2 border-t border-green-700">
                        ✓ Currently Equipped
                      </div>
                    )}

                    {/* Tier badge (bottom left corner) - only for spells */}
                    {slotType === 'spell' && (
                      <div className={getTierBadgeClassName()}>
                        {tierToRoman(item.tier)}
                      </div>
                    )}
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
