import type { MonsterTemplate } from '../monster-table';

/**
 * FOREST BIOME MONSTERS
 *
 * Tier 1 Common: Forest Wolf, Bandit Raccoon
 * Tier 1 Rare: Wild Boar, Forest Sprite
 * Tier 2+ Epic Boss: Treant Guardian
 * Tier 1+ Epic Mini-Boss: Dire Wolf Alpha
 * Tier 3+ Legendary Boss: Ancient Ent
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

  // Forest Tier 2+ - Epic Boss
  {
    name: 'Treant Guardian',
    imageUrl: '🌳',
    rarity: 'epic',
    baseClicksRange: [45, 50], // Base 48 HP → 96 HP at T2, 192 HP at T3, 720 HP at T5
    baseAttackDamage: 4, // 4 HP/sec → 8 HP/sec at T2, 60 HP/sec at T5
    biomes: ['forest'],
    moveInterval: 2500, // Very slow - large boss, easier to hit
    isBoss: true,
    minTier: 1, // Available from Tier 1 onwards
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
  },

  // Forest Tier 1+ - Epic Mini-Boss
  {
    name: 'Dire Wolf Alpha',
    imageUrl: '🐺',
    rarity: 'epic',
    baseClicksRange: [42, 47], // 120 HP ÷ 2.5 damage = 48 clicks
    baseAttackDamage: 5, // 5 HP/sec → 10 HP/sec at T2, 75 HP/sec at T5
    biomes: ['forest'],
    moveInterval: 800, // Very fast - alpha predator
    isBoss: true,
    minTier: 1, // Available from Tier 1 onwards
    enrageTimer: 75, // Enrages after 75 seconds
    enrageDamageMultiplier: 1.6, // +60% damage when enraged
    specialAttacks: [
      {
        type: 'lightning',
        damage: 12, // Pack howl - coordinated attack
        cooldown: 8, // 8 seconds between attacks
        minTier: 1,
        visualEffect: 'white',
        message: '🐺 The Dire Wolf Alpha calls the pack for a coordinated strike!'
      },
      {
        type: 'meteor',
        damage: 18, // Savage pounce
        cooldown: 12, // 12 seconds between pounces
        minTier: 2, // Unlocked at T2+
        visualEffect: 'red',
        message: '🐺 The Alpha pounces with savage fury!'
      }
    ]
  },

  // Forest Tier 3+ - Legendary Boss
  {
    name: 'Ancient Ent',
    imageUrl: '🌲',
    rarity: 'legendary',
    baseClicksRange: [58, 63], // Base 60 HP → 240 HP at T3, 900 HP at T5
    baseAttackDamage: 7, // 7 HP/sec → 28 HP/sec at T3, 105 HP/sec at T5
    biomes: ['forest'],
    moveInterval: 3200, // Extremely slow - ancient, massive tree
    isBoss: true,
    minTier: 3, // Available from Tier 3 onwards
    enrageTimer: 90, // Enrages after 90 seconds
    enrageDamageMultiplier: 1.8, // +80% damage when enraged
    bossPhases: [
      {
        phaseNumber: 3,
        hpThreshold: 66, // Phase 1: 100%→66%, Phase 2: 66%→33%, Phase 3: 33%→0%
        invulnerabilityDuration: 2500,
        specialAttacks: [
          {
            type: 'lightning',
            damage: 15, // Root eruption
            cooldown: 0,
            visualEffect: 'green',
            message: '🌲 The Ancient Ent\'s roots erupt from the ground!'
          }
        ]
      },
      {
        phaseNumber: 2,
        hpThreshold: 33,
        invulnerabilityDuration: 3000,
        specialAttacks: [
          {
            type: 'heal',
            healing: 20, // Ancient regeneration
            cooldown: 0,
            visualEffect: 'green',
            message: '🌿 The Ancient Ent channels millennium of life force!'
          },
          {
            type: 'summon',
            cooldown: 0,
            summons: {
              count: 3,
              creature: {
                name: 'Treant Sapling',
                hpPercent: 10, // 10% of boss max HP each
                attackDamage: 3,
                imageUrl: '🌳'
              }
            },
            visualEffect: 'green',
            message: '🌲 The Ancient Ent awakens its saplings!'
          }
        ]
      }
    ],
    specialAttacks: [
      {
        type: 'meteor',
        damage: 40, // Falling timber (increased from 25 - avoidable)
        cooldown: 15, // 15 seconds
        minTier: 3,
        visualEffect: 'brown',
        message: '🪵 The Ancient Ent hurls massive timber!',
        interactive: true, // Spawns clickable falling timber
        objectHpPercent: 30, // 30% of boss max HP (very tanky for legendary)
        impactDelay: 9, // 9 seconds to destroy it
        imageUrl: '🪵' // Timber/log icon
      }
    ]
  }
];
