import type { MonsterTemplate } from '../monster-table';

/**
 * CASTLE BIOME MONSTERS
 *
 * Tier 1 Common: Skeleton Warrior, Cursed Spirit
 * Tier 1-2 Rare: Vampire Lord, Death Knight
 * Tier 1+ Epic Mini-Boss: Necromancer
 * Tier 2+ Epic Mini-Boss: Wraith Lord
 * Tier 3+ Legendary Boss: Lich King
 */
export const CASTLE_MONSTERS: MonsterTemplate[] = [
  // Castle Tier 1 - Common Monsters
  {
    name: 'Skeleton Warrior',
    imageUrl: '💀',
    rarity: 'common',
    baseClicksRange: [28, 33], // 75 HP ÷ 2.5 damage = 30 clicks
    baseAttackDamage: 3, // 3 HP/sec, undead melee
    biomes: ['castle'],
    moveInterval: 1600 // Medium-slow - shambling undead
  },
  {
    name: 'Cursed Spirit',
    imageUrl: '👻',
    rarity: 'common',
    baseClicksRange: [24, 29], // 60 HP ÷ 2.5 damage = 24 clicks
    baseAttackDamage: 2, // 2 HP/sec, ethereal
    biomes: ['castle'],
    moveInterval: 1300, // Medium-fast - floating ghost
    dotEffect: {
      type: 'poison',
      damageType: 'percentage',
      damageAmount: 1.5, // 1.5% max HP per second (curse damage)
      tickInterval: 1000,
      duration: 7000, // 7 seconds
      applyChance: 45 // 45% chance to curse
    }
  },

  // Castle Tier 1-2 - Rare Monsters
  {
    name: 'Vampire Lord',
    imageUrl: '🧛',
    rarity: 'rare',
    baseClicksRange: [35, 40], // 90 HP ÷ 2.5 damage = 36 clicks
    baseAttackDamage: 5, // 5 HP/sec, life drain
    biomes: ['castle'],
    moveInterval: 1000, // Fast - supernatural speed
    dotEffect: {
      type: 'bleed',
      damageType: 'percentage',
      damageAmount: 2.5, // 2.5% max HP per second (blood drain)
      tickInterval: 1000,
      duration: 6000, // 6 seconds
      applyChance: 70 // 70% chance to drain blood
    }
  },
  {
    name: 'Death Knight',
    imageUrl: '⚔️',
    rarity: 'rare',
    baseClicksRange: [42, 47], // 120 HP ÷ 2.5 damage = 48 clicks
    baseAttackDamage: 4, // 4 HP/sec, heavy armor
    biomes: ['castle'],
    moveInterval: 2200, // Slow - armored undead warrior
    dotEffect: {
      type: 'poison',
      damageType: 'percentage',
      damageAmount: 2, // 2% max HP per second (necrotic blade)
      tickInterval: 1000,
      duration: 5000, // 5 seconds
      applyChance: 60 // 60% chance to inflict necrotic damage
    }
  },

  // Castle Tier 1+ - Epic Mini-Boss
  {
    name: 'Necromancer',
    imageUrl: '🧙',
    rarity: 'epic',
    baseClicksRange: [43, 48], // 135 HP ÷ 3 damage = 45 clicks
    baseAttackDamage: 5, // 5 HP/sec, dark magic
    biomes: ['castle'],
    moveInterval: 1900, // Medium-slow - caster movement
    isBoss: true,
    minTier: 1, // Available from Tier 1 onwards
    enrageTimer: 75, // Enrages after 75 seconds
    enrageDamageMultiplier: 1.6, // +60% damage when enraged
    bossPhases: [
      {
        phaseNumber: 2,
        hpThreshold: 50, // Phase 1: 100%→50%, Phase 2: 50%→0%
        invulnerabilityDuration: 2000, // 2 seconds
        specialAttacks: [
          {
            type: 'heal',
            healing: 15, // Life drain ritual
            cooldown: 0,
            visualEffect: 'purple',
            message: '💀 The Necromancer drains life force to heal!'
          },
          {
            type: 'summon',
            cooldown: 0,
            summons: {
              count: 2,
              creature: {
                name: 'Skeleton Warrior',
                hpPercent: 12, // 12% of boss max HP
                attackDamage: 3,
                imageUrl: '💀'
              }
            },
            visualEffect: 'purple',
            message: '💀 The Necromancer raises skeleton warriors!'
          }
        ]
      }
    ],
    specialAttacks: [
      {
        type: 'lightning',
        damage: 15, // Dark lightning bolt
        cooldown: 8, // 8 seconds between casts
        minTier: 1, // Basic dark lightning from T1
        visualEffect: 'purple',
        message: '⚡ The Necromancer casts a bolt of dark lightning!'
      },
      {
        type: 'meteor',
        damage: 32, // Death curse explosion (increased from 20 - avoidable)
        cooldown: 14, // 14 seconds between curses
        minTier: 2, // Unlocked at T2+
        visualEffect: 'purple',
        message: '💀 The Necromancer unleashes a devastating death curse!',
        interactive: true, // Spawns clickable cursed orb
        objectHpPercent: 22, // 22% of boss max HP
        impactDelay: 8, // 8 seconds to destroy it
        imageUrl: '💀' // Cursed skull icon
      }
    ]
  },

  // Castle Tier 2+ - Epic Mini-Boss
  {
    name: 'Wraith Lord',
    imageUrl: '👤',
    rarity: 'epic',
    baseClicksRange: [48, 53], // 145 HP ÷ 3 damage = 48 clicks
    baseAttackDamage: 6, // 6 HP/sec → 12 HP/sec at T2, 90 HP/sec at T5
    biomes: ['castle'],
    moveInterval: 1400, // Fast - ethereal movement
    isBoss: true,
    minTier: 2, // Available from Tier 2 onwards
    enrageTimer: 85, // Enrages after 85 seconds
    enrageDamageMultiplier: 1.7, // +70% damage when enraged (spectral fury)
    specialAttacks: [
      {
        type: 'lightning',
        damage: 18, // Shadow bolt
        cooldown: 9, // 9 seconds between bolts
        minTier: 2, // Basic attack from T2
        visualEffect: 'purple',
        message: '👤 The Wraith Lord hurls a bolt of shadow energy!'
      },
      {
        type: 'meteor',
        damage: 35, // Life drain explosion (increased from 22 - avoidable)
        cooldown: 12, // 12 seconds between drains
        minTier: 3, // Unlocked at T3+
        visualEffect: 'purple',
        message: '💀 The Wraith Lord drains the life force of all nearby!',
        interactive: true, // Spawns clickable death orb
        objectHpPercent: 24, // 24% of boss max HP
        impactDelay: 9, // 9 seconds to destroy it
        imageUrl: '👤' // Wraith/spirit icon
      }
    ],
    dotEffect: {
      type: 'poison',
      damageType: 'percentage',
      damageAmount: 2, // 2% max HP per second (spectral curse)
      tickInterval: 1000,
      duration: 7000, // 7 seconds
      applyChance: 65 // 65% chance to curse with spectral touch
    }
  },

  // Castle Tier 3+ - Legendary Boss
  {
    name: 'Lich King',
    imageUrl: '👑',
    rarity: 'legendary',
    baseClicksRange: [60, 65], // Base 62 HP → 248 HP at T3, 930 HP at T5
    baseAttackDamage: 8, // 8 HP/sec → 32 HP/sec at T3, 120 HP/sec at T5
    biomes: ['castle'],
    moveInterval: 3000, // Very slow - commanding presence
    isBoss: true,
    minTier: 3, // Available from Tier 3 onwards
    enrageTimer: 105, // Enrages after 105 seconds
    enrageDamageMultiplier: 2.0, // +100% damage when enraged (undead fury)
    bossPhases: [
      {
        phaseNumber: 4,
        hpThreshold: 75, // Phase 1: 100%→75%, Phase 2: 75%→50%, Phase 3: 50%→25%, Phase 4: 25%→0%
        invulnerabilityDuration: 2500,
        specialAttacks: [
          {
            type: 'meteor',
            damage: 20, // Death comet
            cooldown: 0,
            visualEffect: 'purple',
            message: '☄️ The Lich King summons a death comet!'
          }
        ]
      },
      {
        phaseNumber: 3,
        hpThreshold: 50,
        invulnerabilityDuration: 2500,
        specialAttacks: [
          {
            type: 'heal',
            healing: 25, // Life drain
            cooldown: 0,
            visualEffect: 'purple',
            message: '💀 The Lich King drains life force to heal!'
          }
        ]
      },
      {
        phaseNumber: 2,
        hpThreshold: 25, // Final desperate phase
        invulnerabilityDuration: 3000,
        specialAttacks: [
          {
            type: 'lightning',
            damage: 30, // Ultimate dark magic
            cooldown: 0,
            visualEffect: 'purple',
            message: '⚡ The Lich King unleashes his ultimate dark magic!'
          },
          {
            type: 'summon',
            cooldown: 0,
            summons: {
              count: 3,
              creature: {
                name: 'Death Knight',
                hpPercent: 8, // 8% of boss max HP each
                attackDamage: 4,
                imageUrl: '⚔️'
              }
            },
            visualEffect: 'purple',
            message: '⚔️ The Lich King summons Death Knights to defend him!'
          }
        ]
      }
    ]
  }
];
