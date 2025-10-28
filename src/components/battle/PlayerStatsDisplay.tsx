'use client';

import { usePlayer } from '@/contexts/PlayerContext';
import { useEquipment } from '@/contexts/EquipmentContext';
import { calculateTotalEquipmentStats } from '@/utils/equipmentCalculations';
import { getXPForLevel, getBaseCritChance } from '@/utils/playerProgression';

export default function PlayerStatsDisplay() {
  const { playerStats } = usePlayer();
  const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2 } = useEquipment();

  if (!playerStats) return null;

  const healthPercentage = (playerStats.currentHealth / playerStats.maxHealth) * 100;

  const streak = playerStats.stats.battlesWonStreak;
  const streakColor = streak >= 10 ? 'text-yellow-400' : streak >= 5 ? 'text-orange-400' : 'text-gray-300';
  const streakIcon = streak >= 10 ? '🔥' : streak >= 5 ? '⚡' : '🎯';

  // Calculate total equipment bonuses
  const equipmentStats = calculateTotalEquipmentStats(
    equippedWeapon,
    equippedArmor,
    equippedAccessory1,
    equippedAccessory2
  );

  // Calculate total stats (base + equipment)
  const baseCritChance = getBaseCritChance(); // 5%
  const totalDamage = playerStats.baseDamage + equipmentStats.damageBonus;
  const totalCritChance = baseCritChance + equipmentStats.critChance;

  // XP progress
  const xpForNextLevel = getXPForLevel(playerStats.level);
  const xpProgress = (playerStats.experience / xpForNextLevel) * 100;

  return (
    <div className="absolute top-4 left-2 sm:left-4 bg-black/30 backdrop-blur-sm rounded-lg p-5 border border-white/20 w-[calc(100vw-1rem)] sm:w-[320px] max-w-[320px]">
      <div className="text-white text-base mb-3 flex justify-between items-center">
        <div>
          <span className="font-bold text-lg">Level {playerStats.level}</span>
          <span className="ml-3 text-gray-300 text-base">{playerStats.coins} 💰</span>
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
            {playerStats.currentHealth} / {playerStats.maxHealth}
          </span>
        </div>
        <div className="w-full bg-black/40 rounded-full h-5 overflow-hidden border border-red-900/50">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300 flex items-center justify-center"
            style={{ width: `${healthPercentage}%` }}
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
            {playerStats.experience} / {xpForNextLevel}
          </span>
        </div>
        <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-blue-900/50">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${Math.min(100, xpProgress)}%` }}
          />
        </div>
      </div>

      {/* Stats (Total = Base + Equipment) */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="text-white/80">
          <span className="text-white/60">⚔️ Damage:</span>{' '}
          <span className="text-white font-semibold">
            {totalDamage}
          </span>
          {equipmentStats.damageBonus > 0 && (
            <span className="text-green-400 text-[10px] ml-1">
              (+{equipmentStats.damageBonus})
            </span>
          )}
        </div>
        <div className="text-white/80">
          <span className="text-white/60">💥 Crit:</span>{' '}
          <span className="text-white font-semibold">
            {totalCritChance}%
          </span>
          {equipmentStats.critChance > 0 && (
            <span className="text-yellow-400 text-[10px] ml-1">
              (+{equipmentStats.critChance}%)
            </span>
          )}
        </div>
        <div className="text-white/80">
          <span className="text-white/60">🛡️ Defense:</span>{' '}
          <span className={equipmentStats.hpReduction > 0 ? 'text-blue-400 font-semibold' : 'text-white/60'}>
            {equipmentStats.hpReduction}%
          </span>
        </div>
        <div className="text-white/80">
          <span className="text-white/60">🐌 Slow:</span>{' '}
          <span className={equipmentStats.attackSpeed > 0 ? 'text-purple-400 font-semibold' : 'text-white/60'}>
            {equipmentStats.attackSpeed}%
          </span>
        </div>
      </div>
    </div>
  );
}
