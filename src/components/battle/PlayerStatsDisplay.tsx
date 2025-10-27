'use client';

import { usePlayer } from '@/contexts/PlayerContext';

export default function PlayerStatsDisplay() {
  const { playerStats } = usePlayer();

  if (!playerStats) return null;

  const healthPercentage = (playerStats.currentHealth / playerStats.maxHealth) * 100;

  const streak = playerStats.stats.battlesWonStreak;
  const streakColor = streak >= 10 ? 'text-yellow-400' : streak >= 5 ? 'text-orange-400' : 'text-gray-300';
  const streakIcon = streak >= 10 ? '🔥' : streak >= 5 ? '⚡' : '🎯';

  return (
    <div className="absolute top-4 left-4 bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/20 min-w-[200px]">
      <div className="text-white text-sm mb-2 flex justify-between items-center">
        <div>
          <span className="font-bold">Level {playerStats.level}</span>
          <span className="ml-2 text-gray-300">{playerStats.coins} 💰</span>
        </div>
        <div className={`text-xs font-bold ${streakColor}`} title="Win Streak">
          {streakIcon} {streak}
        </div>
      </div>
      <div className="mb-1">
        <div className="flex justify-between text-white text-xs mb-1">
          <span>HP</span>
          <span className="font-bold">
            {playerStats.currentHealth} / {playerStats.maxHealth}
          </span>
        </div>
        <div className="w-full bg-black/40 rounded-full h-4 overflow-hidden border border-red-900/50">
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
    </div>
  );
}
