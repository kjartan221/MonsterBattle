'use client';

import { MonsterFrontend } from '@/lib/types';

interface BossPhaseIndicatorProps {
  monster: MonsterFrontend;
  currentHP: number;
  maxHP: number;
  currentPhase: number;
  totalPhases: number;
  phaseHP: number[];
  isInvulnerable: boolean;
}

/**
 * Displays stacked HP bars for boss phases with visual indicators
 *
 * Features:
 * - Stacked HP bars (one per phase)
 * - Phase counter badge (e.g., "Phase 2/3")
 * - Invulnerability visual effect (pulsing shield)
 * - HP depletes from current phase bar
 * - Completed phases show as depleted
 */
export default function BossPhaseIndicator({
  monster,
  currentHP,
  maxHP,
  currentPhase,
  totalPhases,
  phaseHP,
  isInvulnerable
}: BossPhaseIndicatorProps) {
  // If not a multi-phase boss OR only 1 phase remaining, render regular HP bar (no badge)
  if (!monster.isBoss || totalPhases <= 1) {
    const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));

    return (
      <div className="w-full max-w-md">
        {/* Regular HP Bar */}
        <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600">
          {/* Background layer: gray */}
          <div className="absolute inset-0 bg-gray-800" />

          {/* HP bar fill (depletes from right to left) */}
          <div
            className={`relative h-full transition-all duration-300 ${
              isInvulnerable
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 animate-pulse'
                : 'bg-gradient-to-r from-red-600 to-red-500'
            }`}
            style={{ width: `${hpPercent}%` }}
          />

          {/* HP text display */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-sm drop-shadow-lg z-10">
              {currentHP} / {maxHP} HP
            </span>
          </div>
          {/* Invulnerability badge */}
          {isInvulnerable && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10 animate-pulse">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold text-xs px-3 py-1 rounded-full shadow-xl border-2 border-cyan-300 flex items-center gap-1">
                🛡️ INVULNERABLE
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Multi-phase boss: Show single depleting bar with next phase color underneath
  const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));

  // Determine colors based on phasesRemaining (counts down as boss is defeated)
  // Color scheme: 4th+ → very dark, 3rd → purple, 2nd → orange, last → red
  // Example for 2-phase boss: phasesRemaining=2 (orange over red) → phasesRemaining=1 (red only, no badge)
  let currentPhaseColor = '';
  let nextPhaseColor = '';

  // Map phasesRemaining to colors
  switch (totalPhases) {
    case 4:
      // 4-phase boss: very dark → purple → orange → red
      if (currentPhase === 1) {
        currentPhaseColor = 'from-gray-700 to-gray-800';    // Very dark
        nextPhaseColor = 'from-purple-600 to-purple-500';   // Purple underneath
      } else if (currentPhase === 2) {
        currentPhaseColor = 'from-purple-600 to-purple-500'; // Purple
        nextPhaseColor = 'from-yellow-500 to-orange-500';    // Orange underneath
      } else if (currentPhase === 3) {
        currentPhaseColor = 'from-yellow-500 to-orange-500'; // Orange
        nextPhaseColor = 'from-red-600 to-red-500';          // Red underneath
      }
      break;

    case 3:
      // 3-phase boss: purple → orange → red
      if (currentPhase === 1) {
        currentPhaseColor = 'from-purple-600 to-purple-500'; // Purple
        nextPhaseColor = 'from-yellow-500 to-orange-500';    // Orange underneath
      } else if (currentPhase === 2) {
        currentPhaseColor = 'from-yellow-500 to-orange-500'; // Orange
        nextPhaseColor = 'from-red-600 to-red-500';          // Red underneath
      }
      break;

    case 2:
    default:
      // 2-phase boss: orange → red
      currentPhaseColor = 'from-yellow-500 to-orange-500'; // Orange
      nextPhaseColor = 'from-red-600 to-red-500';          // Red underneath
      break;
  }

  return (
    <div className="w-full max-w-md relative">
      {/* Phase Counter Badge (e.g., "x3", "x2") - bottom right outside the bar */}
      <div className="absolute bottom-0 -right-3 z-10">
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 text-white font-bold text-sm px-3 py-1.5 rounded-full shadow-lg border-2 border-purple-400">
          x{totalPhases}
        </div>
      </div>

      {/* Invulnerability Shield */}
      {isInvulnerable && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10 animate-pulse">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold text-xs px-3 py-1 rounded-full shadow-xl border-2 border-cyan-300 flex items-center gap-1">
            🛡️ INVULNERABLE
          </div>
        </div>
      )}

      {/* Single Depleting Phase HP Bar */}
      <div className={`relative h-8 rounded-lg overflow-hidden border-2 transition-all ${
        isInvulnerable
          ? 'border-cyan-400 shadow-lg shadow-cyan-500/50 animate-pulse'
          : 'border-gray-600'
      }`}>
        {/* Background: Next phase color */}
        <div className={`absolute inset-0 bg-gradient-to-r ${nextPhaseColor}`} />

        {/* Foreground: Current phase color (depletes) */}
        <div
          className={`relative h-full transition-all duration-300 bg-gradient-to-r ${
            isInvulnerable
              ? 'from-cyan-500 to-blue-500 animate-pulse'
              : currentPhaseColor
          }`}
          style={{ width: `${hpPercent}%` }}
        />

        {/* HP Display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold text-sm drop-shadow-lg z-10 ${
            currentHP > maxHP ? 'text-green-300' : 'text-white'
          }`}>
            {currentHP} / {maxHP} HP
            {currentHP > maxHP && (
              <span className="ml-1 text-xs text-green-400">
                ↑
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
