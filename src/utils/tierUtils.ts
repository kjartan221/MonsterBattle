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
 * Positioned at bottom-right of item icon, overlapping but not fully hiding
 */
export function getTierBadgeClassName(): string {
  return 'absolute bottom-1 left-8 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/40 z-50';
}
