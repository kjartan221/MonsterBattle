import type { MonsterTemplate } from '../monster-table';

/**
 * OCEAN BIOME MONSTERS
 *
 * Tier 1 Common: Coral Crab, Giant Jellyfish
 * Tier 1-2 Rare: Frost Shark, Electric Eel
 * Tier 3 Epic Mini-Boss: Sea Serpent
 * Tier 5 Legendary Boss: Leviathan
 */
export const OCEAN_MONSTERS: MonsterTemplate[] = [
  // Ocean Tier 1 - Common Monsters
  {
    name: 'Coral Crab',
    imageUrl: '🦀',
    rarity: 'common',
    baseClicksRange: [26, 31], // 65 HP ÷ 2.5 damage = 26 clicks
    baseAttackDamage: 2, // 2 HP/sec, armored shell
    biomes: ['ocean'],
    moveInterval: 1700, // Medium-slow - heavy shell
    initialBuffs: [
      {
        type: 'shield',
        value: 30 // 30% of monster HP as hard shell shield
      }
    ]
  },
  {
    name: 'Giant Jellyfish',
    imageUrl: '🪼',
    rarity: 'common',
    baseClicksRange: [24, 29], // 60 HP ÷ 2.5 damage = 24 clicks
    baseAttackDamage: 3, // 3 HP/sec, slow movement
    biomes: ['ocean'],
    moveInterval: 2000, // Slow - drifting creature
    dotEffect: {
      type: 'poison',
      damageType: 'percentage',
      damageAmount: 1.5, // 1.5% max HP per second (jellyfish sting)
      tickInterval: 1000,
      duration: 6000, // 6 seconds
      applyChance: 40 // 40% chance to sting
    }
  },

  // Ocean Tier 1-2 - Rare Monsters
  {
    name: 'Frost Shark',
    imageUrl: '🦈',
    rarity: 'rare',
    baseClicksRange: [36, 41], // 95 HP ÷ 2.5 damage = 38 clicks
    baseAttackDamage: 4, // 4 HP/sec, aggressive predator
    biomes: ['ocean'],
    moveInterval: 1200, // Fast - apex predator
    dotEffect: {
      type: 'freeze',
      damageType: 'percentage',
      damageAmount: 2, // 2% max HP per second (frostbite)
      tickInterval: 1000,
      duration: 5000, // 5 seconds
      applyChance: 60 // 60% chance to freeze bite
    }
  },
  {
    name: 'Electric Eel',
    imageUrl: '⚡',
    rarity: 'rare',
    baseClicksRange: [32, 37], // 80 HP ÷ 2.5 damage = 32 clicks
    baseAttackDamage: 3, // 3 HP/sec + shock
    biomes: ['ocean'],
    moveInterval: 1000, // Fast - slippery and agile
    dotEffect: {
      type: 'stun',
      damageType: 'percentage',
      damageAmount: 2.5, // 2.5% max HP per second (electric shock)
      tickInterval: 1000,
      duration: 4000, // 4 seconds
      applyChance: 70 // 70% chance to shock
    }
  },

  // Ocean Tier 2+ - Epic Mini-Boss
  {
    name: 'Sea Serpent',
    imageUrl: '🐍',
    rarity: 'epic',
    baseClicksRange: [42, 47], // 135 HP ÷ 3 damage = 45 clicks
    baseAttackDamage: 5, // 5 HP/sec
    biomes: ['ocean'],
    moveInterval: 1800, // Medium-slow - large creature
    isBoss: true,
    minTier: 1, // Available from Tier 2 onwards
    specialAttacks: [
      {
        type: 'lightning',
        damage: 12, // Electric shock attack
        cooldown: 7, // 7 seconds between attacks
        minTier: 1, // Basic attack available from T1
        visualEffect: 'blue',
        message: '⚡ The Sea Serpent unleashes an electric shock!'
      },
      {
        type: 'lightning',
        damage: 18, // Stronger electric burst
        cooldown: 10, // 10 seconds between attacks
        minTier: 2, // Unlocked at T2+
        visualEffect: 'blue',
        message: '⚡⚡ The Sea Serpent releases a devastating electric burst!'
      }
    ]
  },

  // Ocean Tier 3+ - Legendary Boss
  {
    name: 'Leviathan',
    imageUrl: '🐋',
    rarity: 'legendary',
    baseClicksRange: [55, 60], // Base 58 HP → 232 HP at T3, 870 HP at T5
    baseAttackDamage: 6, // 6 HP/sec → 24 HP/sec at T3, 90 HP/sec at T5
    biomes: ['ocean'],
    moveInterval: 3000, // Very slow - colossal boss
    isBoss: true,
    minTier: 3, // Available from Tier 3 onwards
    bossPhases: [
      {
        phaseNumber: 3,
        hpThreshold: 66, // Phase 1: 100%→66%, Phase 2: 66%→33%, Phase 3: 33%→0%
        invulnerabilityDuration: 2500, // 2.5 seconds
        specialAttacks: [
          {
            type: 'meteor',
            damage: 25, // Tidal wave crash
            cooldown: 0,
            visualEffect: 'blue',
            message: '🌊 The Leviathan summons a massive tidal wave!'
          }
        ]
      },
      {
        phaseNumber: 2,
        hpThreshold: 33, // Final phase at 33% HP
        invulnerabilityDuration: 2500,
        specialAttacks: [
          {
            type: 'heal',
            healing: 30, // Absorbs water energy
            cooldown: 0,
            visualEffect: 'blue',
            message: '🌊 The Leviathan absorbs the ocean\'s energy!'
          },
          {
            type: 'summon',
            cooldown: 0,
            summons: {
              count: 2,
              creature: {
                name: 'Frost Shark',
                hpPercent: 12, // 12% of boss max HP
                attackDamage: 4,
                imageUrl: '🦈'
              }
            },
            visualEffect: 'blue',
            message: '🦈 The Leviathan calls Frost Sharks to its aid!'
          }
        ]
      }
    ]
  }
];
