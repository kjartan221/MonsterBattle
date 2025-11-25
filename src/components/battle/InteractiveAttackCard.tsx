'use client';

import { useState, useEffect } from 'react';
import type { InteractiveAttack } from '@/lib/types';

interface InteractiveAttackCardProps {
  attack: InteractiveAttack;
  isDestroyed: boolean;
  onAttack: () => void;
}

/**
 * Display interactive attack (meteor, comet, etc.) at top of arena
 * Player must click to destroy it before timer runs out
 */
export default function InteractiveAttackCard({
  attack,
  isDestroyed,
  onAttack
}: InteractiveAttackCardProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const hpPercent = (attack.currentHP / attack.maxHP) * 100;

  // Update countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(0, (attack.impactTime - Date.now()) / 1000);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [attack.impactTime]);

  // Determine warning level based on time remaining
  const isUrgent = timeRemaining <= 3;
  const isCritical = timeRemaining <= 1.5;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="relative flex flex-col items-center gap-1 sm:gap-2">
        {/* Warning Label */}
        <div className={`text-xs font-bold uppercase tracking-wider ${
          isCritical ? 'text-red-400 animate-pulse' : isUrgent ? 'text-orange-400' : 'text-yellow-400'
        }`}>
          ⚠️ INCOMING ATTACK ⚠️
        </div>

        {/* Attack Click Area - Responsive sizing */}
        <button
          onClick={onAttack}
          disabled={isDestroyed}
          className={`w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-xl shadow-2xl transition-all duration-150 flex items-center justify-center cursor-pointer border-4 ${
            isDestroyed
              ? 'bg-gray-700 opacity-30 cursor-not-allowed border-gray-500'
              : isCritical
              ? 'bg-gradient-to-br from-red-600 to-red-700 border-red-300 animate-pulse hover:scale-105 active:scale-95'
              : isUrgent
              ? 'bg-gradient-to-br from-orange-600 to-orange-700 border-orange-300 hover:scale-105 active:scale-95'
              : 'bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-300 hover:scale-105 active:scale-95'
          }`}
        >
          <div className="text-center">
            <div className="text-4xl sm:text-6xl md:text-7xl mb-1 sm:mb-2">
              {attack.imageUrl}
            </div>
            {!isDestroyed && (
              <p className={`font-bold text-xs sm:text-sm ${
                isCritical ? 'text-red-100' : 'text-white'
              }`}>
                Click to Destroy!
              </p>
            )}
            {isDestroyed && (
              <p className="text-gray-300 text-xs sm:text-sm font-bold">DESTROYED!</p>
            )}
          </div>
        </button>

        {/* HP Bar - Responsive width */}
        <div className="w-32 sm:w-40 md:w-48">
          <div className="flex justify-between mb-1">
            <span className="text-white text-xs font-semibold truncate">{attack.name}</span>
            <span className="text-white text-xs font-semibold">
              {Math.ceil(attack.currentHP)}/{attack.maxHP}
            </span>
          </div>
          <div className={`w-full bg-black/40 rounded-full h-2 sm:h-3 overflow-hidden border-2 ${
            isCritical ? 'border-red-400' : isUrgent ? 'border-orange-400' : 'border-yellow-400'
          }`}>
            <div
              className={`h-full transition-all duration-300 ${
                isCritical
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : isUrgent
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500'
              }`}
              style={{ width: `${Math.min(100, hpPercent)}%` }}
            />
          </div>
        </div>

        {/* Countdown Timer */}
        <div className={`text-sm sm:text-base font-bold ${
          isCritical ? 'text-red-300 animate-pulse' : isUrgent ? 'text-orange-300' : 'text-yellow-300'
        }`}>
          {isDestroyed ? (
            '✓ DESTROYED'
          ) : (
            <>
              ⏱️ Impact in {timeRemaining.toFixed(1)}s
            </>
          )}
        </div>

        {/* Damage Warning */}
        {!isDestroyed && (
          <div className={`text-xs font-semibold ${
            isCritical ? 'text-red-200' : 'text-orange-200'
          }`}>
            💥 {attack.damage} Damage
          </div>
        )}
      </div>
    </div>
  );
}
