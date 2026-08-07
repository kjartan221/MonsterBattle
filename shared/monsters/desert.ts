import type { MonsterTemplate } from '../monster-table';

/**
 * DESERT BIOME MONSTERS
 *
 * Tier 1 Common: Sand Scorpion, Desert Viper
 * Tier 1 Rare: Fire Elemental
 * Tier 1+ Epic Mini-Boss: Sand Djinn
 * Tier 2+ Epic Mini-Boss: Sandstone Golem
 * Tier 3+ Legendary Boss: Desert Phoenix
 */
export const DESERT_MONSTERS: MonsterTemplate[] = [
  // Desert Tier 1 - Common Monsters
  {
    name: 'Sand Scorpion',
    imageUrl: '🦂',
    rarity: 'common',
    baseClicksRange: [28, 32], // 70 HP ÷ 2.5 damage = 28 clicks
    baseAttackDamage: 4, // Common: 4-5 damage (balanced with Forest/Common)
    biomes: ['desert'],
    moveInterval: 1500, // Medium speed - standard desert creature
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
    baseAttackDamage: 5, // Common: 4-5 damage (balanced with Forest/Common)
    biomes: ['desert'],
    moveInterval: 700 // Very fast - elite speed, hard to hit
  },

  // Desert Tier 1 - Rare Monster
  {
    name: 'Fire Elemental',
    imageUrl: '🔥',
    rarity: 'rare',
    baseClicksRange: [35, 40], // 100 HP ÷ 3 damage = 33 clicks
    baseAttackDamage: 6, // Rare: 6-7 damage (balanced with Forest/Common)
    biomes: ['desert'],
    moveInterval: 1500, // Medium speed - floating elemental
    dotEffect: {
      type: 'burn',
      damageType: 'percentage',
      damageAmount: 3, // 3% max HP per second
      tickInterval: 1000,
      duration: 4000, // 4 seconds
      applyChance: 75 // 75% chance to burn on hit
    }
  },

  // Desert Tier 2+ - Epic Mini-Boss
  {
    name: 'Sand Djinn',
    imageUrl: '🧞',
    rarity: 'epic',
    baseClicksRange: [40, 45], // 120 HP base → 240 HP at T2, 720 HP at T5
    baseAttackDamage: 10, // Epic: 10 damage (balanced with Forest/Common)
    biomes: ['desert'],
    moveInterval: 2000, // Slow - mini-boss, easier to target
    isBoss: true, // Mini-Boss: No random buffs except Tier 5
    minTier: 1, // Available from Tier 1 onwards
    specialAttacks: [
      {
        type: 'fireball',
        damage: 15, // Direct damage to player
        cooldown: 5, // 5 seconds between fireballs
        minTier: 1, // Basic fireball from T1
        visualEffect: 'orange',
        message: '🔥 The Sand Djinn hurls a blazing fireball!'
      },
      {
        type: 'meteor',
        damage: 32, // Sandstorm explosion (increased from 20 - avoidable)
        cooldown: 10, // 10 seconds between sandstorms
        minTier: 2, // Unlocked at T2+
        visualEffect: 'orange',
        message: '🌪️ The Sand Djinn conjures a devastating sandstorm!',
        interactive: true, // Spawns clickable sandstorm
        objectHpPercent: 20, // 20% of boss max HP
        impactDelay: 7, // 7 seconds to destroy it
        imageUrl: '🌪️' // Sandstorm/tornado icon
      }
    ]
  },

  // Desert Tier 2+ - Epic Mini-Boss
  {
    name: 'Sandstone Golem',
    imageUrl: '🗿',
    rarity: 'epic',
    baseClicksRange: [48, 53], // 140 HP ÷ 2.5 damage = 56 clicks
    baseAttackDamage: 10, // Epic: 10 damage (balanced with Forest/Common)
    biomes: ['desert'],
    moveInterval: 2800, // Very slow - massive stone construct
    isBoss: true,
    minTier: 2, // Available from Tier 2 onwards
    enrageTimer: 80, // Enrages after 80 seconds
    enrageDamageMultiplier: 1.7, // +70% damage when enraged
    bossPhases: [
      {
        phaseNumber: 2,
        hpThreshold: 50, // Phase 1: 100%→50%, Phase 2: 50%→0%
        invulnerabilityDuration: 2000, // 2 seconds
        specialAttacks: [
          {
            type: 'heal',
            healing: 20, // Stone recombination
            cooldown: 0,
            visualEffect: 'brown',
            message: '🗿 The Sandstone Golem recombines its shattered pieces!'
          }
        ]
      }
    ],
    specialAttacks: [
      {
        type: 'meteor',
        damage: 32, // Stone fist smash (increased from 20 - avoidable)
        cooldown: 10, // 10 seconds between smashes
        minTier: 2,
        visualEffect: 'brown',
        message: '🗿 The Sandstone Golem slams its massive stone fist!',
        interactive: true, // Spawns clickable stone fist
        objectHpPercent: 24, // 24% of boss max HP
        impactDelay: 8, // 8 seconds to destroy it
        imageUrl: '🗿' // Stone/moai icon
      },
      {
        type: 'lightning',
        damage: 15, // Earthquake tremor
        cooldown: 12, // 12 seconds between tremors
        minTier: 3, // Unlocked at T3+
        visualEffect: 'brown',
        message: '💥 The Golem causes an earthquake tremor!'
      }
    ]
  },

  // Desert Tier 3+ - Legendary Boss
  {
    name: 'Desert Phoenix',
    imageUrl: '🦅',
    rarity: 'legendary',
    baseClicksRange: [62, 67], // Base 65 HP → 260 HP at T3, 975 HP at T5
    baseAttackDamage: 12, // Legendary: 12 damage (balanced with Forest/Common)
    biomes: ['desert'],
    moveInterval: 1200, // Fast - graceful bird, hard to hit
    isBoss: true,
    minTier: 3, // Available from Tier 3 onwards
    enrageTimer: 100, // Enrages after 100 seconds
    enrageDamageMultiplier: 2.0, // +100% damage when enraged (phoenix fury)
    bossPhases: [
      {
        phaseNumber: 4,
        hpThreshold: 75, // Phase 1: 100%→75%, Phase 2: 75%→50%, Phase 3: 50%→25%, Phase 4: 25%→0%
        invulnerabilityDuration: 2500,
        specialAttacks: [
          {
            type: 'fireball',
            damage: 25, // Solar flare
            cooldown: 0,
            visualEffect: 'orange',
            message: '☀️ The Desert Phoenix unleashes a solar flare!'
          }
        ]
      },
      {
        phaseNumber: 3,
        hpThreshold: 50,
        invulnerabilityDuration: 3000,
        specialAttacks: [
          {
            type: 'heal',
            healing: 30, // Rebirth flames
            cooldown: 0,
            visualEffect: 'orange',
            message: '🔥 The Phoenix ignites with rebirth flames!'
          }
        ]
      },
      {
        phaseNumber: 2,
        hpThreshold: 25, // Final desperate phase
        invulnerabilityDuration: 3500,
        specialAttacks: [
          {
            type: 'meteor',
            damage: 35, // Inferno dive
            cooldown: 0,
            visualEffect: 'orange',
            message: '🦅 The Desert Phoenix dives in an inferno of flames!'
          },
          {
            type: 'heal',
            healing: 40, // Final resurrection
            cooldown: 0,
            visualEffect: 'orange',
            message: '✨ The Phoenix resurrects from its ashes!'
          }
        ]
      }
    ],
    specialAttacks: [
      {
        type: 'fireball',
        damage: 20, // Flame burst
        cooldown: 8, // 8 seconds
        minTier: 3,
        visualEffect: 'orange',
        message: '🔥 The Phoenix bursts with flames!'
      },
      {
        type: 'lightning',
        damage: 18, // Wing gust
        cooldown: 10, // 10 seconds
        minTier: 3,
        visualEffect: 'yellow',
        message: '💨 The Phoenix creates a scorching wing gust!'
      }
    ],
    dotEffect: {
      type: 'burn',
      damageType: 'percentage',
      damageAmount: 2.5, // 2.5% max HP per second
      tickInterval: 1000,
      duration: 8000, // 8 seconds
      applyChance: 60 // 60% chance to burn with phoenix fire
    }
  }
];
