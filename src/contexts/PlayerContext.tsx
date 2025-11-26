'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import toast from 'react-hot-toast';
import type { BiomeId, Tier } from '@/lib/biome-config';
import { getStreakForZone, incrementStreakForZone, resetStreakForZone, initializeStreaks, migrateLegacyStreak } from '@/utils/streakHelpers';

export interface PlayerStats {
  _id?: string;
  userId: string;
  level: number;
  experience: number;
  coins: number;
  maxHealth: number;
  currentHealth: number;

  // Equipment slots
  equippedWeapon?: string;
  equippedArmor?: string;
  equippedAccessory1?: string;
  equippedAccessory2?: string;
  equippedConsumables: string[];

  // Battle stats
  baseDamage: number;
  critChance: number;
  attackSpeed: number;

  // Progress tracking
  currentZone: number;
  currentTier: number;
  unlockedZones: string[];

  // Statistics
  stats: {
    battlesWon: number;
    battlesWonStreak: number; // Legacy: Global win streak (deprecated, kept for migration)
    battlesWonStreaks?: {
      // Per-zone streaks: biome → array of 5 tiers (0-indexed: [T1, T2, T3, T4, T5])
      forest: number[];
      desert: number[];
      ocean: number[];
      volcano: number[];
      castle: number[];
    };
    monstersDefeated: number;
    bossesDefeated: number;
    totalDamageDealt: number;
    itemsCollected: number;
    legendariesFound: number;
  };

  createdAt: Date | string;
  lastBattleAt?: Date | string;
}

interface PlayerContextType {
  playerStats: PlayerStats | null;
  loading: boolean;
  error: string | null;
  fetchPlayerStats: () => Promise<void>;
  updatePlayerStats: (updates: Partial<PlayerStats>) => Promise<void>;
  resetHealth: (maxHpBonus?: number) => Promise<void>;
  takeDamage: (amount: number) => Promise<void>;
  healHealth: (amount: number, maxHpBonus?: number) => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
  addExperience: (amount: number) => Promise<void>;
  incrementStreak: (biome: BiomeId, tier: Tier) => Promise<void>;
  resetStreak: (biome: BiomeId, tier: Tier) => Promise<void>;
  getCurrentStreak: (biome: BiomeId, tier: Tier) => number;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayerStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/player-stats');
      const data = await response.json();

      if (response.ok && data.success) {
        setPlayerStats(data.playerStats);
      } else {
        setError('Failed to load player stats');
        toast.error('Failed to load player stats');
      }
    } catch (err) {
      console.error('Error fetching player stats:', err);
      setError('Failed to load player stats');
      toast.error('Failed to load player stats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch player stats on mount
  useEffect(() => {
    fetchPlayerStats();
  }, [fetchPlayerStats]);

  const updatePlayerStats = async (updates: Partial<PlayerStats>) => {
    if (!playerStats) return;

    try {
      const response = await fetch('/api/player-stats', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPlayerStats(data.playerStats);
      } else {
        toast.error('Failed to update player stats');
      }
    } catch (err) {
      console.error('Error updating player stats:', err);
      toast.error('Failed to update player stats');
    }
  };

  const resetHealth = async (maxHpBonus: number = 0) => {
    if (!playerStats) return;

    // Calculate total max HP including equipment bonuses
    const totalMaxHP = playerStats.maxHealth + maxHpBonus;

    await updatePlayerStats({
      currentHealth: totalMaxHP,
    });
    toast.success('HP restored to full!');
  };

  /**
   * Client-side only HP reduction
   * Does NOT call backend - verification happens at battle completion
   * Similar to click tracking, HP is calculated on frontend and validated server-side
   *
   * IMPORTANT: Memoized with useCallback to prevent infinite loops in hooks
   * that depend on this function (useMonsterAttack, useDebuffs)
   */
  const takeDamage = useCallback(async (amount: number) => {
    // Use functional setState to avoid stale state issues and dependency on playerStats
    setPlayerStats((prevStats) => {
      if (!prevStats) return prevStats;

      const newHealth = Math.max(0, prevStats.currentHealth - amount);

      if (newHealth === 0) {
        toast.error('You have been defeated!');
      }

      return {
        ...prevStats,
        currentHealth: newHealth,
      };
    });
  }, []); // Empty dependency array - function uses functional setState

  /**
   * Client-side only HP restoration
   * Does NOT call backend - item usage tracked separately in battle session
   * Server will verify items used during battle completion
   *
   * @param amount - Amount of HP to heal
   * @param maxHpBonus - Optional equipment max HP bonus (default: 0)
   */
  const healHealth = useCallback(async (amount: number, maxHpBonus: number = 0) => {
    if (!playerStats) return;

    // Use functional setState to avoid stale state issues
    setPlayerStats((prevStats) => {
      if (!prevStats) return prevStats;

      // Calculate total max HP including equipment bonuses
      const totalMaxHP = prevStats.maxHealth + maxHpBonus;

      // Cap at totalMaxHP (base + equipment bonus)
      const newHealth = Math.min(totalMaxHP, prevStats.currentHealth + amount);

      return {
        ...prevStats,
        currentHealth: newHealth,
      };
    });
  }, [playerStats]);

  const addCoins = async (amount: number) => {
    if (!playerStats) return;

    const newCoins = playerStats.coins + amount;

    // Update local state immediately
    setPlayerStats({
      ...playerStats,
      coins: newCoins,
    });

    // Update backend
    await updatePlayerStats({
      coins: newCoins,
    });
  };

  const addExperience = async (amount: number) => {
    if (!playerStats) return;

    const newExperience = playerStats.experience + amount;

    // Update local state immediately
    setPlayerStats({
      ...playerStats,
      experience: newExperience,
    });

    // Update backend
    await updatePlayerStats({
      experience: newExperience,
    });
  };

  /**
   * Get current streak for a specific biome/tier
   */
  const getCurrentStreak = (biome: BiomeId, tier: Tier): number => {
    if (!playerStats) return 0;

    // Migrate legacy streak if needed
    if (!playerStats.stats.battlesWonStreaks) {
      const migrated = migrateLegacyStreak(playerStats, biome, tier);
      return getStreakForZone(migrated, biome, tier);
    }

    return getStreakForZone(playerStats.stats.battlesWonStreaks, biome, tier);
  };

  const incrementStreak = async (biome: BiomeId, tier: Tier) => {
    if (!playerStats) return;

    // Initialize or migrate streaks if needed
    let streaks = playerStats.stats.battlesWonStreaks;
    if (!streaks) {
      streaks = migrateLegacyStreak(playerStats, biome, tier);
    }

    // Increment the specific zone's streak
    const updatedStreaks = incrementStreakForZone(streaks, biome, tier);

    // Update local state immediately
    setPlayerStats({
      ...playerStats,
      stats: {
        ...playerStats.stats,
        battlesWon: playerStats.stats.battlesWon + 1,
        battlesWonStreak: getStreakForZone(updatedStreaks, biome, tier), // Keep legacy field synced
        battlesWonStreaks: updatedStreaks,
      },
    });

    // Update backend
    await updatePlayerStats({
      stats: {
        ...playerStats.stats,
        battlesWon: playerStats.stats.battlesWon + 1,
        battlesWonStreak: getStreakForZone(updatedStreaks, biome, tier),
        battlesWonStreaks: updatedStreaks,
      },
    });
  };

  const resetStreak = async (biome: BiomeId, tier: Tier) => {
    if (!playerStats) return;

    // Initialize or migrate streaks if needed
    let streaks = playerStats.stats.battlesWonStreaks;
    if (!streaks) {
      streaks = initializeStreaks();
    }

    // Reset the specific zone's streak
    const updatedStreaks = resetStreakForZone(streaks, biome, tier);

    // Update local state immediately
    setPlayerStats({
      ...playerStats,
      stats: {
        ...playerStats.stats,
        battlesWonStreak: 0, // Keep legacy field synced
        battlesWonStreaks: updatedStreaks,
      },
    });

    // Update backend
    await updatePlayerStats({
      stats: {
        ...playerStats.stats,
        battlesWonStreak: 0,
        battlesWonStreaks: updatedStreaks,
      },
    });
  };

  const value: PlayerContextType = {
    playerStats,
    loading,
    error,
    fetchPlayerStats,
    updatePlayerStats,
    resetHealth,
    takeDamage,
    healHealth,
    addCoins,
    addExperience,
    incrementStreak,
    resetStreak,
    getCurrentStreak,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
