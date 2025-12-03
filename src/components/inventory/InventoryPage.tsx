'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LootItem } from '@/lib/loot-table';
import InventoryDetailsModal from './InventoryDetailsModal';
import NavigationButtons from '@/components/navigation/NavigationButtons';
import toast from 'react-hot-toast';
import { tierToRoman, getTierBadgeClassName } from '@/utils/tierUtils';
import StatRangeIndicator from '@/components/crafting/StatRangeIndicator';
import CorruptionOverlay from '@/components/battle/CorruptionOverlay';
import EmpoweredBadge from '@/components/badges/EmpoweredBadge';
import { getInscribedItemName } from '@/utils/itemNameHelpers';
import type { Inscription } from '@/lib/types';

interface InventoryItem extends LootItem {
  tier: number; // Which tier this item dropped from (1-5)
  enhanced?: boolean; // Phase 3.5: Enhanced consumable (infinite uses)
  acquiredAt: Date;
  sessionId: string;
  inventoryId: string;
  nftLootId?: string;
  mintTransactionId?: string;
  isMinted: boolean; // Whether the item has been minted as an NFT
  borderGradient?: { color1: string; color2: string }; // User-specific gradient
  crafted?: boolean; // Whether the item was crafted
  statRoll?: number; // Stat roll multiplier (0.8 to 1.2) for crafted items
  isEmpowered?: boolean; // Whether the item was dropped by a corrupted monster (+20% stats)
  prefix?: Inscription; // Phase 3.4: Prefix inscription
  suffix?: Inscription; // Phase 3.4: Suffix inscription
}

interface StackedInventoryItem extends InventoryItem {
  count: number; // Number of items in this stack
  items: InventoryItem[]; // All individual items in the stack
}

export default function InventoryPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<StackedInventoryItem | null>(null);

  // Stack items by name + tier + empowered status (exclude crafted items from stacking)
  // For consumables, ignore tier/empowered since they don't have equipment stats
  const stackItems = (items: InventoryItem[]): StackedInventoryItem[] => {
    const stacks = new Map<string, InventoryItem[]>();
    const craftedItems: InventoryItem[] = [];

    // Separate crafted items and group non-crafted items
    items.forEach(item => {
      // Crafted items are not stacked (each has unique stat roll)
      if (item.crafted) {
        craftedItems.push(item);
      } else {
        // For consumables: stack by lootId only (ignore tier/empowered)
        // For equipment: stack by name + tier + empowered
        let key: string;
        if (item.type === 'consumable') {
          // Consumables don't benefit from tier/empowered, so stack all together
          key = `${item.lootId}`;
        } else {
          // Equipment benefits from tier/empowered, keep separate stacks
          key = `${item.name}_${item.tier}_${item.isEmpowered || false}`;
        }

        if (!stacks.has(key)) {
          stacks.set(key, []);
        }
        stacks.get(key)!.push(item);
      }
    });

    // Convert stacked items to StackedInventoryItem array
    const stackedItems = Array.from(stacks.values()).map(itemGroup => {
      const firstItem = itemGroup[0];
      return {
        ...firstItem,
        count: itemGroup.length,
        items: itemGroup
      } as StackedInventoryItem;
    });

    // Add crafted items as individual entries (count: 1)
    const craftedStackedItems = craftedItems.map(item => ({
      ...item,
      count: 1,
      items: [item]
    } as StackedInventoryItem));

    // Combine and return all items
    return [...stackedItems, ...craftedStackedItems];
  };

  const stackedInventory = stackItems(inventory);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await fetch('/api/inventory/get');
      const data = await response.json();

      if (response.ok && data.success) {
        setInventory(data.inventory);
      } else {
        toast.error(data.error || 'Failed to load inventory');
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };


  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'from-gray-600 to-gray-700 border-gray-500',
      rare: 'from-blue-600 to-blue-700 border-blue-500',
      epic: 'from-purple-600 to-purple-700 border-purple-500',
      legendary: 'from-amber-600 to-amber-700 border-amber-500'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const getRarityTextColor = (rarity: string) => {
    const colors = {
      common: 'text-gray-400',
      rare: 'text-blue-400',
      epic: 'text-purple-400',
      legendary: 'text-amber-400'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📦</div>
          <p className="text-gray-400 text-lg">Loading your treasure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        {/* Title Section */}
        <div className="mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">📦 Your Treasure Chest</h1>
          <p className="text-gray-400">
            {inventory.length} {inventory.length === 1 ? 'item' : 'items'} collected
          </p>
        </div>

        {/* Navigation Bar */}
        <NavigationButtons
          showMarketplace
          showBlacksmith
          showCrafting
          showBattle
          showLogout
        />
      </div>

      {/* Chest container */}
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-gradient-to-br from-amber-900 to-amber-950 rounded-2xl border-4 border-amber-600 p-8 shadow-2xl">
          {/* Chest decorative elements */}
          <div className="absolute -top-6 left-8 text-3xl">✨</div>
          <div className="absolute -top-6 right-8 text-3xl">✨</div>

          {/* Empty state */}
          {inventory.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-8xl mb-6">📭</div>
              <h2 className="text-2xl font-bold text-amber-300 mb-3">Your chest is empty!</h2>
              <p className="text-amber-200 mb-6">
                Defeat monsters and collect loot to fill your treasure chest
              </p>
              <button
                onClick={() => router.push('/battle')}
                className="px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors text-lg cursor-pointer"
              >
                Start Battling
              </button>
            </div>
          ) : (
            /* Items grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-8">
              {stackedInventory.map((item, index) => {
                // Use custom gradient border if available
                const wrapperStyle = item.borderGradient ? {
                  background: `linear-gradient(135deg, ${item.borderGradient.color1}, ${item.borderGradient.color2})`,
                  boxShadow: `0 0 20px ${item.borderGradient.color1}40, 0 0 20px ${item.borderGradient.color2}40`
                } : {};

                // Phase 3.5: Add enhanced glow effect for consumables
                const isEnhancedConsumable = item.enhanced && item.type === 'consumable';
                const enhancedStyle = isEnhancedConsumable ? {
                  animation: 'enhanced-pulse 2s ease-in-out infinite',
                  boxShadow: '0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3)'
                } : {};

                return (
                <div
                  key={`${item.sessionId}-${index}`}
                  className="relative p-1 rounded-xl hover:scale-105 transition-all duration-200 group"
                  style={{ ...wrapperStyle, ...enhancedStyle }}
                >
                  <button
                    onClick={() => setSelectedItem(item)}
                    className={`relative w-full bg-gradient-to-br ${getRarityColor(item.rarity)} rounded-lg ${!item.borderGradient ? 'border-4' : ''} p-4 hover:shadow-xl transition-all duration-200 cursor-pointer`}
                  >
                    {/* Corruption overlay - applied directly to button */}
                    {item.isEmpowered && (
                      <CorruptionOverlay showLabel={false} />
                    )}

                    {/* Item icon */}
                    <div className="text-5xl mb-2 group-hover:scale-110 transition-transform relative z-10">
                      {item.icon}
                    </div>

                    {/* Item name */}
                    <div className="text-white font-bold text-sm text-center mb-1 line-clamp-2 min-h-[2.5rem] relative z-10">
                      {getInscribedItemName(item.name, item.prefix, item.suffix)}
                    </div>

                    {/* Rarity badge */}
                    <div className={`text-xs uppercase font-bold ${getRarityTextColor(item.rarity)} text-center relative z-10`}>
                      {item.rarity}
                    </div>

                    {/* Stat Roll indicator (for crafted items only) - fixed height container */}
                    <div className="mt-2 flex justify-center h-8">
                      {item.crafted && item.statRoll !== undefined && (
                        <StatRangeIndicator statRoll={item.statRoll} />
                      )}
                    </div>

                    {/* Empowered badge */}
                    {item.isEmpowered && (
                      <EmpoweredBadge size="small" position="top-left" />
                    )}

                    {/* Phase 3.5: Enhanced consumable badge */}
                    {isEnhancedConsumable && (
                      <div className="absolute top-2 left-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full z-50 shadow-lg border border-cyan-300 animate-pulse">
                        ✨ ∞
                      </div>
                    )}

                    {/* Minting status badge */}
                    {!item.isMinted && (
                      <div className="absolute top-2 right-2 bg-gray-500 text-white text-xs font-bold px-2 py-1 rounded-full z-50">
                        Not Minted
                      </div>
                    )}
                    {item.isMinted && !item.mintTransactionId && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full animate-pulse z-50">
                        Minting...
                      </div>
                    )}

                    {/* Hover effect overlay */}
                    <div className="absolute inset-0 bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </button>

                  {/* Tier badge (bottom left corner) - positioned relative to wrapper */}
                  <div className="absolute bottom-2 left-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/40 pointer-events-none z-50">
                    {tierToRoman(item.tier)}
                  </div>

                  {/* Count badge (bottom right corner) - positioned relative to wrapper */}
                  {item.count > 1 && (
                    <div className="absolute bottom-2 right-2 bg-gray-900 border-2 border-white text-white text-sm font-bold px-2 py-1 rounded-full shadow-lg pointer-events-none z-50">
                      x{item.count}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats section */}
        {inventory.length > 0 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 border-2 border-gray-700">
              <div className="text-gray-400 text-sm mb-1">Common</div>
              <div className="text-2xl font-bold text-gray-400">
                {inventory.filter(i => i.rarity === 'common').length}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border-2 border-blue-700">
              <div className="text-blue-400 text-sm mb-1">Rare</div>
              <div className="text-2xl font-bold text-blue-400">
                {inventory.filter(i => i.rarity === 'rare').length}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border-2 border-purple-700">
              <div className="text-purple-400 text-sm mb-1">Epic</div>
              <div className="text-2xl font-bold text-purple-400">
                {inventory.filter(i => i.rarity === 'epic').length}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border-2 border-amber-700">
              <div className="text-amber-400 text-sm mb-1">Legendary</div>
              <div className="text-2xl font-bold text-amber-400">
                {inventory.filter(i => i.rarity === 'legendary').length}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details modal */}
      {selectedItem && (
        <InventoryDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onMintSuccess={fetchInventory}
        />
      )}
    </div>
  );
}
