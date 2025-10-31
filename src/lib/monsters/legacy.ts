import type { MonsterTemplate } from '../monster-table';

/**
 * LEGACY MONSTERS (will be deprecated)
 *
 * These are old monster templates that will be phased out.
 * Kept for backwards compatibility with existing battles.
 */
export const LEGACY_MONSTERS: MonsterTemplate[] = [
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
  }
];
