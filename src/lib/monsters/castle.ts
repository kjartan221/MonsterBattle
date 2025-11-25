import type { MonsterTemplate } from '../monster-table';

/**
 * CASTLE BIOME MONSTERS
 *
 * Tier 1 Common: Skeleton Warrior, Cursed Spirit
 * Tier 1-2 Rare: Vampire Lord, Death Knight
 * Tier 3 Epic Mini-Boss: Necromancer
 * Tier 5 Legendary Boss: Lich King
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

  // Castle Tier 2+ - Epic Mini-Boss
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
        damage: 20, // Death curse explosion
        cooldown: 14, // 14 seconds between curses
        minTier: 2, // Unlocked at T2+
        visualEffect: 'purple',
        message: '💀 The Necromancer unleashes a devastating death curse!'
      }
    ]
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
