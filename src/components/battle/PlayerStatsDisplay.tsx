'use client';

import { usePlayer } from '@/contexts/PlayerContext';
import { useEquipment } from '@/contexts/EquipmentContext';
import { useBiome } from '@/contexts/BiomeContext';
import { calculateTotalEquipmentStats } from '@/utils/equipmentCalculations';
import { getXPForLevel, getBaseCritChance } from '@/utils/playerProgression';
import DebuffIndicators from '@/components/battle/effect-indicators/PlayerDebuffIndicators';
import PlayerBuffIndicators from '@/components/battle/effect-indicators/PlayerBuffIndicators';
import type { ActiveDebuff } from '@/lib/types';
import type { Buff } from '@/types/buffs';
import { BuffType } from '@/types/buffs';

interface PlayerStatsDisplayProps {
  activeDebuffs?: ActiveDebuff[];
  activeBuffs?: Buff[];
}

export default function PlayerStatsDisplay({ activeDebuffs = [], activeBuffs = [] }: PlayerStatsDisplayProps) {
  const { playerStats, getCurrentStreak } = usePlayer();
  const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2 } = useEquipment();
  const { selectedBiome, selectedTier } = useBiome();

  if (!playerStats) return null;

  // Helper function to calculate actual damage reduction from defense stat
  const calculateActualReduction = (defense: number): number => {
    const K = 67;
    const MAX_REDUCTION = 80;
    return Math.round((defense / (defense + K)) * MAX_REDUCTION * 10) / 10;
  };

  // Helper function to calculate actual slowdown percentage from attack speed stat
  const calculateActualSlowdown = (attackSpeed: number): number => {
    const K = 67;
    const MAX_SLOWDOWN = 50;
    return Math.round((attackSpeed / (attackSpeed + K)) * MAX_SLOWDOWN * 10) / 10;
  };

  // Calculate total equipment bonuses first (needed for HP calculation)
  const equipmentStats = calculateTotalEquipmentStats(
    equippedWeapon,
    equippedArmor,
    equippedAccessory1,
    equippedAccessory2
  );

  // Defensive number coercion for all numeric values to prevent NaN
  const currentHealth = Number(playerStats.currentHealth) || 0;
  const baseMaxHealth = Number(playerStats.maxHealth) || 100;
  // Add equipment HP bonus to max health
  const maxHealth = baseMaxHealth + (Number(equipmentStats.maxHpBonus) || 0);
  const healthPercentage = maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 0;

  // Get per-zone streak (uses current biome/tier)
  const streak = selectedBiome && selectedTier ? getCurrentStreak(selectedBiome, selectedTier) : 0;
  const streakColor = streak >= 10 ? 'text-yellow-400' : streak >= 5 ? 'text-orange-400' : 'text-gray-300';
  const streakIcon = streak >= 10 ? '🔥' : streak >= 5 ? '⚡' : '🎯';

  const level = Number(playerStats.level) || 1;
  const coins = Number(playerStats.coins) || 0;
  const experience = Number(playerStats.experience) || 0;

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

  // Calculate total shield HP from active buffs
  const totalShieldHP = activeBuffs
    .filter(buff => buff.buffType === BuffType.SHIELD)
    .reduce((sum, buff) => sum + buff.value, 0);

  // Calculate total crit chance (base + equipment + buffs)
  const buffCritBoost = activeBuffs
    .filter(buff => buff.buffType === BuffType.CRIT_BOOST)
    .reduce((sum, buff) => sum + buff.value, 0);
  const rawCritChance = baseCritChance + (Number(equipmentStats.critChance) || 0) + buffCritBoost;

  // Convert excess crit (>100%) to crit damage multiplier
  const totalCritChance = Math.min(100, rawCritChance);
  const excessCrit = Math.max(0, rawCritChance - 100);
  const critMultiplier = 2.0 + (excessCrit / 100); // Base 2x + excess crit

  // XP progress - safe calculation to prevent NaN
  const xpForNextLevel = getXPForLevel(level);
  const xpProgress = xpForNextLevel > 0 ? (experience / xpForNextLevel) * 100 : 0;

  return (
    <div className="absolute top-16 sm:top-[172px] left-2 sm:left-4 bg-black/30 backdrop-blur-sm rounded-lg p-3 sm:p-5 border border-white/20 w-[calc(100vw-1rem)] sm:w-[320px] max-w-[320px]">
      <div className="text-white text-sm sm:text-base mb-2 sm:mb-3 flex justify-between items-center">
        <div>
          <span className="font-bold text-base sm:text-lg">Level {level}</span>
          <span className="ml-2 sm:ml-3 text-gray-300 text-sm sm:text-base">{coins} 💰</span>
        </div>
        <div className={`text-xs sm:text-sm font-bold ${streakColor}`} title="Win Streak">
          {streakIcon} {streak}
        </div>
      </div>

      {/* HP Bar */}
      <div className="mb-1.5 sm:mb-2">
        <div className="flex justify-between text-white text-xs sm:text-sm mb-1">
          <span>HP</span>
          <span className="font-bold">
            {totalShieldHP > 0 && (
              <span className="text-blue-400 mr-1">
                ({currentHealth + totalShieldHP})
              </span>
            )}
            {currentHealth} / {maxHealth}
          </span>
        </div>
        <div className="relative">
          {/* Base HP Bar */}
          <div className="w-full bg-black/40 rounded-full h-4 sm:h-5 overflow-hidden border border-red-900/50">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300 flex items-center justify-center"
              style={{ width: `${Math.max(0, Math.min(100, healthPercentage))}%` }}
            >
              {healthPercentage > 20 && !totalShieldHP && (
                <span className="text-white text-[10px] sm:text-xs font-bold">
                  {Math.round(healthPercentage)}%
                </span>
              )}
            </div>
          </div>

          {/* Shield HP Bar (Blue Overlay) */}
          {totalShieldHP > 0 && (
            <div className="absolute inset-0 w-full bg-transparent rounded-full h-4 sm:h-5 overflow-hidden pointer-events-none">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-300 flex items-center justify-center"
                style={{
                  width: `${Math.min(100, ((currentHealth + totalShieldHP) / maxHealth) * 100)}%`,
                  boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                }}
              >
                <span className="text-white text-[10px] sm:text-xs font-bold drop-shadow-lg">
                  🛡️ {totalShieldHP}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* XP Bar */}
      <div className="mb-2 sm:mb-3">
        <div className="flex justify-between text-white text-[10px] sm:text-xs mb-1">
          <span>XP</span>
          <span className="font-bold">
            {experience} / {xpForNextLevel}
          </span>
        </div>
        <div className="w-full bg-black/40 rounded-full h-2.5 sm:h-3 overflow-hidden border border-blue-900/50">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, xpProgress))}%` }}
          />
        </div>
      </div>

      {/* Active Buffs */}
      {activeBuffs.length > 0 && (
        <div className="mb-2 sm:mb-3 pt-1.5 sm:pt-2 border-t border-white/10">
          <div className="text-white/60 text-[10px] sm:text-xs mb-1">Active Buffs:</div>
          <PlayerBuffIndicators buffs={activeBuffs} size="small" showDuration={true} />
        </div>
      )}

      {/* Active Debuffs */}
      {activeDebuffs.length > 0 && (
        <div className={`mb-2 sm:mb-3 ${activeBuffs.length > 0 ? '' : 'pt-1.5 sm:pt-2 border-t border-white/10'}`}>
          <div className="text-white/60 text-[10px] sm:text-xs mb-1">Active Debuffs:</div>
          <DebuffIndicators debuffs={activeDebuffs} size="small" showDuration={true} />
        </div>
      )}

      {/* Stats (Total = Base + Equipment) */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
        <div className="text-white/80">
          <span className="text-white/60">⚔️ Damage:</span>{' '}
          <span className="text-white font-semibold">
            {totalDamage}
          </span>
          {(Number(equipmentStats.damageBonus) || 0) > 0 && (
            <span className="text-green-400 text-[9px] sm:text-[10px] ml-0.5 sm:ml-1">
              (+{Number(equipmentStats.damageBonus) || 0})
            </span>
          )}
        </div>
        <div className="text-white/80">
          <span className="text-white/60">💥 Crit:</span>{' '}
          <span className="text-white font-semibold">
            {totalCritChance.toFixed(0)}%
          </span>
          {((Number(equipmentStats.critChance) || 0) + buffCritBoost) > 0 && (
            <span className="text-yellow-400 text-[9px] sm:text-[10px] ml-0.5 sm:ml-1">
              (+{((Number(equipmentStats.critChance) || 0) + buffCritBoost).toFixed(0)}%)
            </span>
          )}
        </div>
        {/* Crit Multiplier (shows when crit > 100%) */}
        {excessCrit > 0 && (
          <div className="text-white/80">
            <span className="text-white/60">⚡ Crit Dmg:</span>{' '}
            <span className="text-orange-400 font-semibold">
              {critMultiplier.toFixed(2)}x
            </span>
            <span className="text-orange-400/70 text-[9px] sm:text-[10px] ml-0.5 sm:ml-1">
              (+{excessCrit.toFixed(0)}%)
            </span>
          </div>
        )}
        <div className="text-white/80">
          <span className="text-white/60">🛡️ Defense:</span>{' '}
          {(Number(equipmentStats.defense) || 0) > 0 ? (
            <span className="text-blue-400 font-semibold">
              {Number(equipmentStats.defense) || 0} <span className="text-gray-400 text-[9px] sm:text-[10px] ml-0.5 sm:ml-1">({calculateActualReduction(Number(equipmentStats.defense) || 0)}%)</span>
            </span>
          ) : (
            <span className="text-white/60">0</span>
          )}
        </div>
        <div className="text-white/80">
          <span className="text-white/60">🐌 Slow:</span>{' '}
          {(Number(equipmentStats.attackSpeed) || 0) > 0 ? (
            <span className="text-purple-400 font-semibold">
              {Number(equipmentStats.attackSpeed) || 0} <span className="text-gray-400 text-[9px] sm:text-[10px] ml-0.5 sm:ml-1">({calculateActualSlowdown(Number(equipmentStats.attackSpeed) || 0)}%)</span>
            </span>
          ) : (
            <span className="text-white/60">0</span>
          )}
        </div>
      </div>
    </div>
  );
}
