'use client';

import { useEffect, useState } from 'react';
import { getLootItemById } from '@/lib/loot-table';
import toast from 'react-hot-toast';

interface SellItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface SellableItem {
  id: string; // inventoryId or materialTokenId
  lootTableId: string;
  name: string;
  icon: string;
  type: string;
  rarity: string;
  tier: number;
  isMinted: boolean;
  tokenId?: string;
  quantity?: number;
  isMaterialToken: boolean;
  equipmentStats?: Record<string, number>;
  prefix?: any;
  suffix?: any;
}

export default function SellItemModal({ onClose, onSuccess }: SellItemModalProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SellableItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SellableItem | null>(null);
  const [price, setPrice] = useState('');
  const [listing, setListing] = useState(false);

  useEffect(() => {
    loadSellableItems();
  }, []);

  const loadSellableItems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/inventory/get');
      const data = await response.json();

      if (response.ok && data.success) {
        // Filter for ONLY minted NFTs and material tokens
        const sellable = data.inventory
          .filter((item: any) => {
            // Material tokens are always sellable (they're on blockchain)
            if (item.isMaterialToken) return true;

            // Regular items must be minted NFTs
            return item.isMinted && item.tokenId;
          })
          .map((item: any) => ({
            id: item.isMaterialToken ? item.materialTokenId : item.inventoryId,
            lootTableId: item.lootId,
            name: item.name,
            icon: item.icon,
            type: item.type,
            rarity: item.rarity,
            tier: item.tier || 1,
            isMinted: item.isMinted,
            tokenId: item.tokenId,
            quantity: item.quantity,
            isMaterialToken: item.isMaterialToken || false,
            equipmentStats: item.equipmentStats,
            prefix: item.prefix,
            suffix: item.suffix,
          }));

        setItems(sellable);
      } else {
        toast.error('Failed to load items');
      }
    } catch (error) {
      console.error('Error loading sellable items:', error);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleListItem = async () => {
    if (!selectedItem || !price) {
      toast.error('Please select an item and enter a price');
      return;
    }

    const priceNum = parseInt(price, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    setListing(true);
    const loadingToast = toast.loading('Listing item...');

    try {
      const response = await fetch('/api/marketplace/list-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: selectedItem.isMaterialToken ? undefined : selectedItem.id,
          materialTokenId: selectedItem.isMaterialToken ? selectedItem.id : undefined,
          price: priceNum,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to list item');
      }

      toast.success(data.message, { id: loadingToast });
      onSuccess();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list item';
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setListing(false);
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-4xl w-full border-4 border-green-600">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">📦</div>
            <p className="text-gray-400 text-lg">Loading your items...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-4xl w-full border-4 border-green-600 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              🏪 List Item for Sale
            </h2>
            <p className="text-gray-400 text-sm">Select a minted NFT or material token to sell</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-4xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Empty State */}
        {items.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-xl font-bold text-white mb-2">No Sellable Items</h3>
            <p className="text-gray-400">
              You need to mint items as NFTs or material tokens before you can sell them on the marketplace.
            </p>
          </div>
        )}

        {/* Item Selection Grid */}
        {items.length > 0 && !selectedItem && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`
                  relative cursor-pointer transition-all
                  bg-gradient-to-br ${getRarityColor(item.rarity)}
                  rounded-xl border-4 p-4 hover:scale-105
                `}
              >
                {/* Icon */}
                <div className="text-4xl text-center mb-2">{item.icon}</div>

                {/* Name */}
                <p className="text-white text-sm font-semibold text-center truncate">
                  {item.name}
                </p>

                {/* Tier Badge */}
                <div className="text-xs text-center text-gray-300 mt-1">
                  Tier {item.tier}
                </div>

                {/* Quantity (for materials) */}
                {item.quantity && item.quantity > 1 && (
                  <div className="absolute top-1 right-1 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
                    x{item.quantity}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Price Input */}
        {selectedItem && (
          <div className="space-y-6">
            {/* Selected Item Preview */}
            <div className="bg-gray-900/50 rounded-lg border-2 border-gray-600 p-4">
              <h3 className="text-lg font-bold text-white mb-3">Selected Item:</h3>
              <div className="flex items-center gap-4">
                <div className="text-5xl">{selectedItem.icon}</div>
                <div className="flex-1">
                  <p className="text-xl font-bold text-white">{selectedItem.name}</p>
                  <p className="text-sm text-gray-400 capitalize">{selectedItem.rarity} • Tier {selectedItem.tier}</p>
                  {selectedItem.quantity && selectedItem.quantity > 1 && (
                    <p className="text-sm text-green-400">Quantity: {selectedItem.quantity}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded cursor-pointer"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Price Input */}
            <div>
              <label className="block text-white text-lg font-semibold mb-2">
                Price (in satoshis)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g., 1000"
                min="1"
                className="w-full px-4 py-3 rounded-lg bg-gray-900 border-2 border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-all"
              />
              <p className="text-sm text-gray-400 mt-2">
                1 BSV = 100,000,000 satoshis
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleListItem}
                disabled={listing || !price}
                className={`
                  flex-1 px-6 py-4 rounded-lg font-bold text-lg transition-all
                  ${!listing && price
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg cursor-pointer'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {listing ? 'Listing...' : '🏪 List for Sale'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
