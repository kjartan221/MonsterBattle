'use client';

import type { SummonedCreature } from '@/lib/types';

interface SummonCardProps {
  summon: SummonedCreature;
  isDefeated: boolean;
  onAttack: () => void;
}

/**
 * Display summoned creature card with click handling
 * Smaller than main MonsterCard for visual hierarchy
 */
export default function SummonCard({
  summon,
  isDefeated,
  onAttack
}: SummonCardProps) {
  const hpPercent = (summon.currentHP / summon.maxHP) * 100;

  return (
    <div className="relative flex flex-col items-center gap-1 sm:gap-2">
      {/* Summon Label */}
      <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">
        Summon
      </div>

      {/* Summon Click Area - Responsive sizing */}
      <button
        onClick={onAttack}
        disabled={isDefeated}
        className={`w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl shadow-xl transition-all duration-150 flex items-center justify-center cursor-pointer border-2 border-purple-400 ${
          isDefeated
            ? 'opacity-30 cursor-not-allowed'
            : 'hover:scale-105 active:scale-95 hover:border-purple-200'
        }`}
      >
        <div className="text-center">
          <div className="text-3xl sm:text-5xl md:text-6xl mb-1 sm:mb-2">
            {summon.imageUrl}
          </div>
          {!isDefeated && (
            <p className="text-white text-xs sm:text-sm font-bold hidden sm:block">Click to Attack!</p>
          )}
          {isDefeated && (
            <p className="text-gray-400 text-xs sm:text-sm font-bold">DEFEATED!</p>
          )}
        </div>
      </button>

      {/* HP Bar - Responsive width */}
      <div className="w-24 sm:w-32 md:w-40">
        <div className="flex justify-between mb-1">
          <span className="text-white text-xs font-semibold truncate">{summon.name}</span>
          <span className="text-white text-xs font-semibold">
            {summon.currentHP}/{summon.maxHP}
          </span>
        </div>
        <div className="w-full bg-black/30 rounded-full h-2 sm:h-3 overflow-hidden border border-purple-400/50">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300"
            style={{ width: `${Math.min(100, hpPercent)}%` }}
          />
        </div>
      </div>

      {/* Attack Stat */}
      <div className="text-xs text-purple-300">
        ⚔️ {summon.attackDamage} ATK/sec
      </div>
    </div>
  );
}
