/**
 * Utility functions for crafting stat roll system
 *
 * Stat rolls range from 0.8 to 1.2 (±20% variation)
 * Quality tiers determine visual styling and labels
 */

export interface StatRollQuality {
  percentage: number;
  color: string;
  label: string;
  emoji: string;
}

/**
 * Get quality tier information for a stat roll
 * @param statRoll - The stat roll multiplier (0.8 to 1.2)
 * @returns Quality tier info with percentage, color, label, and emoji
 */
export function getStatRollQuality(statRoll: number): StatRollQuality {
  const percentage = Math.round((statRoll - 1) * 100);

  if (statRoll >= 1.15) {
    return {
      percentage,
      color: 'text-amber-400 border-amber-500',
      label: 'Masterwork',
      emoji: '⭐'
    };
  }

  if (statRoll >= 1.05) {
    return {
      percentage,
      color: 'text-green-400 border-green-500',
      label: 'Superior',
      emoji: '✨'
    };
  }

  if (statRoll >= 0.95) {
    return {
      percentage,
      color: 'text-gray-400 border-gray-500',
      label: 'Standard',
      emoji: '⚖️'
    };
  }

  if (statRoll >= 0.85) {
    return {
      percentage,
      color: 'text-orange-400 border-orange-500',
      label: 'Inferior',
      emoji: '📉'
    };
  }

  return {
    percentage,
    color: 'text-red-400 border-red-500',
    label: 'Poor',
    emoji: '💔'
  };
}
