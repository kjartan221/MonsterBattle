import type { MonsterTemplate } from '../monster-table';

/**
 * FOREST BIOME MONSTERS
 *
 * Tier 1 Common: Forest Wolf, Bandit Raccoon
 * Tier 1 Rare: Wild Boar, Forest Sprite
 * Tier 2 Epic Boss: Treant Guardian
 */
export const FOREST_MONSTERS: MonsterTemplate[] = [
  // Forest Tier 1 - Common Monsters
  {
    name: 'Forest Wolf',
    imageUrl: '🐺',
    rarity: 'common',
    baseClicksRange: [25, 30], // 60 HP ÷ 2 damage = 30 clicks
    baseAttackDamage: 2, // 2 HP/sec
    biomes: ['forest'],
    moveInterval: 1500 // Medium speed - standard predator
  },
  {
    name: 'Bandit Raccoon',
    imageUrl: '🦝',
    rarity: 'common',
    baseClicksRange: [23, 28], // 55 HP ÷ 2 damage = 27.5 clicks
    baseAttackDamage: 2, // 2 HP/sec, fast enemy (10% dodge)
    biomes: ['forest'],
    moveInterval: 1000 // Fast - agile, dodgy enemy
  },

  // Forest Tier 1 - Rare Monsters
  {
    name: 'Wild Boar',
    imageUrl: '🐗',
    rarity: 'rare',
    baseClicksRange: [35, 40], // 90 HP ÷ 2.5 damage = 36 clicks
    baseAttackDamage: 3, // 3 HP/sec, armored (high HP), charge attack
    biomes: ['forest'],
    moveInterval: 2000, // Slow - heavy, armored tank
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
    biomes: ['forest'],
    moveInterval: 1000 // Fast - flying, agile creature
  },

  // Forest Tier 2 - Epic Boss
  {
    name: 'Treant Guardian',
    imageUrl: '🌳',
    rarity: 'epic',
    baseClicksRange: [45, 50], // Base 48 HP → 96 HP at T2 (2x multiplier)
    baseAttackDamage: 4, // 4 HP/sec
    biomes: ['forest'],
    moveInterval: 2500, // Very slow - large boss, easier to hit
    isBoss: true,
    bossPhases: [
      {
        phaseNumber: 2,
        hpThreshold: 50, // Divides HP: Phase 1 = 100%→50% (48 HP), Phase 2 = 50%→0% (48 HP)
        invulnerabilityDuration: 2000, // 2 seconds
        specialAttacks: [
          {
            type: 'heal',
            healing: 15, // Heal 15 HP on phase transition
            cooldown: 0, // Phase transition attacks don't need cooldown, but type requires it
            visualEffect: 'green',
            message: '🌿 The Treant Guardian channels nature\'s healing!'
          },
          {
            type: 'summon',
            cooldown: 0, // Phase transition attacks don't need cooldown, but type requires it
            summons: {
              count: 2,
              creature: {
                name: 'Forest Sprite',
                hpPercent: 15, // 15% of boss max HP (14 HP at T2)
                attackDamage: 2, // 2 HP/sec per sprite (4 total)
                imageUrl: '🧚'
              }
            },
            visualEffect: 'green',
            message: '🌳 The Treant summons Forest Sprites to aid in battle!'
          }
        ]
      }
    ]
  }
];
