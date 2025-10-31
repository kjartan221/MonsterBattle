'use client';

import { useState } from 'react';
import type { LootItem } from '@/lib/loot-table';
import { tierToRoman, getTierBadgeClassName } from '@/utils/tierUtils';

interface LootSelectionModalProps {
  lootOptions: LootItem[] | null;
  tier: number; // Which tier these items dropped from (1-5)
  onLootSelect: (loot: LootItem) => void;
  onSkip: () => void;
}

export default function LootSelectionModal({ lootOptions, tier, onLootSelect, onSkip }: LootSelectionModalProps) {
  const [selectedLoot, setSelectedLoot] = useState<LootItem | null>(null);

  if (!lootOptions || lootOptions.length === 0) return null;

  const handleSelection = (loot: LootItem) => {
    console.log('🎁 [LootModal] Item clicked:', loot.name);
    setSelectedLoot(loot);
    console.log('🎁 [LootModal] Calling onLootSelect callback...');
    onLootSelect(loot);
  };

  const handleSkip = () => {
    console.log('⏭️ [LootModal] Skip button clicked');
    console.log('⏭️ [LootModal] Calling onSkip callback...');
    onSkip();
  };

  // Rarity colors
  const rarityBg = {
    common: 'from-gray-600 to-gray-700',
    rare: 'from-blue-600 to-blue-700',
    epic: 'from-purple-600 to-purple-700',
    legendary: 'from-yellow-600 to-orange-700'
  };

  const rarityBorder = {
    common: 'border-gray-400',
    rare: 'border-blue-400',
    epic: 'border-purple-400',
    legendary: 'border-yellow-400'
  };

  const rarityGlow = {
    common: '',
    rare: 'shadow-blue-500/50',
    epic: 'shadow-purple-500/50',
    legendary: 'shadow-yellow-500/50'
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-purple-900 to-indigo-900 border-2 sm:border-4 border-yellow-500 rounded-lg sm:rounded-xl p-4 sm:p-8 max-w-6xl w-full shadow-2xl my-4 sm:my-8">
        <div className="text-center mb-4 sm:mb-8">
          <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">🎁</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-1 sm:mb-2">
            Victory Spoils!
          </h2>
          <p className="text-white text-sm sm:text-lg">
            Choose ONE item to claim as your reward
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-4">
          {lootOptions.map((loot) => {
            const isSelected = selectedLoot?.lootId === loot.lootId;

            return (
              <button
                key={loot.lootId}
                onClick={() => handleSelection(loot)}
                disabled={!!selectedLoot}
                className={`relative bg-gradient-to-br ${rarityBg[loot.rarity]} border-2 sm:border-4 ${rarityBorder[loot.rarity]} rounded-lg sm:rounded-xl p-3 sm:p-6 transition-all duration-300 ${
                  isSelected
                    ? `scale-105 sm:scale-110 ${rarityGlow[loot.rarity]} shadow-2xl`
                    : selectedLoot
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:scale-105 hover:shadow-xl cursor-pointer active:scale-95'
                }`}
              >
                {/* Tier badge (bottom left corner) */}
                <div className={getTierBadgeClassName()}>
                  {tierToRoman(tier)}
                </div>

                <div className="text-center">
                  <div className="text-4xl sm:text-6xl mb-2 sm:mb-3">{loot.icon}</div>
                  <h3 className="text-sm sm:text-xl font-bold text-white mb-1 sm:mb-2 line-clamp-2">
                    {loot.name}
                  </h3>
                  <span className={`text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full uppercase ${
                    loot.rarity === 'legendary' ? 'bg-yellow-500 text-black' :
                    loot.rarity === 'epic' ? 'bg-purple-500 text-white' :
                    loot.rarity === 'rare' ? 'bg-blue-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {loot.rarity}
                  </span>
                  <p className="text-white/80 text-xs sm:text-sm mt-2 sm:mt-3 line-clamp-2 hidden sm:block">
                    {loot.description}
                  </p>
                  <p className="text-white/60 text-[10px] sm:text-xs mt-1 sm:mt-2 hidden sm:block">
                    {loot.type}
                  </p>
                  {isSelected && (
                    <div className="mt-2 sm:mt-4 text-green-400 text-xs sm:text-base font-bold animate-pulse">
                      ✓ SELECTED!
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {selectedLoot && (
          <div className="mt-4 sm:mt-6 text-center text-green-400 text-sm sm:text-lg font-bold animate-pulse">
            You have claimed: {selectedLoot.name}!
          </div>
        )}

        {/* Skip Button */}
        {!selectedLoot && (
          <div className="mt-4 sm:mt-6 flex justify-center">
            <button
              onClick={handleSkip}
              className="px-4 sm:px-8 py-2 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm sm:text-base font-semibold rounded-lg transition-colors shadow-lg border-2 border-gray-500 hover:border-gray-400 cursor-pointer"
            >
              Skip Loot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
