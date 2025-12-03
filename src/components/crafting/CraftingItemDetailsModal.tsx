'use client';

import { LootItem } from '@/lib/loot-table';

interface CraftingItemDetailsModalProps {
  item: LootItem;
  onClose: () => void;
}

export default function CraftingItemDetailsModal({ item, onClose }: CraftingItemDetailsModalProps) {
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

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-4 ${getRarityBorderColor(item.rarity)} p-6 max-w-md w-full shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl cursor-pointer"
        >
          ×
        </button>

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

        {/* Description */}
        <div className="mb-6">
          <p className="text-gray-300">{item.description}</p>
        </div>

        {/* Equipment Stats */}
        {item.equipmentStats && (
          <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-bold text-white mb-3">Equipment Stats</h3>
            <div className="space-y-2">
              {item.equipmentStats.damageBonus !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Damage Bonus:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.damageBonus}</span>
                </div>
              )}
              {item.equipmentStats.critChance !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Crit Chance:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.critChance}%</span>
                </div>
              )}
              {item.equipmentStats.defense !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Defense:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.defense}</span>
                </div>
              )}
              {item.equipmentStats.maxHpBonus !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Max HP Bonus:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.maxHpBonus}</span>
                </div>
              )}
              {item.equipmentStats.attackSpeed !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Attack Speed:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.attackSpeed}</span>
                </div>
              )}
              {item.equipmentStats.coinBonus !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Coin Bonus:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.coinBonus}%</span>
                </div>
              )}
              {item.equipmentStats.healBonus !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Heal Bonus:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.healBonus}%</span>
                </div>
              )}
              {item.equipmentStats.lifesteal !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Lifesteal (Offense):</span>
                  <span className="text-red-400 font-bold">+{item.equipmentStats.lifesteal}%</span>
                </div>
              )}
              {item.equipmentStats.defensiveLifesteal !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Tank Heal (Defense):</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.defensiveLifesteal}%</span>
                </div>
              )}
              {item.equipmentStats.thorns !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Thorns (Reflect):</span>
                  <span className="text-orange-400 font-bold">+{item.equipmentStats.thorns}%</span>
                </div>
              )}
              {item.equipmentStats.autoClickRate !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Auto-Click Rate:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.autoClickRate}/sec</span>
                </div>
              )}
              {item.equipmentStats.fireResistance !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Fire Resistance:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.fireResistance}%</span>
                </div>
              )}
              {item.equipmentStats.poisonResistance !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Poison Resistance:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.poisonResistance}%</span>
                </div>
              )}
              {item.equipmentStats.bleedResistance !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Bleed Resistance:</span>
                  <span className="text-green-400 font-bold">+{item.equipmentStats.bleedResistance}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Consumable Stats */}
        {item.type === 'consumable' && (
          <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-bold text-white mb-3">Consumable Info</h3>
            <div className="space-y-2">
              {item.healing !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Healing:</span>
                  <span className="text-green-400 font-bold">+{item.healing} HP</span>
                </div>
              )}
              {item.cooldown !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Cooldown:</span>
                  <span className="text-blue-400 font-bold">{item.cooldown}s</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Spell Data */}
        {item.spellData && (
          <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-bold text-white mb-3">Spell Info</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Spell Name:</span>
                <span className="text-purple-400 font-bold">{item.spellData.spellName}</span>
              </div>
              {item.spellData.damage !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Damage:</span>
                  <span className="text-red-400 font-bold">{item.spellData.damage}</span>
                </div>
              )}
              {item.spellData.healing !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Healing:</span>
                  <span className="text-green-400 font-bold">+{item.spellData.healing} HP</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Cooldown:</span>
                <span className="text-blue-400 font-bold">{item.spellData.cooldown}s</span>
              </div>
              {item.spellData.effect && (
                <div className="mt-2">
                  <span className="text-gray-400">Effect:</span>
                  <p className="text-gray-300 mt-1">{item.spellData.effect}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}
