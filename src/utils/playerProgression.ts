/**
 * Player progression utilities for XP, leveling, and rewards
 */

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  previousLevel: number;
  statIncreases: {
    maxHealth: number;
    baseDamage: number;
  };
}

/**
 * Calculate XP required for a specific level
 * Formula: 100 * 1.5^(level - 1)
 */
export function getXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

/**
 * Calculate total XP required to reach a level (cumulative)
 */
export function getTotalXPForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getXPForLevel(i);
  }
  return total;
}

/**
 * Check if player should level up and calculate new stats
 */
export function checkLevelUp(
  currentLevel: number,
  currentXP: number
): LevelUpResult {
  const xpForNextLevel = getXPForLevel(currentLevel);

  if (currentXP >= xpForNextLevel) {
    const newLevel = currentLevel + 1;

    // Calculate stat increases
    // +5 max health per level
    const maxHealthIncrease = 5;

    // +1 base damage every 5 levels
    const baseDamageIncrease = newLevel % 5 === 0 ? 1 : 0;

    return {
      leveledUp: true,
      newLevel,
      previousLevel: currentLevel,
      statIncreases: {
        maxHealth: maxHealthIncrease,
        baseDamage: baseDamageIncrease
      }
    };
  }

  return {
    leveledUp: false,
    newLevel: currentLevel,
    previousLevel: currentLevel,
    statIncreases: {
      maxHealth: 0,
      baseDamage: 0
    }
  };
}

/**
 * Calculate XP and coin rewards based on monster rarity
 */
export function getMonsterRewards(rarity: 'common' | 'rare' | 'epic' | 'legendary'): {
  xp: number;
  coins: number;
} {
  switch (rarity) {
    case 'common':
      return { xp: 10, coins: 5 };
    case 'rare':
      return { xp: 20, coins: 10 };
    case 'epic':
      return { xp: 40, coins: 20 };
    case 'legendary':
      return { xp: 80, coins: 50 };
    default:
      return { xp: 10, coins: 5 };
  }
}

/**
 * Calculate player's base damage at a given level
 * Base: 1 damage, +1 every 5 levels
 */
export function getBaseDamageForLevel(level: number): number {
  return 1 + Math.floor(level / 5);
}

/**
 * Calculate player's max health at a given level
 * Base: 100 HP, +5 per level
 */
export function getMaxHealthForLevel(level: number): number {
  return 100 + ((level - 1) * 5);
}

/**
 * Get base crit chance (always 5%)
 */
export function getBaseCritChance(): number {
  return 5;
}

/**
 * Calculate streak reward multiplier for coins/XP
 * Higher streaks = more rewards (encourages risk-taking)
 *
 * Streak tiers:
 * - 0-2: 1.0x (base)
 * - 3-9: 1.1x (+10%)
 * - 10-24: 1.2x (+20%)
 * - 25-49: 1.3x (+30%)
 * - 50-99: 1.4x (+40%)
 * - 100+: 1.5x (+50%)
 */
export function getStreakRewardMultiplier(streak: number): number {
  if (streak <= 2) return 1.0;
  if (streak <= 9) return 1.1;
  if (streak <= 24) return 1.2;
  if (streak <= 49) return 1.3;
  if (streak <= 99) return 1.4;
  return 1.5; // 100+ streak
}

/**
 * Calculate streak rare drop chance bonus
 * Higher streaks = slightly better loot chances
 *
 * Returns percentage points to ADD to base drop rates
 * - 0-2: +0%
 * - 3-9: +2%
 * - 10-24: +4%
 * - 25-49: +6%
 * - 50-99: +8%
 * - 100+: +10%
 */
export function getStreakRareDropBonus(streak: number): number {
  if (streak <= 2) return 0;
  if (streak <= 9) return 2;
  if (streak <= 24) return 4;
  if (streak <= 49) return 6;
  if (streak <= 99) return 8;
  return 10; // 100+ streak
}

/**
 * Calculate tier-based reward multiplier for coins/XP
 * Higher tiers = MUCH more rewards to incentivize progression
 *
 * Tier multipliers:
 * - Tier 1: 1.0x (base rewards)
 * - Tier 2: 3.0x (3x rewards)
 * - Tier 3: 8.0x (8x rewards)
 * - Tier 4: 20.0x (20x rewards)
 * - Tier 5: 50.0x (50x rewards)
 *
 * Why exponential scaling?
 * - Makes higher tier progression feel meaningful
 * - Compensates for increased difficulty (monster stats scale exponentially)
 * - Encourages players to push to higher tiers instead of farming low tiers
 * - T5 monsters are much harder, so rewards should match
 */
export function getTierRewardMultiplier(tier: 1 | 2 | 3 | 4 | 5): number {
  switch (tier) {
    case 1:
      return 1.0;
    case 2:
      return 3.0;
    case 3:
      return 8.0;
    case 4:
      return 20.0;
    case 5:
      return 50.0;
    default:
      return 1.0;
  }
}

/**
 * Calculate corrupted monster spawn rate based on streak
 * Higher streaks = more corrupted spawns = more challenge + more empowered loot
 *
 * Base corruption rate: 10%
 * Returns final corruption rate (0.0 to 1.0)
 * - 0-2: 10% (1.0x multiplier)
 * - 3-9: 12% (1.2x multiplier)
 * - 10-24: 15% (1.5x multiplier)
 * - 25-49: 20% (2.0x multiplier)
 * - 50-99: 25% (2.5x multiplier)
 * - 100+: 30% (3.0x multiplier)
 *
 * Why streak scaling?
 * - Higher challenge for skilled players (corrupted = +50% HP, +25% damage)
 * - Higher reward for skilled players (corrupted drops empowered loot: +20% stats)
 * - Reduces grind for best items (empowered + crafted = BiS items)
 * - Makes streak progression more meaningful
 */
export function getCorruptionRateForStreak(streak: number): number {
  const baseRate = 0.10; // 10% base corruption rate

  let multiplier: number;
  if (streak <= 2) {
    multiplier = 1.0; // 10%
  } else if (streak <= 9) {
    multiplier = 1.2; // 12%
  } else if (streak <= 24) {
    multiplier = 1.5; // 15%
  } else if (streak <= 49) {
    multiplier = 2.0; // 20%
  } else if (streak <= 99) {
    multiplier = 2.5; // 25%
  } else {
    multiplier = 3.0; // 30% (streak 100+)
  }

  return baseRate * multiplier;
}
