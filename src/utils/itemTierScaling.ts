/**
 * Item Tier Scaling System
 *
 * Items scale SLOWER than monsters to maintain difficulty at higher tiers.
 * This prevents "number inflation" and forces strategic item combinations.
 */

import type { Tier } from '@/lib/biome-config';

/**
 * Item tier multipliers (moderate scaling for hybrid approach)
 *
 * Monster scaling: 1x, 2x, 4x, 8x, 15x
 * Item scaling:    1x, 1.4x, 2x, 3x, 4.5x
 *
 * This creates:
 * - Tier 1: Easy with gear (25-30 clicks)
 * - Tier 2: Similar clicks, slightly harder monsters
 * - Tier 3: 30-35 clicks + mechanics (shields, DoT)
 * - Tier 4: 35-40 clicks + harder mechanics (debuffs, regen)
 * - Tier 5: 40-45 clicks + complex mechanics (multi-phase, time limits)
 *
 * RSI Prevention: Click count stays reasonable (25-45 max)
 * Difficulty from tactics, not HP bloat!
 */
export const ITEM_TIER_MULTIPLIERS: Record<Tier, number> = {
  1: 1.0,   // Base stats
  2: 1.4,   // 1.4x stats (not 2x like monsters)
  3: 2.0,   // 2x stats (not 4x like monsters)
  4: 3.0,   // 3x stats (not 8x like monsters)
  5: 4.5    // 4.5x stats (not 15x like monsters)
};

/**
 * Apply tier scaling to an item stat
 *
 * @example
 * const baseDamage = 2;
 * const tier = 3;
 * const scaledDamage = applyItemTierScaling(baseDamage, tier);
 * // Returns: 5 (2 * 2.5)
 */
export function applyItemTierScaling(baseStat: number, tier: Tier): number {
  const multiplier = ITEM_TIER_MULTIPLIERS[tier];
  // Always round UP to avoid float numbers
  return Math.ceil(baseStat * multiplier);
}

/**
 * Get tier multiplier
 */
export function getItemTierMultiplier(tier: Tier): number {
  return ITEM_TIER_MULTIPLIERS[tier];
}

/**
 * Calculate all scaled stats for an item
 *
 * @example
 * const baseStats = { damageBonus: 2, critChance: 5 };
 * const tier = 3;
 * const scaled = scaleItemStats(baseStats, tier);
 * // Returns: { damageBonus: 5, critChance: 13 }
 */
export function scaleItemStats<T extends Record<string, number>>(
  baseStats: T,
  tier: Tier
): T {
  const multiplier = ITEM_TIER_MULTIPLIERS[tier] || 1; // Default to 1x if tier is invalid
  const scaled = {} as T;

  for (const [key, value] of Object.entries(baseStats)) {
    if (typeof value === 'number' && !isNaN(value)) {
      // Always round UP to avoid float numbers (consistent with empowered stats)
      const scaledValue = Math.ceil(value * multiplier);
      // Defensive check - ensure result is not NaN
      scaled[key as keyof T] = (isNaN(scaledValue) ? 0 : scaledValue) as T[keyof T];
    } else {
      // If value is not a valid number, default to 0
      scaled[key as keyof T] = 0 as T[keyof T];
    }
  }

  return scaled;
}

/**
 * Example item progression (updated with hybrid scaling)
 *
 * Common Dagger (base damage: 1):
 * - Tier 1: +1 damage
 * - Tier 2: +1 damage (1.4x, rounded to 1)
 * - Tier 3: +2 damage (2x)
 * - Tier 4: +3 damage (3x)
 * - Tier 5: +5 damage (4.5x, rounded)
 *
 * Flame Sword (base damage: 4, crit: 10):
 * - Tier 1: +4 damage, +10% crit
 * - Tier 2: +6 damage, +14% crit (1.4x)
 * - Tier 3: +8 damage, +20% crit (2x)
 * - Tier 4: +12 damage, +30% crit (3x)
 * - Tier 5: +18 damage, +45% crit (4.5x)
 *
 * Full Build Example at Tier 5 (Level 15):
 * - Base damage: 4 (1 + 15/5 rounded)
 * - Weapon: +18 (T5 Flame Sword)
 * - Accessories: +9 (T5 items)
 * - Total: 31 damage, ~50% crit
 * - Average per click: 31 * 0.5 + 62 * 0.5 = 46.5 damage
 * - T5 Common Monster: 900 HP ÷ 46.5 = ~19 clicks
 * - Add mechanics (shields, phases) = 35-40 clicks effective
 */
