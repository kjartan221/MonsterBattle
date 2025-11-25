/**
 * Streak Management Utilities
 * Handles per-zone streak tracking (5 biomes × 5 tiers = 25 independent streaks)
 */

import type { BiomeId, Tier } from '@/lib/biome-config';
import type { PlayerStats } from '@/contexts/PlayerContext';

export type BiomeStreaks = {
  forest: number[];
  desert: number[];
  ocean: number[];
  volcano: number[];
  castle: number[];
};

/**
 * Initialize empty streak structure (all zeros)
 */
export function initializeStreaks(): BiomeStreaks {
  return {
    forest: [0, 0, 0, 0, 0],
    desert: [0, 0, 0, 0, 0],
    ocean: [0, 0, 0, 0, 0],
    volcano: [0, 0, 0, 0, 0],
    castle: [0, 0, 0, 0, 0]
  };
}

/**
 * Get current streak for a specific biome and tier
 * @param streaks - Player's streak data
 * @param biome - Biome ID
 * @param tier - Tier (1-5)
 * @returns Current streak count
 */
export function getStreakForZone(
  streaks: BiomeStreaks | undefined,
  biome: BiomeId,
  tier: Tier
): number {
  if (!streaks || !streaks[biome]) {
    return 0;
  }

  // Tiers are 1-indexed, arrays are 0-indexed
  const tierIndex = tier - 1;

  if (tierIndex < 0 || tierIndex >= 5) {
    return 0;
  }

  return streaks[biome][tierIndex] || 0;
}

/**
 * Set streak for a specific biome and tier
 * @param streaks - Player's streak data (will be mutated)
 * @param biome - Biome ID
 * @param tier - Tier (1-5)
 * @param value - New streak value
 * @returns Updated streaks object
 */
export function setStreakForZone(
  streaks: BiomeStreaks | undefined,
  biome: BiomeId,
  tier: Tier,
  value: number
): BiomeStreaks {
  // Initialize if needed
  if (!streaks) {
    streaks = initializeStreaks();
  }

  // Ensure biome array exists
  if (!streaks[biome]) {
    streaks[biome] = [0, 0, 0, 0, 0];
  }

  // Tiers are 1-indexed, arrays are 0-indexed
  const tierIndex = tier - 1;

  if (tierIndex >= 0 && tierIndex < 5) {
    streaks[biome][tierIndex] = value;
  }

  return streaks;
}

/**
 * Increment streak for a specific biome and tier
 * @param streaks - Player's streak data
 * @param biome - Biome ID
 * @param tier - Tier (1-5)
 * @returns Updated streaks object
 */
export function incrementStreakForZone(
  streaks: BiomeStreaks | undefined,
  biome: BiomeId,
  tier: Tier
): BiomeStreaks {
  const currentStreak = getStreakForZone(streaks, biome, tier);
  return setStreakForZone(streaks, biome, tier, currentStreak + 1);
}

/**
 * Reset streak for a specific biome and tier
 * @param streaks - Player's streak data
 * @param biome - Biome ID
 * @param tier - Tier (1-5)
 * @returns Updated streaks object
 */
export function resetStreakForZone(
  streaks: BiomeStreaks | undefined,
  biome: BiomeId,
  tier: Tier
): BiomeStreaks {
  return setStreakForZone(streaks, biome, tier, 0);
}

/**
 * Get the highest streak across all zones
 * @param streaks - Player's streak data
 * @returns Highest streak value and its location
 */
export function getHighestStreak(
  streaks: BiomeStreaks | undefined
): { value: number; biome: BiomeId | null; tier: Tier | null } {
  if (!streaks) {
    return { value: 0, biome: null, tier: null };
  }

  let maxStreak = 0;
  let maxBiome: BiomeId | null = null;
  let maxTier: Tier | null = null;

  const biomes: BiomeId[] = ['forest', 'desert', 'ocean', 'volcano', 'castle'];

  for (const biome of biomes) {
    if (streaks[biome]) {
      for (let i = 0; i < streaks[biome].length; i++) {
        if (streaks[biome][i] > maxStreak) {
          maxStreak = streaks[biome][i];
          maxBiome = biome;
          maxTier = (i + 1) as Tier;
        }
      }
    }
  }

  return { value: maxStreak, biome: maxBiome, tier: maxTier };
}

/**
 * Migrate legacy global streak to current zone
 * Used for backward compatibility when updating existing players
 * @param playerStats - Player stats with legacy battlesWonStreak
 * @param currentBiome - Current biome
 * @param currentTier - Current tier
 * @returns Initialized streak structure with legacy value in current zone
 */
export function migrateLegacyStreak(
  playerStats: PlayerStats,
  currentBiome: BiomeId,
  currentTier: Tier
): BiomeStreaks {
  const streaks = initializeStreaks();
  const legacyStreak = playerStats.stats?.battlesWonStreak || 0;

  // Place legacy streak in current zone
  if (legacyStreak > 0) {
    return setStreakForZone(streaks, currentBiome, currentTier, legacyStreak);
  }

  return streaks;
}
