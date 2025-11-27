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
  },
  {
    name: 'Dragon',
    imageUrl: '🐉',
    rarity: 'epic',
    baseClicksRange: [30, 40],
    baseAttackDamage: 8,
    biomes: ['forest', 'desert', 'ocean', 'volcano', 'castle'], // Can appear anywhere, scales with biome tier
    moveInterval: 2500, // Very slow - large flying creature, easier to hit
    isBoss: true, // Mini-boss with special attacks
    specialAttacks: [
      {
        type: 'fireball',
        damage: 18,
        cooldown: 12,
        visualEffect: 'orange',
        message: '🔥 The Dragon unleashes a blazing fireball!'
      },
      {
        type: 'lightning',
        damage: 15,
        cooldown: 15,
        visualEffect: 'blue',
        message: '⚡ The Dragon calls down lightning from the sky!'
      }
    ]
  },
  {
    name: 'Vampire',
    imageUrl: '🧛',
    rarity: 'epic',
    baseClicksRange: [25, 35],
    baseAttackDamage: 7,
    biomes: ['forest', 'desert', 'ocean', 'volcano', 'castle'], // Can appear anywhere, scales with biome tier
    moveInterval: 1000, // Fast - supernatural speed
    isBoss: true, // Mini-boss with special attacks
    dotEffect: {
      type: 'bleed',
      damageType: 'percentage',
      damageAmount: 3, // 3% max HP bleed
      tickInterval: 1000,
      duration: 6000,
      applyChance: 60 // 60% chance to apply bleed on attack
    },
    specialAttacks: [
      {
        type: 'heal',
        healing: 20,
        cooldown: 18,
        visualEffect: 'red',
        message: '🩸 The Vampire drains your life force!'
      }
    ]
  },
  {
    name: 'Demon',
    imageUrl: '😈',
    rarity: 'legendary',
    baseClicksRange: [50, 70],
    baseAttackDamage: 12,
    biomes: ['forest', 'desert', 'ocean', 'volcano', 'castle'], // Can appear anywhere, scales with biome tier
    moveInterval: 1500, // Medium speed - powerful but trackable
    isBoss: true, // Full boss with phase system
    dotEffect: {
      type: 'burn',
      damageType: 'percentage',
      damageAmount: 4, // 4% max HP burn
      tickInterval: 1000,
      duration: 5000,
      applyChance: 75 // 75% chance to apply hellfire burn
    },
    specialAttacks: [
      {
        type: 'fireball',
        damage: 25,
        cooldown: 10,
        visualEffect: 'purple',
        message: '🔥 The Demon hurls infernal hellfire!'
      },
      {
        type: 'meteor',
        damage: 35,
        cooldown: 20,
        visualEffect: 'red',
        message: '☄️ The Demon summons a meteor strike!'
      }
    ],
    bossPhases: [
      {
        phaseNumber: 2,
        hpThreshold: 50, // Triggers at 50% HP
        invulnerabilityDuration: 2000,
        message: '😈 The Demon enters a furious rage!',
        specialAttacks: [
          {
            type: 'heal',
            healing: 25,
            cooldown: 0,
            visualEffect: 'purple',
            message: '💀 The Demon absorbs souls to restore health!'
          },
          {
            type: 'summon',
            cooldown: 0,
            message: '👹 The Demon summons Lesser Demons!',
            summons: {
              count: 2,
              creature: {
                name: 'Lesser Demon',
                hpPercent: 12, // 12% of boss max HP
                attackDamage: 3,
                imageUrl: '👿'
              }
            }
          }
        ]
      }
    ]
  }
];
