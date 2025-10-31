'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LootItem } from '@/lib/loot-table';
import InventoryDetailsModal from './InventoryDetailsModal';
import toast from 'react-hot-toast';
import { tierToRoman, getTierBadgeClassName } from '@/utils/tierUtils';

interface InventoryItem extends LootItem {
  tier: number; // Which tier this item dropped from (1-5)
  acquiredAt: Date;
  sessionId: string;
  inventoryId: string;
  nftLootId?: string;
  mintTransactionId?: string;
  isMinted: boolean; // Whether the item has been minted as an NFT
  borderGradient?: { color1: string; color2: string }; // User-specific gradient
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

  // Stack items by name + tier
  const stackItems = (items: InventoryItem[]): StackedInventoryItem[] => {
    const stacks = new Map<string, InventoryItem[]>();

    // Group items by name + tier
    items.forEach(item => {
      const key = `${item.name}_${item.tier}`;
      if (!stacks.has(key)) {
        stacks.set(key, []);
      }
      stacks.get(key)!.push(item);
    });

    // Convert to StackedInventoryItem array
    return Array.from(stacks.values()).map(itemGroup => {
      const firstItem = itemGroup[0];
      return {
        ...firstItem,
        count: itemGroup.length,
        items: itemGroup
      } as StackedInventoryItem;
    });
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

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      toast.success('Logged out successfully');
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to logout');
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Your Treasure Chest</h1>
            <p className="text-gray-400">
              {inventory.length} {inventory.length === 1 ? 'item' : 'items'} collected
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/crafting')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              🔨 Crafting
            </button>
            <button
              onClick={() => router.push('/battle')}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              Back to Battle
            </button>
            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
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

                return (
                <div
                  key={`${item.sessionId}-${index}`}
                  className="relative p-1 rounded-xl hover:scale-105 transition-all duration-200 group"
                  style={wrapperStyle}
                >
                  <button
                    onClick={() => setSelectedItem(item)}
                    className={`relative w-full bg-gradient-to-br ${getRarityColor(item.rarity)} rounded-lg ${!item.borderGradient ? 'border-4' : ''} p-4 hover:shadow-xl transition-all duration-200 cursor-pointer`}
                  >
                    {/* Item icon */}
                    <div className="text-5xl mb-2 group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>

                    {/* Item name */}
                    <div className="text-white font-bold text-sm text-center mb-1 line-clamp-2 min-h-[2.5rem]">
                      {item.name}
                    </div>

                    {/* Rarity badge */}
                    <div className={`text-xs uppercase font-bold ${getRarityTextColor(item.rarity)} text-center`}>
                      {item.rarity}
                    </div>

                    {/* Tier badge (bottom left corner) */}
                    <div className={getTierBadgeClassName()}>
                      {tierToRoman(item.tier)}
                    </div>

                    {/* Count badge (bottom right corner) */}
                    {item.count > 1 && (
                      <div className="absolute bottom-2 right-2 bg-gray-900 border-2 border-white text-white text-sm font-bold px-2 py-1 rounded-full shadow-lg">
                        x{item.count}
                      </div>
                    )}

                    {/* Minting status badge */}
                    {!item.isMinted && (
                      <div className="absolute top-2 right-2 bg-gray-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        Not Minted
                      </div>
                    )}
                    {item.isMinted && !item.mintTransactionId && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                        Minting...
                      </div>
                    )}

                    {/* Hover effect overlay */}
                    <div className="absolute inset-0 bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </button>
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
