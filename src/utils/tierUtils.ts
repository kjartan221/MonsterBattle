/**
 * Tier Utilities
 *
 * Helper functions for working with item tiers
 */

import { Tier } from '@/lib/biome-config';

/**
 * Convert tier number to Roman numerals
 * @param tier - Tier number (1-5)
 * @returns Roman numeral string (I-V)
 */
export function tierToRoman(tier: number): string {
  const romanNumerals = ['I', 'II', 'III', 'IV', 'V'];
  return romanNumerals[tier - 1] || 'I';
}

/**
 * Tier badge component styles (reusable across components)
 * Returns className string for consistent tier badge styling
 */
export function getTierBadgeClassName(): string {
  return 'absolute bottom-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded border border-white/30';
}
