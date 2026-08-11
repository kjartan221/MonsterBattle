import type { BiomeId, Tier } from '@shared/biome-config';
import type { PlayerStats } from '@shared/types';
import { incrementStreakForZone, resetStreakForZone, getStreakForZone, initializeStreaks } from '@shared/streakHelpers';

export const DEATH_PENALTY_RATE = 0.10;

export function calcDeathPenalty(coins: number): { goldLost: number } {
  const safe = Number.isFinite(coins) && coins > 0 ? Math.floor(coins) : 0;
  return { goldLost: Math.floor(safe * DEATH_PENALTY_RATE) };
}

export interface VictoryInput {
  playerStats: Pick<PlayerStats, 'coins' | 'experience' | 'level' | 'maxHealth' | 'baseDamage' | 'stats'>;
  rewards: { xp: number; coins: number };
  levelUp: { leveledUp: boolean; newLevel: number; statIncreases: { maxHealth: number; baseDamage: number } };
  equipmentMaxHpBonus: number;
  biome: BiomeId;
  tier: Tier;
}

export function buildVictoryStatMutation(input: VictoryInput): Record<string, unknown> {
  const { playerStats, rewards, levelUp, equipmentMaxHpBonus, biome, tier } = input;
  const streaks = structuredClone(playerStats.stats.battlesWonStreaks ?? initializeStreaks());
  const updatedStreaks = incrementStreakForZone(streaks, biome, tier);

  const $inc: Record<string, number> = { coins: rewards.coins, 'stats.battlesWon': 1 };
  const $set: Record<string, unknown> = {
    'stats.battlesWonStreaks': updatedStreaks,
    'stats.battlesWonStreak': getStreakForZone(updatedStreaks, biome, tier),
  };

  if (levelUp.leveledUp) {
    const newMaxHealth = playerStats.maxHealth + levelUp.statIncreases.maxHealth;
    $set.level = levelUp.newLevel;
    $set.experience = 0;
    $set.maxHealth = newMaxHealth;
    $set.currentHealth = newMaxHealth + equipmentMaxHpBonus;
    $set.baseDamage = playerStats.baseDamage + levelUp.statIncreases.baseDamage;
  } else {
    $inc.experience = rewards.xp;
  }

  return { $inc, $set };
}

export interface DefeatInput {
  coins: number;
  stats: Pick<PlayerStats['stats'], 'battlesWonStreaks'>;
  biome: BiomeId;
  tier: Tier;
}

export function buildDefeatStatMutation(input: DefeatInput): { goldLost: number; update: Record<string, unknown> } {
  const { goldLost } = calcDeathPenalty(input.coins);
  const streaks = structuredClone(input.stats.battlesWonStreaks ?? initializeStreaks());
  const updatedStreaks = resetStreakForZone(streaks, input.biome, input.tier);

  const $set: Record<string, unknown> = {
    'stats.battlesWonStreak': 0,
    'stats.battlesWonStreaks': updatedStreaks,
  };
  const update: Record<string, unknown> = { $set };
  if (goldLost > 0) update.$inc = { coins: -goldLost };

  return { goldLost, update };
}
