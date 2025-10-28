/**
 * Biome and Tier Configuration System
 *
 * Phase 1.3 Implementation:
 * - 2 biomes: Forest (T1-T2), Desert (T1)
 * - Circular unlock progression
 * - Tier scaling multipliers
 */

export type BiomeId = 'forest' | 'desert' | 'ocean' | 'volcano' | 'castle';
export type Tier = 1 | 2 | 3 | 4 | 5;

// Tier multipliers for monster stats
export const TIER_MULTIPLIERS: Record<Tier, number> = {
  1: 1.0,   // Base stats
  2: 2.0,   // 2x stats
  3: 4.0,   // 4x stats
  4: 8.0,   // 8x stats
  5: 15.0   // 15x stats (boss tier)
};

// Biome configuration
export interface BiomeConfig {
  id: BiomeId;
  name: string;
  icon: string;
  description: string;
  theme: string;
  maxTier: Tier | 0; // Maximum tier currently available for this biome (0 = not implemented)
  monsters: string[]; // Monster names that appear in this biome
}

// Phase 1.3: Starting with 2 biomes
export const BIOMES: Record<BiomeId, BiomeConfig> = {
  forest: {
    id: 'forest',
    name: 'Verdant Forest',
    icon: '🌲',
    description: 'Nature, wildlife, basic enemies',
    theme: 'A lush green forest filled with wild creatures',
    maxTier: 2, // Forest goes up to Tier 2 in Phase 1.3
    monsters: ['Goblin', 'Zombie', 'Troll'] // 3 monsters for forest
  },
  desert: {
    id: 'desert',
    name: 'Scorched Desert',
    icon: '🏜️',
    description: 'Fire, sand, heat',
    theme: 'A barren wasteland of burning sands',
    maxTier: 1, // Desert only Tier 1 in Phase 1.3
    monsters: ['Orc', 'Ghost'] // 2 monsters for desert
  },
  // Future biomes (locked in Phase 1.3)
  ocean: {
    id: 'ocean',
    name: 'Sunken Ocean',
    icon: '🌊',
    description: 'Water, sea creatures, ice',
    theme: 'The depths of a mysterious ocean',
    maxTier: 0, // Not implemented yet
    monsters: []
  },
  volcano: {
    id: 'volcano',
    name: 'Volcanic Wasteland',
    icon: '🌋',
    description: 'Lava, demons, destruction',
    theme: 'A hellish landscape of fire and ash',
    maxTier: 0, // Not implemented yet
    monsters: []
  },
  castle: {
    id: 'castle',
    name: 'Dark Castle',
    icon: '👑',
    description: 'Undead, dark magic, final challenges',
    theme: 'A cursed fortress shrouded in darkness',
    maxTier: 0, // Not implemented yet
    monsters: []
  }
};

// Unlock progression order (circular)
export const BIOME_UNLOCK_ORDER: BiomeId[] = [
  'forest',  // Tier 1 - starting biome
  'desert',  // Tier 1 - unlocked after Forest T1
  'ocean',   // Future
  'volcano', // Future
  'castle'   // Future
];

/**
 * Get the biome ID that unlocks after completing a given biome/tier
 *
 * Circular progression:
 * - Forest T1 → Desert T1
 * - Desert T1 → Forest T2
 * - Forest T2 → Desert T2 (when implemented)
 */
export function getNextUnlock(currentBiome: BiomeId, currentTier: Tier): { biome: BiomeId; tier: Tier } | null {
  const currentIndex = BIOME_UNLOCK_ORDER.indexOf(currentBiome);
  const nextIndex = (currentIndex + 1) % BIOME_UNLOCK_ORDER.length;
  const nextBiome = BIOME_UNLOCK_ORDER[nextIndex];

  // If we've completed the circle, move to next tier
  if (nextIndex === 0) {
    const nextTier = (currentTier + 1) as Tier;
    if (nextTier > 5) return null; // Max tier reached
    return { biome: BIOME_UNLOCK_ORDER[0], tier: nextTier };
  }

  // Otherwise, unlock next biome at same tier
  return { biome: nextBiome, tier: currentTier };
}

/**
 * Check if a biome/tier combination is implemented
 */
export function isBiomeTierAvailable(biome: BiomeId, tier: Tier): boolean {
  const biomeConfig = BIOMES[biome];
  return tier <= biomeConfig.maxTier;
}

/**
 * Get all currently available biome/tier combinations
 * For Phase 1.3: Forest T1-T2, Desert T1
 */
export function getAvailableBiomeTiers(): Array<{ biome: BiomeId; tier: Tier }> {
  const available: Array<{ biome: BiomeId; tier: Tier }> = [];

  for (const [biomeId, config] of Object.entries(BIOMES)) {
    for (let tier = 1; tier <= config.maxTier; tier++) {
      available.push({ biome: biomeId as BiomeId, tier: tier as Tier });
    }
  }

  return available;
}

/**
 * Format biome/tier as a string key for storage
 * Example: "forest-1", "desert-2"
 */
export function formatBiomeTierKey(biome: BiomeId, tier: Tier): string {
  return `${biome}-${tier}`;
}

/**
 * Parse a biome/tier key back into components
 * Example: "forest-1" → { biome: "forest", tier: 1 }
 */
export function parseBiomeTierKey(key: string): { biome: BiomeId; tier: Tier } | null {
  const parts = key.split('-');
  if (parts.length !== 2) return null;

  const biome = parts[0] as BiomeId;
  const tier = parseInt(parts[1], 10) as Tier;

  if (!BIOMES[biome] || tier < 1 || tier > 5) return null;

  return { biome, tier };
}

/**
 * Calculate monster stats with tier scaling
 */
export function applyTierScaling(baseStat: number, tier: Tier): number {
  return Math.floor(baseStat * TIER_MULTIPLIERS[tier]);
}

/**
 * Get display name for a biome/tier combination
 * Example: "Verdant Forest - Tier 1"
 */
export function getBiomeTierDisplayName(biome: BiomeId, tier: Tier): string {
  return `${BIOMES[biome].name} - Tier ${tier}`;
}
