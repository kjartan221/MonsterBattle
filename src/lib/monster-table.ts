import { BiomeId, Tier, applyTierScaling, applyTierHPScaling, applyTierDamageScaling, BIOMES } from './biome-config';
import type { DebuffEffect, SpecialAttack, BossPhase, MonsterBuff } from './types';
import {
  FOREST_MONSTERS,
  DESERT_MONSTERS,
  OCEAN_MONSTERS,
  VOLCANO_MONSTERS,
  CASTLE_MONSTERS,
  COMMON_MONSTERS
} from './monsters';

// Monster Definition Template (BASE stats, before tier scaling)
export interface MonsterTemplate {
  name: string;
  imageUrl: string; // Emoji icon
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  baseClicksRange: [number, number]; // BASE clicks required (will be scaled by tier)
  baseAttackDamage: number; // BASE damage per second (will be scaled by tier)
  biomes: BiomeId[]; // Which biomes this monster can appear in
  moveInterval: number; // Time in milliseconds between position changes (700-3000ms)
  dotEffect?: DebuffEffect; // Optional DoT effect applied on attack
  isBoss?: boolean; // True for boss monsters (no buffs except Tier 5, enables phase system)
  minTier?: number; // Minimum tier this monster can spawn at (default: 1)
  maxTier?: number; // Maximum tier this monster can spawn at (default: 5)

  // INITIAL BUFFS:
  // - Monster-specific buffs that ALWAYS spawn with the monster
  // - Example: Coral Crab's hard shell (30% HP shield)
  // - These DO NOT block random buffs - they stack!
  // - A Coral Crab can have its shell shield AND a random shield buff (2 shields total)
  initialBuffs?: MonsterBuff[];

  // SPECIAL ATTACKS (Monster-level):
  // - Repeating attacks based on cooldown throughout the entire battle
  // - Example: Sand Djinn fireball every 5 seconds
  // - Can be tier-locked using minTier field
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

  // ENRAGE MECHANIC (Boss-only):
  // - Boss becomes enraged after X seconds of combat
  // - Damage multiplier increases (e.g., 1.5 = +50% damage)
  // - Visual indicator shows enraged state (red glow/particles)
  // - Only applies to boss monsters (isBoss: true)
  enrageTimer?: number; // Seconds until enrage (e.g., 60, 90, 120)
  enrageDamageMultiplier?: number; // Damage multiplier when enraged (e.g., 1.5, 2.0)
}

// Monster Templates - BASE stats for each monster type (Tier 1)
// These will be multiplied by tier multipliers (1x, 2x, 4x, 8x, 15x)
// Click calculations assume player starting damage ~2-3 (base 1 + weapon 1-2)
//
// Monster data is organized in separate files by biome:
// - lib/monsters/forest.ts - Forest biome monsters
// - lib/monsters/desert.ts - Desert biome monsters
// - lib/monsters/ocean.ts - Ocean biome monsters (Phase 2.4)
// - lib/monsters/volcano.ts - Volcano biome monsters (Phase 2.4)
// - lib/monsters/castle.ts - Castle biome monsters (Phase 2.4)
// - lib/monsters/common.ts - Common monsters (cross-biome scaling)
export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  ...FOREST_MONSTERS,
  ...DESERT_MONSTERS,
  ...OCEAN_MONSTERS,
  ...VOLCANO_MONSTERS,
  ...CASTLE_MONSTERS,
  ...COMMON_MONSTERS
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
export function getMonstersForBiome(biome: BiomeId, tier?: Tier): MonsterTemplate[] {
  return MONSTER_TEMPLATES.filter(m => {
    // Must be in the biome
    if (!m.biomes.includes(biome)) return false;

    // If tier is specified, check minTier and maxTier
    if (tier !== undefined) {
      const minTier = m.minTier || 1; // Default to tier 1
      const maxTier = m.maxTier || 5; // Default to tier 5
      if (tier < minTier || tier > maxTier) return false;
    }

    return true;
  });
}

/**
 * Get a random monster template for a specific biome and tier, based on rarity weights
 * Biome-specific monsters have 80% spawn chance, cross-biome common monsters have 20%
 */
export function getRandomMonsterTemplateForBiome(biome: BiomeId, tier: Tier, bossSpawnRate: number = 1.0): MonsterTemplate {
  const availableMonsters = getMonstersForBiome(biome, tier);

  if (availableMonsters.length === 0) {
    throw new Error(`No monsters available for biome: ${biome}, tier: ${tier}`);
  }

  // Challenge Mode: 5x Boss Spawn Rate (weighted boss spawns)
  // 20% any monster, 60% epic mini-boss, 20% legendary boss
  if (bossSpawnRate === 5.0) {
    const bossMonsters = availableMonsters.filter(m => m.isBoss);

    if (bossMonsters.length > 0) {
      const epicBosses = bossMonsters.filter(m => m.rarity === 'epic');
      const legendaryBosses = bossMonsters.filter(m => m.rarity === 'legendary');

      // Roll weighted chance: 20% any, 60% epic, 20% legendary
      const roll = Math.random() * 100;

      if (roll < 20) {
        // 20% chance: Any monster (fallback to normal spawn logic)
        console.log(`👹 [CHALLENGE] Boss Spawn Rate 5x: 20% roll - spawning any monster`);
      } else if (roll < 80) {
        // 60% chance: Epic mini-boss
        if (epicBosses.length > 0) {
          const selectedBoss = epicBosses[Math.floor(Math.random() * epicBosses.length)];
          console.log(`👹 [CHALLENGE] Boss Spawn Rate 5x: 60% roll - spawning epic mini-boss: ${selectedBoss.name}`);
          return selectedBoss;
        }
        // Fallback to any boss if no epic bosses
        const selectedBoss = bossMonsters[Math.floor(Math.random() * bossMonsters.length)];
        console.log(`👹 [CHALLENGE] Boss Spawn Rate 5x: 60% roll but no epic bosses - spawning: ${selectedBoss.name}`);
        return selectedBoss;
      } else {
        // 20% chance: Legendary boss
        if (legendaryBosses.length > 0) {
          const selectedBoss = legendaryBosses[Math.floor(Math.random() * legendaryBosses.length)];
          console.log(`👹 [CHALLENGE] Boss Spawn Rate 5x: 20% roll - spawning legendary boss: ${selectedBoss.name}`);
          return selectedBoss;
        }
        // Fallback to any boss if no legendary bosses
        const selectedBoss = bossMonsters[Math.floor(Math.random() * bossMonsters.length)];
        console.log(`👹 [CHALLENGE] Boss Spawn Rate 5x: 20% roll but no legendary bosses - spawning: ${selectedBoss.name}`);
        return selectedBoss;
      }
    }

    // Fallback to normal logic if no bosses available or 20% any-monster roll
    console.log(`👹 [CHALLENGE] Boss Spawn Rate 5x: Using normal spawn logic (20% any-monster or no bosses available)`);
  }

  // Separate biome-specific monsters from cross-biome common monsters
  // Biome-specific = only appears in this biome (biomes array length === 1)
  // Cross-biome = appears in multiple biomes (common.ts monsters)
  const biomeSpecificMonsters = availableMonsters.filter(m => m.biomes.length === 1);
  const crossBiomeMonsters = availableMonsters.filter(m => m.biomes.length > 1);

  // Decide which pool to use: 80% biome-specific, 20% cross-biome
  let monsterPool: MonsterTemplate[];
  if (biomeSpecificMonsters.length > 0 && Math.random() < 0.80) {
    monsterPool = biomeSpecificMonsters;
  } else if (crossBiomeMonsters.length > 0) {
    monsterPool = crossBiomeMonsters;
  } else {
    // Fallback to biome-specific if no cross-biome available
    monsterPool = biomeSpecificMonsters;
  }

  // If somehow we have no monsters in the selected pool, use all available
  if (monsterPool.length === 0) {
    monsterPool = availableMonsters;
  }

  // Use rarity weights on the selected pool
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

  // Filter by selected rarity within the chosen pool
  const monstersOfRarity = monsterPool.filter(m => m.rarity === selectedRarity);

  // If no monsters of that rarity in the pool, fall back to any monster in the pool
  if (monstersOfRarity.length === 0) {
    return monsterPool[Math.floor(Math.random() * monsterPool.length)];
  }

  return monstersOfRarity[Math.floor(Math.random() * monstersOfRarity.length)];
}

/**
 * Get random clicks required within a range, scaled by tier
 * Uses aggressive HP scaling (same as XP rewards)
 */
export function getRandomClicksRequired(range: [number, number], tier: Tier): number {
  const baseClicks = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  return applyTierHPScaling(baseClicks, tier);
}

/**
 * Get scaled attack damage for a tier
 * Uses moderate damage scaling
 */
export function getScaledAttackDamage(baseAttackDamage: number, tier: Tier): number {
  return applyTierDamageScaling(baseAttackDamage, tier);
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
