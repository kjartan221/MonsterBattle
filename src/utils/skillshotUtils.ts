/**
 * Skillshot Utility Functions
 *
 * Calculates skillshot parameters based on monster properties (tier, rarity, boss status)
 *
 * - T1-2: No skillshots (tutorial phase)
 * - T3-5: Progressively more circles based on rarity
 * - Bosses get +1 extra circle
 * - Spawn rate stays consistent (handled by cooldowns)
 */

import type { Tier } from '@/lib/biome-config';

export type MonsterRarity = 'common' | 'rare' | 'epic' | 'legendary';

interface SkillshotConfig {
  enabled: boolean;
  circleCount: number;
}

/**
 * Calculate skillshot configuration based on monster properties
 *
 * Tier-based progression:
 * - T1-2: Disabled (no skillshots)
 * - T3: 2-3 circles (common/rare: 1, epic: 2, legendary: 2, bosses: +1)
 * - T4: 3-4 circles (common: 2, rare: 2, epic: 3, legendary: 3, bosses: +1)
 * - T5: 4-6 circles (common: 3, rare: 3, epic: 4, legendary: 4, bosses: +1)
 */
export function getSkillshotConfig(
  tier: Tier,
  rarity: MonsterRarity,
  isBoss: boolean = false
): SkillshotConfig {
  // Disable skillshots for T1-2 (tutorial phase)
  if (tier <= 2) {
    return { enabled: false, circleCount: 0 };
  }

  // Base circle count by tier and rarity
  let circleCount: number;

  if (tier === 3) {
    // T3: 2-3 circles
    circleCount = rarity === 'epic' || rarity === 'legendary' ? 2 : 1;
  } else if (tier === 4) {
    // T4: 3-4 circles
    circleCount = rarity === 'common' || rarity === 'rare' ? 2 : 3;
  } else {
    // T5: 4-5 circles
    circleCount = rarity === 'common' || rarity === 'rare' ? 3 : 4;
  }

  // Bosses get +1 extra circle (harder challenges)
  if (isBoss) {
    circleCount += 1;
  }

  return {
    enabled: true,
    circleCount
  };
}
