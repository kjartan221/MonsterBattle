import { BiomeId, Tier, applyTierScaling, BIOMES } from './biome-config';
import type { DebuffEffect, SpecialAttack, BossPhase } from './types';

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
export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  // ===== FOREST BIOME =====

  // Forest Tier 1 - Common Monsters
  {
    name: 'Forest Wolf',
    imageUrl: '🐺',
    rarity: 'common',
    baseClicksRange: [25, 30], // 60 HP ÷ 2 damage = 30 clicks
    baseAttackDamage: 2, // 2 HP/sec
    biomes: ['forest']
  },
  {
    name: 'Bandit Raccoon',
    imageUrl: '🦝',
    rarity: 'common',
    baseClicksRange: [23, 28], // 55 HP ÷ 2 damage = 27.5 clicks
    baseAttackDamage: 2, // 2 HP/sec, fast enemy (10% dodge)
    biomes: ['forest']
  },

  // Forest Tier 1 - Rare Monsters
  {
    name: 'Wild Boar',
    imageUrl: '🐗',
    rarity: 'rare',
    baseClicksRange: [35, 40], // 90 HP ÷ 2.5 damage = 36 clicks
    baseAttackDamage: 3, // 3 HP/sec, armored (high HP), charge attack
    biomes: ['forest'],
    dotEffect: {
      type: 'bleed',
      damageType: 'percentage',
      damageAmount: 1.5, // 1.5% max HP per second
      tickInterval: 1000,
      duration: 6000, // 6 seconds
      applyChance: 30 // 30% chance to cause bleed on charge
    }
  },
  {
    name: 'Forest Sprite',
    imageUrl: '🧚',
    rarity: 'rare',
    baseClicksRange: [30, 35], // 70 HP ÷ 2.5 damage = 28 clicks (but 20% dodge)
    baseAttackDamage: 2, // 2 HP/sec, flying (20% dodge), heals at 50% HP
    biomes: ['forest']
  },

  // Forest Tier 2 - Epic Boss
  {
    name: 'Treant Guardian',
    imageUrl: '🌳',
    rarity: 'epic',
    baseClicksRange: [45, 50], // Base 48 HP → 96 HP at T2 (2x multiplier)
    baseAttackDamage: 4, // 4 HP/sec
    biomes: ['forest'],
    isBoss: true,
    bossPhases: [
      {
        phaseNumber: 2,
        hpThreshold: 50, // Divides HP: Phase 1 = 100%→50% (48 HP), Phase 2 = 50%→0% (48 HP)
        invulnerabilityDuration: 2000, // 2 seconds
        specialAttacks: [
          {
            type: 'heal',
            healing: 15, // Heals 15 HP (~31% of phase HP at T2)
            cooldown: 0,
            visualEffect: 'green',
            message: '🌿 The Treant Guardian draws strength from the forest!'
          },
          {
            type: 'summon',
            cooldown: 0,
            visualEffect: 'purple',
            message: '✨ The Treant Guardian summons Forest Sprites to aid in battle!',
            summons: {
              count: 2,
              creature: {
                name: 'Forest Sprite',
                hpPercent: 25, // 25% of boss max HP (~35 HP at T2)
                attackDamage: 2, // 2 HP/sec each (4 HP/sec total)
                imageUrl: '🧚'
              }
            }
          }
        ],
        message: '🌳 The Treant Guardian enters a defensive stance!'
      }
    ]
  },

  // ===== DESERT BIOME =====

  // Desert Tier 1 - Common Monsters
  {
    name: 'Sand Scorpion',
    imageUrl: '🦂',
    rarity: 'common',
    baseClicksRange: [28, 32], // 70 HP ÷ 2.5 damage = 28 clicks
    baseAttackDamage: 3, // 3 HP/sec + poison
    biomes: ['desert'],
    dotEffect: {
      type: 'poison',
      damageType: 'percentage',
      damageAmount: 2, // 2% max HP per second
      tickInterval: 1000,
      duration: 5000, // 5 seconds
      applyChance: 50 // 50% chance to poison on hit
    }
  },
  {
    name: 'Desert Viper',
    imageUrl: '🐍',
    rarity: 'common',
    baseClicksRange: [25, 30], // 60 HP ÷ 2 damage = 30 clicks (time limit: 25s)
    baseAttackDamage: 4, // 4 HP/sec, fast (escapes after 25s)
    biomes: ['desert']
  },

  // Desert Tier 1 - Rare Monster
  {
    name: 'Fire Elemental',
    imageUrl: '🔥',
    rarity: 'rare',
    baseClicksRange: [35, 40], // 100 HP ÷ 3 damage = 33 clicks
    baseAttackDamage: 3, // 3 HP/sec + burn
    biomes: ['desert'],
    dotEffect: {
      type: 'burn',
      damageType: 'percentage',
      damageAmount: 3, // 3% max HP per second
      tickInterval: 1000,
      duration: 4000, // 4 seconds
      applyChance: 75 // 75% chance to burn on hit
    }
  },

  // Desert Tier 1 - Epic Mini-Boss
  {
    name: 'Sand Djinn',
    imageUrl: '🧞',
    rarity: 'epic',
    baseClicksRange: [40, 45], // 120 HP + 40 HP shield = 160 total ÷ 3.5 damage
    baseAttackDamage: 4, // 4 HP/sec, shield mechanic, sandstorm blind
    biomes: ['desert'],
    isBoss: true, // Mini-Boss: No buffs except Tier 5
    specialAttacks: [
      {
        type: 'fireball',
        damage: 15, // Direct damage to player
        cooldown: 5, // 5 seconds between fireballs
        visualEffect: 'orange',
        message: '🔥 The Sand Djinn hurls a blazing fireball!'
      }
    ]
  },

  // ===== LEGACY MONSTERS (will be deprecated) =====
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

  // ===== FUTURE MONSTERS (not yet implemented) =====
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
