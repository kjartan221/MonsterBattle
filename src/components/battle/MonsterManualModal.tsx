'use client';

import { useState } from 'react';
import { MONSTER_TEMPLATES, getMonstersForBiome } from '@/lib/monster-table';
import { getMonsterSpecificDrops, LootItem } from '@/lib/loot-table';
import { BIOMES, BiomeId } from '@/lib/biome-config';

interface MonsterManualModalProps {
  onClose: () => void;
  onItemClick: (item: LootItem) => void;
}

export default function MonsterManualModal({ onClose, onItemClick }: MonsterManualModalProps) {
  // Group monsters by biome (only biome-specific monsters, not cross-biome)
  const biomeMonsters = Object.values(BIOMES).map(biome => {
    if (biome.maxTier === 0) return null; // Skip unimplemented biomes

    const monsters = getMonstersForBiome(biome.id)
      .filter(m => m.biomes.length === 1) // Only monsters exclusive to this biome
      .map(monsterTemplate => {
        const drops = getMonsterSpecificDrops(monsterTemplate.name);
        return {
          ...monsterTemplate,
          drops
        };
      });

    return {
      biome,
      monsters
    };
  }).filter(Boolean);

  // Get cross-biome common monsters (appear in multiple biomes)
  const commonMonsters = MONSTER_TEMPLATES
    .filter(m => m.biomes.length > 1) // Monsters that appear in multiple biomes
    .map(monsterTemplate => {
      const drops = getMonsterSpecificDrops(monsterTemplate.name);
      return {
        ...monsterTemplate,
        drops
      };
    });

  const rarityColors = {
    common: 'text-gray-400 hover:text-gray-300',
    rare: 'text-blue-400 hover:text-blue-300',
    epic: 'text-purple-400 hover:text-purple-300',
    legendary: 'text-amber-400 hover:text-amber-300'
  };

  const rarityLabels = {
    common: 'Common',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary'
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border-2 border-amber-600 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📖</span>
            <h2 className="text-2xl font-bold text-gray-100">Monster Manual</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer text-xl"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
          {/* Biome-Specific Monsters */}
          {biomeMonsters.map((biomeData) => {
            if (!biomeData) return null;
            const { biome, monsters } = biomeData;

            return (
              <div key={biome.id} className="mb-8">
                {/* Biome Header */}
                <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-gray-700">
                  <span className="text-4xl">{biome.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-100">{biome.name}</h3>
                    <p className="text-sm text-gray-400">{biome.description}</p>
                  </div>
                </div>

                {/* Monsters List */}
                <div className="space-y-4">
                  {monsters.map((monster) => (
                    <div key={monster.name} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      {/* Monster Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">{monster.imageUrl}</span>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-gray-100">{monster.name}</h4>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold uppercase ${
                              monster.rarity === 'common' ? 'text-gray-400' :
                              monster.rarity === 'rare' ? 'text-blue-400' :
                              monster.rarity === 'epic' ? 'text-purple-400' :
                              'text-amber-400'
                            }`}>
                              {rarityLabels[monster.rarity]}
                            </span>
                            {monster.isBoss && (
                              <span className="text-xs font-bold uppercase text-red-400">Boss</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Monster Drops */}
                      {monster.drops.length > 0 ? (
                        <div>
                          <div className="text-xs font-semibold text-gray-400 mb-2">
                            Specific Drops:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {monster.drops.map((drop) => (
                              <button
                                key={drop.lootId}
                                onClick={() => onItemClick(drop)}
                                className={`text-sm ${rarityColors[drop.rarity]} cursor-pointer hover:underline transition-colors`}
                                title={`${drop.name} - Click for details`}
                              >
                                {drop.icon} {drop.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 italic">
                          No specific drops (uses common loot pool)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Common Monsters Section (Cross-Biome) */}
          {commonMonsters.length > 0 && (
            <div className="mb-8">
              {/* Common Monsters Header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-gray-700">
                <span className="text-4xl">🌍</span>
                <div>
                  <h3 className="text-xl font-bold text-gray-100">Common Monsters</h3>
                  <p className="text-sm text-gray-400">Found in multiple biomes</p>
                </div>
              </div>

              {/* Common Monsters List */}
              <div className="space-y-4">
                {commonMonsters.map((monster) => (
                  <div key={monster.name} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    {/* Monster Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{monster.imageUrl}</span>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-100">{monster.name}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase ${
                            monster.rarity === 'common' ? 'text-gray-400' :
                            monster.rarity === 'rare' ? 'text-blue-400' :
                            monster.rarity === 'epic' ? 'text-purple-400' :
                            'text-amber-400'
                          }`}>
                            {rarityLabels[monster.rarity]}
                          </span>
                          {monster.isBoss && (
                            <span className="text-xs font-bold uppercase text-red-400">Boss</span>
                          )}
                          {/* Show which biomes this monster appears in */}
                          <span className="text-xs text-gray-500">
                            (appears in {monster.biomes.length} biomes)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Monster Drops */}
                    {monster.drops.length > 0 ? (
                      <div>
                        <div className="text-xs font-semibold text-gray-400 mb-2">
                          Specific Drops:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {monster.drops.map((drop) => (
                            <button
                              key={drop.lootId}
                              onClick={() => onItemClick(drop)}
                              className={`text-sm ${rarityColors[drop.rarity]} cursor-pointer hover:underline transition-colors`}
                              title={`${drop.name} - Click for details`}
                            >
                              {drop.icon} {drop.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 italic">
                        No specific drops (uses common loot pool)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-800/50 px-6 py-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-6 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
