import { BiomeId, Tier, applyTierScaling, BIOMES } from './biome-config';

// Monster Definition Template (BASE stats, before tier scaling)
export interface MonsterTemplate {
  name: string;
  imageUrl: string; // Emoji icon
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  baseClicksRange: [number, number]; // BASE clicks required (will be scaled by tier)
  baseAttackDamage: number; // BASE damage per second (will be scaled by tier)
  biomes: BiomeId[]; // Which biomes this monster can appear in
}

// Monster Templates - BASE stats for each monster type
// These will be multiplied by tier multipliers (1x, 2x, 4x, 8x, 15x)
export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  // FOREST MONSTERS
  {
    name: 'Goblin',
    imageUrl: '👺',
    rarity: 'common',
    baseClicksRange: [5, 10],
    baseAttackDamage: 2,
    biomes: ['forest']
  },
  {
    name: 'Zombie',
    imageUrl: '🧟‍♂️',
    rarity: 'common',
    baseClicksRange: [6, 11],
    baseAttackDamage: 2,
    biomes: ['forest']
  },
  {
    name: 'Troll',
    imageUrl: '🧟',
    rarity: 'rare',
    baseClicksRange: [15, 20],
    baseAttackDamage: 5,
    biomes: ['forest']
  },

  // DESERT MONSTERS
  {
    name: 'Orc',
    imageUrl: '👹',
    rarity: 'common',
    baseClicksRange: [8, 12],
    baseAttackDamage: 3,
    biomes: ['desert']
  },
  {
    name: 'Ghost',
    imageUrl: '👻',
    rarity: 'rare',
    baseClicksRange: [12, 18],
    baseAttackDamage: 4,
    biomes: ['desert']
  },

  // FUTURE MONSTERS (currently unused)
  {
    name: 'Dragon',
    imageUrl: '🐉',
    rarity: 'epic',
    baseClicksRange: [25, 35],
    baseAttackDamage: 8,
    biomes: ['volcano'] // Future biome
  },
  {
    name: 'Vampire',
    imageUrl: '🧛',
    rarity: 'epic',
    baseClicksRange: [20, 30],
    baseAttackDamage: 7,
    biomes: ['castle'] // Future biome
  },
  {
    name: 'Demon',
    imageUrl: '😈',
    rarity: 'legendary',
    baseClicksRange: [40, 50],
    baseAttackDamage: 12,
    biomes: ['volcano'] // Future biome
  },
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
