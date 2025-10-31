import { BiomeId, Tier, applyTierScaling, BIOMES } from './biome-config';
import type { DebuffEffect, SpecialAttack, BossPhase } from './types';
import {
  FOREST_MONSTERS,
  DESERT_MONSTERS,
  LEGACY_MONSTERS,
  FUTURE_MONSTERS
} from './monsters';

// Monster Definition Template (BASE stats, before tier scaling)
export interface MonsterTemplate {
  name: string;
  imageUrl: string; // Emoji icon
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  baseClicksRange: [number, number]; // BASE clicks required (will be scaled by tier)
  baseAttackDamage: number; // BASE damage per second (will be scaled by tier)
  biomes: BiomeId[]; // Which biomes this monster can appear in
  dotEffect?: DebuffEffect; // Optional DoT effect applied on attack
  isBoss?: boolean; // True for boss monsters (no buffs except Tier 5, enables phase system)

  // SPECIAL ATTACKS (Monster-level):
  // - Repeating attacks based on cooldown throughout the entire battle
  // - Example: Sand Djinn fireball every 5 seconds
  // - Handled by useSpecialAttacks hook (cooldown-based, always active)
  specialAttacks?: SpecialAttack[];

  // BOSS PHASE SYSTEM:
  // - Stacked HP bars: hpThreshold divides HP into separate phase bars (100% → 50% → 0%)
  // - Phase triggers when phase HP bar reaches 0 (not percentage-based)
  // - Excess damage ignored at phase boundaries (like shields)
  // - Badge shows phases remaining (x2 → x1 → no badge for last phase)
  // - Each BossPhase has its own specialAttacks (see below)
  bossPhases?: BossPhase[];
  // SPECIAL ATTACKS (Phase-level, nested in BossPhase):
  // - Only trigger during phase transitions (when phase HP reaches 0)
  // - Execute once per transition (or based on cooldown if specified)
  // - Example: Treant heal + summon when entering Phase 2
  // - Handled in MonsterBattleSection phase transition logic
}

// Monster Templates - BASE stats for each monster type (Tier 1)
// These will be multiplied by tier multipliers (1x, 2x, 4x, 8x, 15x)
// Click calculations assume player starting damage ~2-3 (base 1 + weapon 1-2)
//
// Monster data is organized in separate files by biome:
// - lib/monsters/forest.ts - Forest biome monsters
// - lib/monsters/desert.ts - Desert biome monsters
// - lib/monsters/legacy.ts - Legacy monsters (deprecated)
// - lib/monsters/future.ts - Future monsters (not yet implemented)
export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  ...FOREST_MONSTERS,
  ...DESERT_MONSTERS,
  ...LEGACY_MONSTERS,
  ...FUTURE_MONSTERS
];

// Rarity weights for random selection
export const RARITY_WEIGHTS = {
  common: 60,    // 60% chance
  rare: 25,      // 25% chance
  epic: 12,      // 12% chance
  legendary: 3   // 3% chance
};

/**
 * Get monsters available in a specific biome
 */
export function getMonstersForBiome(biome: BiomeId): MonsterTemplate[] {
  return MONSTER_TEMPLATES.filter(m => m.biomes.includes(biome));
}

/**
 * Get a random monster template for a specific biome, based on rarity weights
 */
export function getRandomMonsterTemplateForBiome(biome: BiomeId): MonsterTemplate {
  const availableMonsters = getMonstersForBiome(biome);

  if (availableMonsters.length === 0) {
    throw new Error(`No monsters available for biome: ${biome}`);
  }

  // Use rarity weights
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  let selectedRarity: keyof typeof RARITY_WEIGHTS = 'common';
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      selectedRarity = rarity as keyof typeof RARITY_WEIGHTS;
      break;
    }
  }

  // Filter by selected rarity
  const monstersOfRarity = availableMonsters.filter(m => m.rarity === selectedRarity);

  // If no monsters of that rarity, fall back to any available monster
  if (monstersOfRarity.length === 0) {
    return availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
  }

  return monstersOfRarity[Math.floor(Math.random() * monstersOfRarity.length)];
}

/**
 * Get random clicks required within a range, scaled by tier
 */
export function getRandomClicksRequired(range: [number, number], tier: Tier): number {
  const baseClicks = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  return applyTierScaling(baseClicks, tier);
}

/**
 * Get scaled attack damage for a tier
 */
export function getScaledAttackDamage(baseAttackDamage: number, tier: Tier): number {
  return applyTierScaling(baseAttackDamage, tier);
}

/**
 * Get monster template by name
 */
export function getMonsterTemplateByName(name: string): MonsterTemplate | undefined {
  return MONSTER_TEMPLATES.find(m => m.name === name);
}

/**
 * DEPRECATED: Use getRandomMonsterTemplateForBiome instead
 * Get a random monster template based on rarity weights (biome-agnostic)
 */
export function getRandomMonsterTemplate(): MonsterTemplate {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  let selectedRarity: keyof typeof RARITY_WEIGHTS = 'common';
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      selectedRarity = rarity as keyof typeof RARITY_WEIGHTS;
      break;
    }
  }

  // Filter monsters by selected rarity
  const monstersOfRarity = MONSTER_TEMPLATES.filter(m => m.rarity === selectedRarity);
  return monstersOfRarity[Math.floor(Math.random() * monstersOfRarity.length)];
}
