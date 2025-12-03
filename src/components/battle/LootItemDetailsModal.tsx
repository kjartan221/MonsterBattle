'use client';

import { LootItem } from '@/lib/loot-table';

interface LootItemDetailsModalProps {
  item: LootItem;
  onClose: () => void;
}

export default function LootItemDetailsModal({ item, onClose }: LootItemDetailsModalProps) {
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
    artifact: 'Artifact',
    spell_scroll: 'Spell Scroll',
    inscription_scroll: 'Inscription Scroll'
  };

  const rarityGradients = {
    common: 'from-gray-900 to-gray-800',
    rare: 'from-blue-900/30 to-gray-800',
    epic: 'from-purple-900/30 to-gray-800',
    legendary: 'from-amber-900/30 to-gray-800'
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div
        className={`bg-gradient-to-br ${rarityGradients[item.rarity]} rounded-lg border-2 ${rarityColors[item.rarity].split(' ')[1]} max-w-md w-full p-6 shadow-2xl relative`}
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
              </div>
            </div>
          )}

          {/* Consumable Stats */}
          {item.type === 'consumable' && (
            <div className="pb-3 border-b border-gray-700">
              <span className="text-gray-400 text-sm font-medium block mb-2">Consumable Effects</span>
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                {item.healing !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Healing:</span>
                    <span className="text-green-400 font-bold">+{item.healing} HP</span>
                  </div>
                )}
                {item.cooldown !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Cooldown:</span>
                    <span className="text-blue-400 font-bold">{item.cooldown}s</span>
                  </div>
                )}
                {item.buffData && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Buff:</span>
                    <span className="text-purple-400 font-bold">
                      {item.buffData.buffType} +{item.buffData.buffValue} ({item.buffData.duration}s)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Spell Data */}
          {item.spellData && (
            <div className="pb-3 border-b border-gray-700">
              <span className="text-gray-400 text-sm font-medium block mb-2">Spell Details</span>
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Spell Name:</span>
                  <span className="text-purple-400 font-bold">{item.spellData.spellName}</span>
                </div>
                {item.spellData.damage !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Damage:</span>
                    <span className="text-red-400 font-bold">{item.spellData.damage}</span>
                  </div>
                )}
                {item.spellData.healing !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Healing:</span>
                    <span className="text-green-400 font-bold">{item.spellData.healing} HP</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Cooldown:</span>
                  <span className="text-blue-400 font-bold">{item.spellData.cooldown}s</span>
                </div>
                {item.spellData.effect && (
                  <div className="text-sm mt-2">
                    <span className="text-gray-300">Effect: </span>
                    <span className="text-gray-100">{item.spellData.effect}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Inscription Data */}
          {item.inscriptionData && (
            <div className="pb-3 border-b border-gray-700">
              <span className="text-gray-400 text-sm font-medium block mb-2">Inscription Details</span>
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Inscription Name:</span>
                  <span className="text-purple-400 font-bold">{item.inscriptionData.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Slot:</span>
                  <span className="text-blue-400 font-bold capitalize">{item.inscriptionData.slot}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Stat:</span>
                  <span className="text-green-400 font-bold capitalize">{item.inscriptionData.inscriptionType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Value:</span>
                  <span className="text-green-400 font-bold">+{item.inscriptionData.statValue}</span>
                </div>
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
