'use client';

import { LootItem } from '@/lib/loot-table';

interface InventoryDetailsModalProps {
  item: LootItem & {
    acquiredAt: Date;
    mintTransactionId?: string;
    nftLootId?: string;
    borderGradient?: { color1: string; color2: string }; // User-specific gradient
  };
  onClose: () => void;
}

export default function InventoryDetailsModal({ item, onClose }: InventoryDetailsModalProps) {
  const rarityColors = {
    common: 'text-gray-400 border-gray-400',
    rare: 'text-blue-400 border-blue-400',
    epic: 'text-purple-400 border-purple-400',
    legendary: 'text-amber-400 border-amber-400'
  };

  const typeLabels = {
    weapon: 'Weapon',
    armor: 'Armor',
    consumable: 'Consumable',
    material: 'Material',
    artifact: 'Artifact'
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
            {item.name}
          </h2>
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

          {/* Description */}
          <div className="pb-3 border-b border-gray-700">
            <span className="text-gray-400 text-sm font-medium block mb-2">Description</span>
            <p className="text-white text-sm leading-relaxed">{item.description}</p>
          </div>

          {/* NFT Status */}
          <div className="pb-3 border-b border-gray-700">
            <span className="text-gray-400 text-sm font-medium block mb-2">NFT Status</span>
            {item.mintTransactionId ? (
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
    </div>
  );
}
