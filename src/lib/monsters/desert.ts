import type { MonsterTemplate } from '../monster-table';

/**
 * DESERT BIOME MONSTERS
 *
 * Tier 1 Common: Sand Scorpion, Desert Viper
 * Tier 1 Rare: Fire Elemental
 * Tier 1 Epic Mini-Boss: Sand Djinn
 */
export const DESERT_MONSTERS: MonsterTemplate[] = [
  // Desert Tier 1 - Common Monsters
  {
    name: 'Sand Scorpion',
    imageUrl: '🦂',
    rarity: 'common',
    baseClicksRange: [28, 32], // 70 HP ÷ 2.5 damage = 28 clicks
    baseAttackDamage: 3, // 3 HP/sec + poison
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
    baseAttackDamage: 4, // 4 HP/sec, fast (escapes after 25s)
    biomes: ['desert'],
    moveInterval: 700 // Very fast - elite speed, hard to hit
  },

  // Desert Tier 1 - Rare Monster
  {
    name: 'Fire Elemental',
    imageUrl: '🔥',
    rarity: 'rare',
    baseClicksRange: [35, 40], // 100 HP ÷ 3 damage = 33 clicks
    baseAttackDamage: 3, // 3 HP/sec + burn
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
    baseAttackDamage: 4, // 4 HP/sec → 8 HP/sec at T2, 60 HP/sec at T5
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
        damage: 20, // Sandstorm explosion
        cooldown: 10, // 10 seconds between sandstorms
        minTier: 2, // Unlocked at T2+
        visualEffect: 'orange',
        message: '🌪️ The Sand Djinn conjures a devastating sandstorm!'
      }
    ]
  }
];
