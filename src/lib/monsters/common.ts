import type { MonsterTemplate } from '../monster-table';

/**
 * COMMON MONSTERS (Cross-Biome Scaling)
 *
 * These monsters can appear in ANY biome and scale with the biome's tier.
 * A Ghost in Forest Tier 1 is much weaker than a Ghost in Castle Tier 5.
 *
 * Biome Progression: Forest → Desert → Ocean → Volcano → Castle
 * Tier Scaling: 1x → 2x → 4x → 8x → 15x
 *
 * These are "wandering" monsters that provide variety across all zones.
 */
export const COMMON_MONSTERS: MonsterTemplate[] = [
  {
    name: 'Goblin',
    imageUrl: '👺',
    rarity: 'common',
    baseClicksRange: [5, 10],
    baseAttackDamage: 2,
    biomes: ['forest', 'desert', 'ocean', 'volcano', 'castle'], // Can appear anywhere, scales with biome tier
    moveInterval: 1500 // Medium speed - standard enemy
  },
  {
    name: 'Zombie',
    imageUrl: '🧟‍♂️',
    rarity: 'common',
    baseClicksRange: [6, 11],
    baseAttackDamage: 2,
    biomes: ['forest', 'desert', 'ocean', 'volcano', 'castle'], // Can appear anywhere, scales with biome tier
    moveInterval: 2000 // Slow - shambling undead
  },
  {
    name: 'Troll',
    imageUrl: '🧟',
    rarity: 'rare',
    baseClicksRange: [15, 20],
    baseAttackDamage: 5,
    biomes: ['forest', 'desert', 'ocean', 'volcano', 'castle'], // Can appear anywhere, scales with biome tier
    moveInterval: 2000 // Slow - large, heavy brute
  },
  {
    name: 'Orc',
    imageUrl: '👹',
    rarity: 'common',
    baseClicksRange: [8, 12],
    baseAttackDamage: 3,
    biomes: ['forest', 'desert', 'ocean', 'volcano', 'castle'], // Can appear anywhere, scales with biome tier
    moveInterval: 1500 // Medium speed - warrior type
  },
  {
    name: 'Ghost',
    imageUrl: '👻',
    rarity: 'rare',
    baseClicksRange: [12, 18],
    baseAttackDamage: 4,
    biomes: ['forest', 'desert', 'ocean', 'volcano', 'castle'], // Can appear anywhere, scales with biome tier
    moveInterval: 1000 // Fast - ethereal, hard to pin down
  }
];
