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
