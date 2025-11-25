import type { MonsterTemplate } from '../monster-table';

/**
 * VOLCANO BIOME MONSTERS
 *
 * Tier 1 Common: Lava Salamander, Fire Bat
 * Tier 1-2 Rare: Magma Golem, Inferno Imp
 * Tier 1+ Epic Mini-Boss: Fire Drake
 * Tier 2+ Epic Mini-Boss: Volcanic Titan
 * Tier 3+ Legendary Boss: Ancient Dragon
 */
export const VOLCANO_MONSTERS: MonsterTemplate[] = [
  // Volcano Tier 1 - Common Monsters
  {
    name: 'Lava Salamander',
    imageUrl: '🦎',
    rarity: 'common',
    baseClicksRange: [27, 32], // 70 HP ÷ 2.5 damage = 28 clicks
    baseAttackDamage: 3, // 3 HP/sec, fire damage
    biomes: ['volcano'],
    moveInterval: 1500, // Medium speed - reptile movement
    dotEffect: {
      type: 'burn',
      damageType: 'percentage',
      damageAmount: 2, // 2% max HP per second
      tickInterval: 1000,
      duration: 5000, // 5 seconds
      applyChance: 50 // 50% chance to burn
    }
  },
  {
    name: 'Fire Bat',
    imageUrl: '🦇',
    rarity: 'common',
    baseClicksRange: [23, 28], // 55 HP ÷ 2 damage = 27.5 clicks
    baseAttackDamage: 2, // 2 HP/sec, fast flying creature
    biomes: ['volcano'],
    moveInterval: 900 // Very fast - flying agile creature
  },

  // Volcano Tier 1-2 - Rare Monsters
  {
    name: 'Magma Golem',
    imageUrl: '🗿',
    rarity: 'rare',
    baseClicksRange: [40, 45], // 110 HP ÷ 2.5 damage = 44 clicks
    baseAttackDamage: 4, // 4 HP/sec, heavy tank
    biomes: ['volcano'],
    moveInterval: 2500, // Very slow - massive stone creature
    dotEffect: {
      type: 'burn',
      damageType: 'percentage',
      damageAmount: 3, // 3% max HP per second (intense heat)
      tickInterval: 1000,
      duration: 6000, // 6 seconds
      applyChance: 80 // 80% chance to burn (radiates heat)
    }
  },
  {
    name: 'Inferno Imp',
    imageUrl: '👹',
    rarity: 'rare',
    baseClicksRange: [33, 38], // 85 HP ÷ 2.5 damage = 34 clicks
    baseAttackDamage: 3, // 3 HP/sec, tricky demon
    biomes: ['volcano'],
    moveInterval: 1100, // Fast - demonic agility
    dotEffect: {
      type: 'burn',
      damageType: 'percentage',
      damageAmount: 2.5, // 2.5% max HP per second
      tickInterval: 1000,
      duration: 5000, // 5 seconds
      applyChance: 65 // 65% chance to burn
    }
  },

  // Volcano Tier 1+ - Epic Mini-Boss
  {
    name: 'Fire Drake',
    imageUrl: '🐲',
    rarity: 'epic',
    baseClicksRange: [44, 49], // 140 HP ÷ 3 damage = 46.6 clicks
    baseAttackDamage: 6, // 6 HP/sec, powerful dragon-kin
    biomes: ['volcano'],
    moveInterval: 2000, // Slow - large flying boss
    isBoss: true,
    minTier: 1, // Available from Tier 1 onwards
    enrageTimer: 70, // Enrages after 70 seconds
    enrageDamageMultiplier: 1.6, // +60% damage when enraged
    bossPhases: [
      {
        phaseNumber: 2,
        hpThreshold: 50, // Phase 1: 100%→50%, Phase 2: 50%→0%
        invulnerabilityDuration: 2000, // 2 seconds
        specialAttacks: [
          {
            type: 'heal',
            healing: 16, // Draconic fire healing
            cooldown: 0,
            visualEffect: 'orange',
            message: '🔥 The Fire Drake channels flames to mend its wounds!'
          }
        ]
      }
    ],
    specialAttacks: [
      {
        type: 'fireball',
        damage: 18, // Dragon fire breath
        cooldown: 6, // 6 seconds between breaths
        minTier: 1, // Basic fire breath from T1
        visualEffect: 'orange',
        message: '🔥 The Fire Drake breathes a torrent of flames!'
      },
      {
        type: 'meteor',
        damage: 35, // Meteor strike (increased from 22 - avoidable)
        cooldown: 12, // 12 seconds between strikes
        minTier: 2, // Unlocked at T2+
        visualEffect: 'red',
        message: '☄️ The Fire Drake calls down a meteor from above!',
        interactive: true, // Spawns clickable meteor
        objectHpPercent: 25, // 25% of boss max HP
        impactDelay: 8, // 8 seconds to destroy it
        imageUrl: '☄️' // Meteor icon
      }
    ]
  },

  // Volcano Tier 2+ - Epic Mini-Boss
  {
    name: 'Volcanic Titan',
    imageUrl: '🔥',
    rarity: 'epic',
    baseClicksRange: [50, 55], // 150 HP ÷ 3 damage = 50 clicks
    baseAttackDamage: 7, // 7 HP/sec → 14 HP/sec at T2, 105 HP/sec at T5
    biomes: ['volcano'],
    moveInterval: 2600, // Very slow - colossal elemental
    isBoss: true,
    minTier: 2, // Available from Tier 2 onwards
    enrageTimer: 80, // Enrages after 80 seconds
    enrageDamageMultiplier: 1.75, // +75% damage when enraged (volcanic fury)
    specialAttacks: [
      {
        type: 'meteor',
        damage: 40, // Lava eruption (increased from 25 - avoidable)
        cooldown: 10, // 10 seconds between eruptions
        minTier: 2, // Basic attack from T2
        visualEffect: 'orange',
        message: '🌋 The Volcanic Titan triggers a massive lava eruption!',
        interactive: true, // Spawns clickable lava bomb
        objectHpPercent: 28, // 28% of boss max HP
        impactDelay: 9, // 9 seconds to destroy it
        imageUrl: '🌋' // Volcano/lava bomb icon
      },
      {
        type: 'fireball',
        damage: 20, // Magma burst
        cooldown: 13, // 13 seconds between bursts
        minTier: 3, // Unlocked at T3+
        visualEffect: 'red',
        message: '💥 The Titan unleashes a devastating magma burst!'
      }
    ],
    dotEffect: {
      type: 'burn',
      damageType: 'percentage',
      damageAmount: 2, // 2% max HP per second (intense heat aura)
      tickInterval: 1000,
      duration: 6000, // 6 seconds
      applyChance: 70 // 70% chance to burn from heat aura
    }
  },

  // Volcano Tier 3+ - Legendary Boss
  {
    name: 'Ancient Dragon',
    imageUrl: '🐉',
    rarity: 'legendary',
    baseClicksRange: [58, 63], // Base 60 HP → 240 HP at T3, 900 HP at T5
    baseAttackDamage: 7, // 7 HP/sec → 28 HP/sec at T3, 105 HP/sec at T5
    biomes: ['volcano'],
    moveInterval: 3500, // Very slow - massive legendary boss
    isBoss: true,
    minTier: 3, // Available from Tier 3 onwards
    enrageTimer: 100, // Enrages after 100 seconds
    enrageDamageMultiplier: 1.9, // +90% damage when enraged
    bossPhases: [
      {
        phaseNumber: 3,
        hpThreshold: 66, // Phase 1: 100%→66%, Phase 2: 66%→33%, Phase 3: 33%→0%
        invulnerabilityDuration: 3000, // 3 seconds
        specialAttacks: [
          {
            type: 'meteor',
            damage: 30, // Meteor strike from above
            cooldown: 0,
            visualEffect: 'red',
            message: '☄️ The Ancient Dragon calls down a meteor strike!'
          }
        ]
      },
      {
        phaseNumber: 2,
        hpThreshold: 33, // Final phase at 33% HP
        invulnerabilityDuration: 3000,
        specialAttacks: [
          {
            type: 'fireball',
            damage: 25, // Devastating fire breath
            cooldown: 0,
            visualEffect: 'orange',
            message: '🔥 The Ancient Dragon unleashes its ultimate flame!'
          },
          {
            type: 'summon',
            cooldown: 0,
            summons: {
              count: 2,
              creature: {
                name: 'Fire Drake',
                hpPercent: 10, // 10% of boss max HP
                attackDamage: 6,
                imageUrl: '🐲'
              }
            },
            visualEffect: 'orange',
            message: '🐲 The Ancient Dragon summons Fire Drakes!'
          }
        ]
      }
    ]
  }
];
