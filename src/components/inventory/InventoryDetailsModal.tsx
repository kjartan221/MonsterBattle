'use client';

import { LootItem } from '@/lib/loot-table';

interface InventoryDetailsModalProps {
  item: LootItem & { acquiredAt: Date };
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border-2 border-amber-600 max-w-md w-full p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
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

          {/* Item ID (for reference) */}
          <div className="pt-3 border-t border-gray-700">
            <span className="text-gray-500 text-xs font-mono block">ID: {item.lootId}</span>
          </div>
        </div>

        {/* Close button at bottom */}
        <button
          onClick={onClose}
          className="mt-6 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
