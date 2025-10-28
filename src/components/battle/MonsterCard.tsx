'use client';

import { useState, useEffect } from 'react';
import type { MonsterFrontend } from '@/lib/types';

interface MonsterCardProps {
  monster: MonsterFrontend;
  isAttacking: boolean;
  isDefeated: boolean;
  onAttack: () => void;
  critTrigger?: number;
}

interface CritBadge {
  id: number;
  x: number;
  y: number;
}

/**
 * Display monster sprite with click handling and attack animations
 * Isolates monster interaction from parent component
 */
export default function MonsterCard({
  monster,
  isAttacking,
  isDefeated,
  onAttack,
  critTrigger = 0
}: MonsterCardProps) {
  const [critBadges, setCritBadges] = useState<CritBadge[]>([]);

  // When crit happens, add a new badge with random position
  useEffect(() => {
    if (critTrigger === 0) return;

    const newBadge: CritBadge = {
      id: critTrigger,
      // Random position in top-right area (60-90% width, 10-30% height)
      x: 60 + Math.random() * 30,
      y: 10 + Math.random() * 20
    };

    setCritBadges(prev => [...prev, newBadge]);

    // Remove badge after animation (1 second)
    const timer = setTimeout(() => {
      setCritBadges(prev => prev.filter(badge => badge.id !== critTrigger));
    }, 1000);

    return () => clearTimeout(timer);
  }, [critTrigger]);

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
    <div className="relative">
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

      {/* Critical Hit Badges */}
      {critBadges.map(badge => (
        <div
          key={badge.id}
          className="absolute pointer-events-none animate-crit-float"
          style={{
            left: `${badge.x}%`,
            top: `${badge.y}%`
          }}
        >
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold text-sm px-3 py-1 rounded-full shadow-xl border-2 border-yellow-300">
            💥 CRIT!
          </div>
        </div>
      ))}
    </div>
  );
}
