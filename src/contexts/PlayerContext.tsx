'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';

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
    battlesWonStreak: number; // Current win streak (resets on death)
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
  resetHealth: () => Promise<void>;
  takeDamage: (amount: number) => Promise<void>;
  healHealth: (amount: number) => Promise<void>;
  addCoins: (amount: number) => Promise<void>;
  addExperience: (amount: number) => Promise<void>;
  incrementStreak: () => Promise<void>;
  resetStreak: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch player stats on mount
  useEffect(() => {
    fetchPlayerStats();
  }, []);

  const fetchPlayerStats = async () => {
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
  };

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

  const resetHealth = async () => {
    if (!playerStats) return;

    await updatePlayerStats({
      currentHealth: playerStats.maxHealth,
    });
    toast.success('HP restored to full!');
  };

  /**
   * Client-side only HP reduction
   * Does NOT call backend - verification happens at battle completion
   * Similar to click tracking, HP is calculated on frontend and validated server-side
   */
  const takeDamage = async (amount: number) => {
    if (!playerStats) return;

    const newHealth = Math.max(0, playerStats.currentHealth - amount);

    // Update local state immediately
    setPlayerStats({
      ...playerStats,
      currentHealth: newHealth,
    });

    if (newHealth === 0) {
      toast.error('You have been defeated!');
    }
  };

  /**
   * Client-side only HP restoration
   * Does NOT call backend - item usage tracked separately in battle session
   * Server will verify items used during battle completion
   */
  const healHealth = async (amount: number) => {
    if (!playerStats) return;

    const newHealth = Math.min(playerStats.maxHealth, playerStats.currentHealth + amount);

    // Update local state immediately
    setPlayerStats({
      ...playerStats,
      currentHealth: newHealth,
    });
  };

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

  const incrementStreak = async () => {
    if (!playerStats) return;

    const newStreak = playerStats.stats.battlesWonStreak + 1;

    // Update local state immediately
    setPlayerStats({
      ...playerStats,
      stats: {
        ...playerStats.stats,
        battlesWon: playerStats.stats.battlesWon + 1,
        battlesWonStreak: newStreak,
      },
    });

    // Update backend
    await updatePlayerStats({
      stats: {
        ...playerStats.stats,
        battlesWon: playerStats.stats.battlesWon + 1,
        battlesWonStreak: newStreak,
      },
    });
  };

  const resetStreak = async () => {
    if (!playerStats) return;

    // Update local state immediately
    setPlayerStats({
      ...playerStats,
      stats: {
        ...playerStats.stats,
        battlesWonStreak: 0,
      },
    });

    // Update backend
    await updatePlayerStats({
      stats: {
        ...playerStats.stats,
        battlesWonStreak: 0,
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
