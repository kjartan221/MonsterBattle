import type { Inscription, InscriptionType } from '@/lib/types';

/**
 * Get the full inscribed item name with prefix and/or suffix
 * Phase 3.4: Equipment Customization - Prefix & Suffix System
 *
 * Examples:
 * - No inscriptions: "Iron Dagger"
 * - Prefix only: "Savage Iron Dagger"
 * - Suffix only: "Iron Dagger of Fury"
 * - Both: "Savage Iron Dagger of Fury"
 *
 * @param baseName - The base item name (e.g., "Iron Dagger")
 * @param prefix - Optional prefix inscription
 * @param suffix - Optional suffix inscription
 * @returns The full inscribed name
 */
export function getInscribedItemName(
  baseName: string,
  prefix?: Inscription,
  suffix?: Inscription
): string {
  let name = baseName;

  if (prefix) {
    name = `${prefix.name} ${name}`;
  }

  if (suffix) {
    name = `${name} ${suffix.name}`;
  }

  return name;
}

/**
 * Truncate long item names with ellipsis
 * Useful for UI components with limited space (e.g., equipment widget)
 *
 * @param name - The item name to truncate
 * @param maxLength - Maximum length before truncation (default: 25)
 * @returns Truncated name with "..." if too long
 */
export function truncateItemName(name: string, maxLength: number = 25): string {
  if (name.length <= maxLength) {
    return name;
  }

  return `${name.substring(0, maxLength - 3)}...`;
}

/**
 * Get display label for inscription stat type
 * Maps InscriptionType to human-readable label
 *
 * @param type - The inscription type
 * @returns Display label (e.g., "Damage", "Crit Chance", etc.)
 */
export function getInscriptionStatLabel(type: InscriptionType): string {
  const labels: Record<InscriptionType, string> = {
    damage: 'Damage',
    critical: 'Crit Chance',
    protection: 'Defense',
    vitality: 'Max HP',
    haste: 'Attack Speed',
    fortune: 'Coin Bonus',
    healing: 'Heal Bonus',
    lifesteal: 'Lifesteal',
    defensiveLifesteal: 'Defensive Lifesteal',
    thorns: 'Thorns',
    autoclick: 'Auto-Hits/Sec'
  };

  return labels[type] || 'Unknown';
}

/**
 * Format inscription stat value for display
 * Adds appropriate suffix based on inscription type (%, raw number, etc.)
 *
 * @param type - The inscription type
 * @param value - The stat value
 * @returns Formatted stat string (e.g., "+5 Damage", "+3% Crit Chance")
 */
export function formatInscriptionStat(type: InscriptionType, value: number): string {
  const label = getInscriptionStatLabel(type);

  // Percentage-based stats
  if (type === 'critical' || type === 'haste' || type === 'fortune' || type === 'healing' || type === 'lifesteal') {
    return `+${value}% ${label}`;
  }

  // Flat number stats (with decimal support for autoclick)
  return `+${value} ${label}`;
}

/**
 * Get inscription description for tooltips
 * Provides a detailed description of what the inscription does
 *
 * @param inscription - The inscription object
 * @returns Description string
 */
export function getInscriptionDescription(inscription: Inscription): string {
  return `${inscription.name}: ${formatInscriptionStat(inscription.type, inscription.value)}`;
}

/**
 * Check if an item has any inscriptions
 * Useful for conditional rendering
 *
 * @param prefix - Optional prefix inscription
 * @param suffix - Optional suffix inscription
 * @returns True if item has at least one inscription
 */
export function hasInscriptions(prefix?: Inscription, suffix?: Inscription): boolean {
  return !!(prefix || suffix);
}

/**
 * Get rarity color for inscription stat display
 * Based on inscription value (higher value = rarer scroll)
 *
 * @param value - The inscription stat value
 * @returns Tailwind color class
 */
export function getInscriptionRarityColor(value: number): string {
  if (value >= 12) return 'text-orange-400'; // Legendary (+12)
  if (value >= 8) return 'text-purple-400';  // Epic (+8)
  if (value >= 5) return 'text-blue-400';    // Rare (+5)
  return 'text-gray-400';                     // Common (+3)
}

/**
 * Get inscription slot display name
 * Capitalizes slot name for UI display
 *
 * @param slot - The inscription slot ('prefix' or 'suffix')
 * @returns Capitalized slot name
 */
export function getInscriptionSlotName(slot: 'prefix' | 'suffix'): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}
