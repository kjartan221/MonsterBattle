'use client';

import { usePlayer } from '@/contexts/PlayerContext';
import { useEquipment } from '@/contexts/EquipmentContext';
import { calculateTotalEquipmentStats } from '@/utils/equipmentCalculations';
import { getXPForLevel, getBaseCritChance } from '@/utils/playerProgression';
import DebuffIndicators from '@/components/battle/DebuffIndicators';
import type { ActiveDebuff } from '@/lib/types';

interface PlayerStatsDisplayProps {
  activeDebuffs?: ActiveDebuff[];
}

export default function PlayerStatsDisplay({ activeDebuffs = [] }: PlayerStatsDisplayProps) {
  const { playerStats } = usePlayer();
  const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2 } = useEquipment();

  if (!playerStats) return null;

  // Defensive number coercion for all numeric values to prevent NaN
  const currentHealth = Number(playerStats.currentHealth) || 0;
  const maxHealth = Number(playerStats.maxHealth) || 100;
  const healthPercentage = maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 0;

  const streak = Number(playerStats.stats?.battlesWonStreak) || 0;
  const streakColor = streak >= 10 ? 'text-yellow-400' : streak >= 5 ? 'text-orange-400' : 'text-gray-300';
  const streakIcon = streak >= 10 ? '🔥' : streak >= 5 ? '⚡' : '🎯';

  const level = Number(playerStats.level) || 1;
  const coins = Number(playerStats.coins) || 0;
  const experience = Number(playerStats.experience) || 0;

  // Calculate total equipment bonuses
  const equipmentStats = calculateTotalEquipmentStats(
    equippedWeapon,
    equippedArmor,
    equippedAccessory1,
    equippedAccessory2
  );

  // Calculate total stats (base + equipment)
  // Ensure all values are valid numbers to prevent NaN
  const baseCritChance = getBaseCritChance(); // 5%

  // Debug logging to track NaN issue
  if (isNaN(playerStats.baseDamage) || isNaN(equipmentStats.damageBonus)) {
    console.error('❌ NaN detected in PlayerStatsDisplay:', {
      baseDamage: playerStats.baseDamage,
      baseDamageType: typeof playerStats.baseDamage,
      equipmentDamageBonus: equipmentStats.damageBonus,
      equipmentDamageBonusType: typeof equipmentStats.damageBonus
    });
  }

  const totalDamage = (Number(playerStats.baseDamage) || 1) + (Number(equipmentStats.damageBonus) || 0);
  const totalCritChance = baseCritChance + (Number(equipmentStats.critChance) || 0);

  // XP progress - safe calculation to prevent NaN
  const xpForNextLevel = getXPForLevel(level);
  const xpProgress = xpForNextLevel > 0 ? (experience / xpForNextLevel) * 100 : 0;

  return (
    <div className="absolute top-[100px] sm:top-[110px] left-2 sm:left-4 bg-black/30 backdrop-blur-sm rounded-lg p-5 border border-white/20 w-[calc(100vw-1rem)] sm:w-[320px] max-w-[320px]">
      <div className="text-white text-base mb-3 flex justify-between items-center">
        <div>
          <span className="font-bold text-lg">Level {level}</span>
          <span className="ml-3 text-gray-300 text-base">{coins} 💰</span>
        </div>
        <div className={`text-sm font-bold ${streakColor}`} title="Win Streak">
          {streakIcon} {streak}
        </div>
      </div>

      {/* HP Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-white text-sm mb-1">
          <span>HP</span>
          <span className="font-bold">
            {currentHealth} / {maxHealth}
          </span>
        </div>
        <div className="w-full bg-black/40 rounded-full h-5 overflow-hidden border border-red-900/50">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300 flex items-center justify-center"
            style={{ width: `${Math.max(0, Math.min(100, healthPercentage))}%` }}
          >
            {healthPercentage > 20 && (
              <span className="text-white text-xs font-bold">
                {Math.round(healthPercentage)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* XP Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-white text-xs mb-1">
          <span>XP</span>
          <span className="font-bold">
            {experience} / {xpForNextLevel}
          </span>
        </div>
        <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-blue-900/50">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, xpProgress))}%` }}
          />
        </div>
      </div>

      {/* Active Debuffs */}
      {activeDebuffs.length > 0 && (
        <div className="mb-3 pt-2 border-t border-white/10">
          <div className="text-white/60 text-xs mb-1">Active Debuffs:</div>
          <DebuffIndicators debuffs={activeDebuffs} size="small" showDuration={true} />
        </div>
      )}

      {/* Stats (Total = Base + Equipment) */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="text-white/80">
          <span className="text-white/60">⚔️ Damage:</span>{' '}
          <span className="text-white font-semibold">
            {totalDamage}
          </span>
          {(Number(equipmentStats.damageBonus) || 0) > 0 && (
            <span className="text-green-400 text-[10px] ml-1">
              (+{Number(equipmentStats.damageBonus) || 0})
            </span>
          )}
        </div>
        <div className="text-white/80">
          <span className="text-white/60">💥 Crit:</span>{' '}
          <span className="text-white font-semibold">
            {totalCritChance}%
          </span>
          {(Number(equipmentStats.critChance) || 0) > 0 && (
            <span className="text-yellow-400 text-[10px] ml-1">
              (+{Number(equipmentStats.critChance) || 0}%)
            </span>
          )}
        </div>
        <div className="text-white/80">
          <span className="text-white/60">🛡️ Defense:</span>{' '}
          <span className={(Number(equipmentStats.hpReduction) || 0) > 0 ? 'text-blue-400 font-semibold' : 'text-white/60'}>
            {Number(equipmentStats.hpReduction) || 0}%
          </span>
        </div>
        <div className="text-white/80">
          <span className="text-white/60">🐌 Slow:</span>{' '}
          <span className={(Number(equipmentStats.attackSpeed) || 0) > 0 ? 'text-purple-400 font-semibold' : 'text-white/60'}>
            {Number(equipmentStats.attackSpeed) || 0}%
          </span>
        </div>
      </div>
    </div>
  );
}
