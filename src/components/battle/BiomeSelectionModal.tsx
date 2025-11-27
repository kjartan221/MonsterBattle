'use client';

import { BIOMES, BiomeId, Tier, formatBiomeTierKey } from '@/lib/biome-config';
import { useBiome } from '@/contexts/BiomeContext';
import { usePlayer } from '@/contexts/PlayerContext';
import toast from 'react-hot-toast';

interface BiomeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BiomeSelectionModal({ isOpen, onClose }: BiomeSelectionModalProps) {
  const { selectedBiome, selectedTier, setBiomeTier } = useBiome();
  const { playerStats } = usePlayer();

  if (!isOpen) return null;

  const unlockedZones = playerStats?.unlockedZones || [];

  const isBiomeTierUnlocked = (biome: BiomeId, tier: Tier): boolean => {
    const key = formatBiomeTierKey(biome, tier);
    return unlockedZones.includes(key);
  };

  const isCurrent = (biome: BiomeId, tier: Tier): boolean => {
    return biome === selectedBiome && tier === selectedTier;
  };

  const getBiomeTierStatus = (biome: BiomeId, tier: Tier): 'unlocked' | 'current' | 'locked' | 'unavailable' => {
    const biomeConfig = BIOMES[biome];

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
    const status = getBiomeTierStatus(biome, tier);
    if (status === 'unlocked' || status === 'current') {
      setBiomeTier(biome, tier);
      toast.success(`Selected ${BIOMES[biome].name} Tier ${tier}`, { icon: '🗺️', duration: 2000 });
      onClose();
    }
  };

  const biomeList: BiomeId[] = ['forest', 'desert', 'ocean', 'volcano', 'castle'];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-4 border-green-500 p-6 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-green-400 flex items-center gap-3">
            <span className="text-4xl">🗺️</span>
            Change Zone
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Description */}
        <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
          <p className="text-gray-300 text-sm">
            Select a different zone to battle easier or harder monsters. Your next battle will start in the selected zone.
          </p>
        </div>

        {/* Biome Grid */}
        <div className="space-y-4">
          {biomeList.map((biome) => {
            const biomeConfig = BIOMES[biome];
            const tiers: Tier[] = [1, 2, 3, 4, 5];

            return (
              <div key={biome} className="bg-gray-700/30 rounded-lg p-4 border-2 border-gray-600">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{biomeConfig.icon}</span>
                  <h3 className="text-xl font-bold text-white">{biomeConfig.name}</h3>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {tiers.map((tier) => {
                    const status = getBiomeTierStatus(biome, tier);

                    let bgColor = 'bg-gray-600';
                    let textColor = 'text-gray-500';
                    let borderColor = 'border-gray-500';
                    let hoverEffect = '';
                    let cursor = 'cursor-not-allowed';

                    if (status === 'current') {
                      bgColor = 'bg-blue-600';
                      textColor = 'text-white';
                      borderColor = 'border-blue-400';
                      cursor = 'cursor-pointer';
                    } else if (status === 'unlocked') {
                      bgColor = 'bg-green-600';
                      textColor = 'text-white';
                      borderColor = 'border-green-400';
                      hoverEffect = 'hover:bg-green-700 hover:scale-105';
                      cursor = 'cursor-pointer';
                    } else if (status === 'locked') {
                      bgColor = 'bg-gray-700';
                      textColor = 'text-gray-400';
                      borderColor = 'border-gray-600';
                    }

                    return (
                      <button
                        key={tier}
                        onClick={() => handleBiomeTierClick(biome, tier)}
                        disabled={status === 'locked' || status === 'unavailable'}
                        className={`${bgColor} ${textColor} ${borderColor} ${hoverEffect} ${cursor} border-2 rounded-lg py-2 px-3 font-bold transition-all text-sm`}
                      >
                        T{tier}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-600 rounded border border-blue-400"></div>
            <span className="text-gray-400">Current</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-600 rounded border border-green-400"></div>
            <span className="text-gray-400">Unlocked</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-700 rounded border border-gray-600"></div>
            <span className="text-gray-400">Locked</span>
          </div>
        </div>
      </div>
    </div>
  );
}
