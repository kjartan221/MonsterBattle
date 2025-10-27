'use client';

import type { MonsterFrontend } from '@/lib/types';

interface MonsterCardProps {
  monster: MonsterFrontend;
  isAttacking: boolean;
  isDefeated: boolean;
  onAttack: () => void;
}

/**
 * Display monster sprite with click handling and attack animations
 * Isolates monster interaction from parent component
 */
export default function MonsterCard({
  monster,
  isAttacking,
  isDefeated,
  onAttack
}: MonsterCardProps) {
  // Rarity colors
  const rarityColors = {
    common: 'from-gray-500 to-gray-600',
    rare: 'from-blue-500 to-blue-600',
    epic: 'from-purple-500 to-purple-600',
    legendary: 'from-yellow-500 to-orange-600'
  };

  const rarityBorderColors = {
    common: 'border-gray-400',
    rare: 'border-blue-400',
    epic: 'border-purple-400',
    legendary: 'border-yellow-400'
  };

  return (
    <button
      onClick={onAttack}
      disabled={isDefeated}
      className={`w-72 h-72 bg-gradient-to-br ${rarityColors[monster.rarity]} rounded-2xl shadow-2xl transition-all duration-150 flex items-center justify-center cursor-pointer border-4 ${rarityBorderColors[monster.rarity]} ${
        isDefeated
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:scale-105 active:scale-95 hover:border-white/60'
      } ${isAttacking ? 'animate-pulse border-red-500 shadow-red-500/50 shadow-2xl' : ''}`}
    >
      <div className="text-center">
        <div className={`text-9xl mb-4 transition-transform ${isAttacking ? 'scale-110' : ''}`}>
          {monster.imageUrl}
        </div>
        {!isDefeated && (
          <p className="text-white text-xl font-bold">Click to Attack!</p>
        )}
        {isDefeated && (
          <p className="text-white text-xl font-bold">DEFEATED!</p>
        )}
      </div>
    </button>
  );
}
