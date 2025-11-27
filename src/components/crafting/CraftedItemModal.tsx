'use client';

import { LootItem } from '@/lib/loot-table';
import StatRangeIndicator from './StatRangeIndicator';
import CorruptionOverlay from '@/components/battle/CorruptionOverlay';
import EmpoweredBadge from '@/components/badges/EmpoweredBadge';

interface CraftedItemModalProps {
  item: LootItem;
  statRoll: number;
  rolledStats?: {
    damageBonus?: number;
    critChance?: number;
    defense?: number;
    maxHpBonus?: number;
    attackSpeed?: number;
    coinBonus?: number;
  };
  isEmpowered?: boolean; // If crafted with all empowered materials
  onClose: () => void;
}

export default function CraftedItemModal({ item, statRoll, rolledStats, isEmpowered = false, onClose }: CraftedItemModalProps) {
  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'text-gray-400',
      rare: 'text-blue-400',
      epic: 'text-purple-400',
      legendary: 'text-amber-400'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const getRarityBorderColor = (rarity: string) => {
    const colors = {
      common: 'border-gray-500',
      rare: 'border-blue-500',
      epic: 'border-purple-500',
      legendary: 'border-amber-500'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const modalContent = (
    <div
      className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-4 ${getRarityBorderColor(item.rarity)} p-6 max-w-md w-full shadow-2xl relative`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Corruption overlay - applied directly to modal */}
      {isEmpowered && (
        <CorruptionOverlay showLabel={false} />
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl cursor-pointer z-50"
      >
        ×
      </button>

      {/* Empowered badge (if applicable) */}
      {isEmpowered && (
        <EmpoweredBadge size="large" position="top-left" />
      )}

      {/* Success Header */}
      <div className="text-center mb-4">
        <div className="text-4xl mb-2">🔨</div>
        <h2 className="text-xl font-bold text-green-400">
          {isEmpowered ? '⚡ EMPOWERED ITEM CRAFTED!' : 'Item Crafted!'}
        </h2>
        {isEmpowered && (
          <p className="text-sm text-purple-400 mt-1">Crafted with all empowered materials!</p>
        )}
      </div>

        {/* Item Header */}
        <div className="flex items-center gap-4 mb-6">
          <span className="text-6xl">{item.icon}</span>
          <div>
            <h2 className={`text-2xl font-bold ${getRarityColor(item.rarity)}`}>
              {item.name}
            </h2>
            <p className="text-sm text-gray-400 capitalize">{item.rarity} {item.type}</p>
          </div>
        </div>

        {/* Stat Roll Indicator */}
        <div className="mb-6 flex justify-center">
          <StatRangeIndicator statRoll={statRoll} />
        </div>

        {/* Description */}
        <div className="mb-6">
          <p className="text-gray-300 text-sm">{item.description}</p>
        </div>

        {/* Rolled Stats */}
        {rolledStats && (
          <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-bold text-white mb-3">Rolled Stats</h3>
            <div className="space-y-2">
              {rolledStats.damageBonus !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Damage Bonus:</span>
                  <span className="text-green-400 font-bold">+{rolledStats.damageBonus}</span>
                </div>
              )}
              {rolledStats.critChance !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Crit Chance:</span>
                  <span className="text-green-400 font-bold">+{rolledStats.critChance}%</span>
                </div>
              )}
              {rolledStats.defense !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Defense:</span>
                  <span className="text-green-400 font-bold">+{rolledStats.defense}</span>
                </div>
              )}
              {rolledStats.maxHpBonus !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Max HP Bonus:</span>
                  <span className="text-green-400 font-bold">+{rolledStats.maxHpBonus}</span>
                </div>
              )}
              {rolledStats.attackSpeed !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Attack Speed:</span>
                  <span className="text-green-400 font-bold">+{rolledStats.attackSpeed}%</span>
                </div>
              )}
              {rolledStats.coinBonus !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Coin Bonus:</span>
                  <span className="text-green-400 font-bold">+{rolledStats.coinBonus}%</span>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Close Button */}
      <button
        onClick={onClose}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
      >
        Continue Crafting
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      {modalContent}
    </div>
  );
}
