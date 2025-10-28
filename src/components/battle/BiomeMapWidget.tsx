'use client';

import { BIOMES, BiomeId, Tier, formatBiomeTierKey, getBiomeTierDisplayName } from '@/lib/biome-config';
import { useBiome } from '@/contexts/BiomeContext';
import { useState } from 'react';

interface BiomeMapWidgetProps {
  unlockedZones: string[]; // Array of "biome-tier" keys like ["forest-1", "desert-1"]
  onSelectBiomeTier: (biome: BiomeId, tier: Tier) => void;
  disabled?: boolean; // Disable during active battle
}

export default function BiomeMapWidget({
  unlockedZones,
  onSelectBiomeTier,
  disabled = false
}: BiomeMapWidgetProps) {
  const { selectedBiome, selectedTier } = useBiome();
  const [isExpanded, setIsExpanded] = useState(false);

  const isBiomeTierUnlocked = (biome: BiomeId, tier: Tier): boolean => {
    const key = formatBiomeTierKey(biome, tier);
    return unlockedZones.includes(key);
  };

  const isCurrent = (biome: BiomeId, tier: Tier): boolean => {
    return biome === selectedBiome && tier === selectedTier;
  };

  const getBiomeTierStatus = (biome: BiomeId, tier: Tier): 'unlocked' | 'current' | 'locked' | 'unavailable' => {
    const biomeConfig = BIOMES[biome];

    // Check if this tier is even implemented for this biome
    // maxTier can be 0 (not implemented) or 1-5 (implemented tiers)
    if (biomeConfig.maxTier === 0 || tier > biomeConfig.maxTier) {
      return 'unavailable';
    }

    if (isCurrent(biome, tier)) {
      return 'current';
    }

    if (isBiomeTierUnlocked(biome, tier)) {
      return 'unlocked';
    }

    return 'locked';
  };

  const handleBiomeTierClick = (biome: BiomeId, tier: Tier) => {
    if (disabled) return;

    const status = getBiomeTierStatus(biome, tier);
    if (status === 'unlocked' || status === 'current') {
      onSelectBiomeTier(biome, tier);
      setIsExpanded(false); // Collapse after selection
    }
  };

  return (
    <div className="fixed top-60 sm:top-64 left-2 sm:left-4 z-50 w-[calc(100vw-1rem)] sm:w-auto max-w-[320px]">
      {/* Collapsed View - Show current biome */}
      {!isExpanded && selectedBiome && selectedTier && (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-gray-900/95 border-2 border-gray-700 rounded-lg px-5 py-4 shadow-xl hover:border-blue-500 transition-colors cursor-pointer w-full sm:w-[320px]"
        >
          <div className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{BIOMES[selectedBiome].icon}</span>
              <div className="text-left">
                <div className="text-base font-semibold text-gray-200">
                  {BIOMES[selectedBiome].name}
                </div>
                <div className="text-sm text-gray-400">
                  Tier {selectedTier}
                </div>
              </div>
            </div>
            <span className="text-gray-500 text-lg">▼</span>
          </div>
        </button>
      )}

      {/* Expanded View - Show all biomes and tiers */}
      {isExpanded && (
        <div className="bg-gray-900/98 border-2 border-gray-700 rounded-lg shadow-2xl overflow-hidden w-full sm:w-[320px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 px-5 py-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🗺️</span>
              <span className="text-base font-bold text-gray-100">World Map</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer text-xl"
            >
              ✕
            </button>
          </div>

          {/* Biome List */}
          <div className="max-h-[calc(100vh-16rem)] sm:max-h-[500px] overflow-y-auto p-4 space-y-4">
            {Object.values(BIOMES).map((biome) => {
              // Skip biomes that aren't implemented yet (maxTier = 0)
              if (biome.maxTier === 0) return null;

              return (
                <div key={biome.id} className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                  {/* Biome Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{biome.icon}</span>
                    <div>
                      <div className="text-base font-semibold text-gray-200">
                        {biome.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {biome.description}
                      </div>
                    </div>
                  </div>

                  {/* Tier Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5].map((tier) => {
                      const status = getBiomeTierStatus(biome.id, tier as Tier);
                      const isDisabled = status === 'locked' || status === 'unavailable' || disabled;

                      return (
                        <button
                          key={tier}
                          onClick={() => handleBiomeTierClick(biome.id, tier as Tier)}
                          disabled={isDisabled}
                          className={`
                            px-4 py-2 text-sm font-medium rounded transition-all
                            ${status === 'current' ? 'bg-blue-600 text-white border-2 border-blue-400 shadow-lg shadow-blue-500/50' : ''}
                            ${status === 'unlocked' ? 'bg-green-900/50 text-green-200 border border-green-700 hover:bg-green-800/70 hover:border-green-500 hover:cursor-pointer' : ''}
                            ${status === 'locked' ? 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed' : ''}
                            ${status === 'unavailable' ? 'bg-gray-900 text-gray-700 border border-gray-800 cursor-not-allowed' : ''}
                          `}
                          title={
                            status === 'current' ? 'Currently playing' :
                            status === 'unlocked' ? `Click to play ${getBiomeTierDisplayName(biome.id, tier as Tier)}` :
                            status === 'locked' ? 'Complete previous tier to unlock' :
                            'Not yet implemented'
                          }
                        >
                          {status === 'current' && '→ '}
                          T{tier}
                          {status === 'locked' && ' 🔒'}
                          {status === 'unavailable' && ' ⚠️'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Instructions */}
          <div className="bg-gray-800/50 px-5 py-3 border-t border-gray-700 text-sm text-gray-400">
            {disabled ? (
              <span className="text-yellow-400">⚠️ Complete current battle to change zones</span>
            ) : (
              <span>Click a tier to start a battle in that zone</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
