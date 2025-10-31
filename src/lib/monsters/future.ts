import type { MonsterTemplate } from '../monster-table';

/**
 * FUTURE MONSTERS (not yet implemented)
 *
 * These monsters are planned for future biomes (Volcano, Ocean, Castle).
 * They are defined here for future use but are not yet in the game.
 */
export const FUTURE_MONSTERS: MonsterTemplate[] = [
  {
    name: 'Dragon',
    imageUrl: '🐉',
    rarity: 'epic',
    baseClicksRange: [25, 35],
    baseAttackDamage: 8,
    biomes: ['volcano'] // Future biome
  },
  {
    name: 'Vampire',
    imageUrl: '🧛',
    rarity: 'epic',
    baseClicksRange: [20, 30],
    baseAttackDamage: 7,
    biomes: ['castle'] // Future biome
  },
  {
    name: 'Demon',
    imageUrl: '😈',
    rarity: 'legendary',
    baseClicksRange: [40, 50],
    baseAttackDamage: 12,
    biomes: ['volcano'] // Future biome
  }
];
