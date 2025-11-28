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

// Tier multipliers for monster damage (moderate scaling)
export const TIER_DAMAGE_MULTIPLIERS: Record<Tier, number> = {
  1: 1.0,   // Base damage
  2: 2.0,   // 2x damage
  3: 4.0,   // 4x damage
  4: 7.0,   // 8x damage
  5: 12.0   // 15x damage (boss tier)
};

// Tier multipliers for monster HP (aggressive scaling like rewards)
export const TIER_HP_MULTIPLIERS: Record<Tier, number> = {
  1: 1.0,   // Base HP
  2: 3.0,   // 3x HP (increased from 3x)
  3: 10.0,  // 10x HP (increased from 8x)
  4: 30.0,  // 30x HP (increased from 20x)
  5: 80.0   // 80x HP - boss tier (increased from 50x for harder endgame)
};

// Legacy: Keep for backwards compatibility, defaults to damage scaling
export const TIER_MULTIPLIERS = TIER_DAMAGE_MULTIPLIERS;

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
    maxTier: 5, // Forest goes up to Tier 5 in Phase 2.4
    monsters: ['Goblin', 'Zombie', 'Troll'] // 3 monsters for forest
  },
  desert: {
    id: 'desert',
    name: 'Scorched Desert',
    icon: '🏜️',
    description: 'Fire, sand, heat',
    theme: 'A barren wasteland of burning sands',
    maxTier: 5, // Desert goes up to Tier 5 in Phase 2.4
    monsters: ['Orc', 'Ghost'] // 2 monsters for desert
  },
  // Phase 2.4: New biomes implemented
  ocean: {
    id: 'ocean',
    name: 'Sunken Ocean',
    icon: '🌊',
    description: 'Water, sea creatures, ice',
    theme: 'The depths of a mysterious ocean',
    maxTier: 5, // All tiers available
    monsters: ['Coral Crab', 'Giant Jellyfish', 'Frost Shark', 'Electric Eel', 'Sea Serpent', 'Leviathan']
  },
  volcano: {
    id: 'volcano',
    name: 'Volcanic Wasteland',
    icon: '🌋',
    description: 'Lava, demons, destruction',
    theme: 'A hellish landscape of fire and ash',
    maxTier: 5, // All tiers available
    monsters: ['Lava Salamander', 'Fire Bat', 'Magma Golem', 'Inferno Imp', 'Fire Drake', 'Ancient Dragon']
  },
  castle: {
    id: 'castle',
    name: 'Dark Castle',
    icon: '👑',
    description: 'Undead, dark magic, final challenges',
    theme: 'A cursed fortress shrouded in darkness',
    maxTier: 5, // All tiers available
    monsters: ['Skeleton Warrior', 'Cursed Spirit', 'Vampire Lord', 'Death Knight', 'Necromancer', 'Lich King']
  }
};

// Unlock progression order (circular)
export const BIOME_UNLOCK_ORDER: BiomeId[] = [
  'forest',  // Tier 1 - starting biome
  'desert',  // Tier 1 - unlocked after Forest T1
  'ocean',   // Tier 1 - unlocked after Desert T1
  'volcano', // Tier 1 - unlocked after Ocean T1
  'castle'   // Tier 1 - unlocked after Volcano T1
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
 * For Phase 2.4: Forest T1-T5, Desert T1-T5, Ocean T1-T5, Volcano T1-T5, Castle T1-T5
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
 * Calculate monster HP with tier scaling (aggressive scaling)
 */
export function applyTierHPScaling(baseHP: number, tier: Tier): number {
  return Math.floor(baseHP * TIER_HP_MULTIPLIERS[tier]);
}

/**
 * Calculate monster damage with tier scaling (moderate scaling)
 */
export function applyTierDamageScaling(baseDamage: number, tier: Tier): number {
  return Math.floor(baseDamage * TIER_DAMAGE_MULTIPLIERS[tier]);
}

/**
 * Calculate monster stats with tier scaling (legacy, uses damage scaling)
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
