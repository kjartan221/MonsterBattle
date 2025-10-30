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
  // If not a multi-phase boss, render regular HP bar
  if (!monster.isBoss || totalPhases <= 1) {
    const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));

    return (
      <div className="w-full max-w-md">
        {/* Regular HP Bar */}
        <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-sm drop-shadow-lg">
              {currentHP} / {maxHP} HP
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Calculate which phase bar is currently being depleted
  let remainingHP = currentHP;
  const phaseBarData: { hpPercent: number; isDepleted: boolean }[] = [];

  for (let i = 0; i < phaseHP.length; i++) {
    const phaseMaxHP = phaseHP[i];

    if (remainingHP > 0) {
      // This phase bar is active or full
      const hpInThisPhase = Math.min(remainingHP, phaseMaxHP);
      const hpPercent = (hpInThisPhase / phaseMaxHP) * 100;
      phaseBarData.push({ hpPercent, isDepleted: false });
      remainingHP -= phaseMaxHP;
    } else {
      // This phase has been completed (depleted)
      phaseBarData.push({ hpPercent: 0, isDepleted: true });
    }
  }

  return (
    <div className="w-full max-w-md relative">
      {/* Phase Counter Badge */}
      <div className="absolute -top-2 -right-2 z-10">
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 text-white font-bold text-xs px-3 py-1 rounded-full shadow-lg border-2 border-purple-400">
          Phase {currentPhase}/{totalPhases}
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

      {/* Stacked Phase HP Bars */}
      <div className="flex flex-col gap-1">
        {phaseBarData.map((phaseData, index) => {
          const phaseNumber = index + 1;
          const isCurrentPhase = phaseNumber === currentPhase;

          return (
            <div
              key={index}
              className={`relative h-6 bg-gray-800 rounded-lg overflow-hidden border-2 transition-all ${
                isCurrentPhase && isInvulnerable
                  ? 'border-cyan-400 shadow-lg shadow-cyan-500/50 animate-pulse'
                  : phaseData.isDepleted
                  ? 'border-gray-700 opacity-40'
                  : 'border-gray-600'
              }`}
            >
              {/* HP Bar Fill */}
              <div
                className={`h-full transition-all duration-300 ${
                  phaseData.isDepleted
                    ? 'bg-gray-900'
                    : isCurrentPhase
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                    : 'bg-gradient-to-r from-purple-600 to-purple-500'
                }`}
                style={{ width: `${phaseData.hpPercent}%` }}
              />

              {/* Phase Label */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={`font-bold text-xs ${
                    phaseData.isDepleted ? 'text-gray-600' : 'text-white drop-shadow-lg'
                  }`}
                >
                  {phaseData.isDepleted ? 'DEPLETED' : `Phase ${phaseNumber}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total HP Display */}
      <div className="mt-2 text-center">
        <span className="text-gray-400 text-sm font-medium">
          Total: {currentHP} / {maxHP} HP
        </span>
      </div>
    </div>
  );
}
