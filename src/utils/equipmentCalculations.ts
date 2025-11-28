import type { EquippedItem } from '@/contexts/EquipmentContext';
import { scaleItemStats } from '@/utils/itemTierScaling';
import type { Tier } from '@/lib/biome-config';
import type { Inscription } from '@/lib/types';

export interface TotalEquipmentStats {
  damageBonus: number;
  critChance: number;
  defense: number;
  maxHpBonus: number;
  attackSpeed: number;
  coinBonus: number;
  healBonus: number;
  lifesteal: number;      // Phase 2.5: % of damage dealt returned as HP
  autoClickRate: number;  // Phase 2.5: auto-hits per second (stacks)
}

/**
 * Calculate total equipment bonuses from all equipped items
 * Applies tier scaling to each item's base stats before summing
 */
export function calculateTotalEquipmentStats(
  equippedWeapon: EquippedItem | null,
  equippedArmor: EquippedItem | null,
  equippedAccessory1: EquippedItem | null,
  equippedAccessory2: EquippedItem | null
): TotalEquipmentStats {
  const stats: TotalEquipmentStats = {
    damageBonus: 0,
    critChance: 0,
    defense: 0,
    maxHpBonus: 0,
    attackSpeed: 0,
    coinBonus: 0,
    healBonus: 0,
    lifesteal: 0,
    autoClickRate: 0
  };

  const equippedItems = [equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2];

  for (const item of equippedItems) {
    if (!item?.lootItem?.equipmentStats) continue;

    const baseStats = item.lootItem.equipmentStats;
    const itemTier = item.tier as Tier;

    // Apply tier scaling to each stat individually
    // scaleItemStats() creates a Record<string, number> which we convert to individual stats
    const statsToScale = {
      damageBonus: baseStats.damageBonus || 0,
      critChance: baseStats.critChance || 0,
      defense: baseStats.defense || 0,
      maxHpBonus: baseStats.maxHpBonus || 0,
      attackSpeed: baseStats.attackSpeed || 0,
      coinBonus: baseStats.coinBonus || 0,
      healBonus: baseStats.healBonus || 0,
      lifesteal: baseStats.lifesteal || 0,
      autoClickRate: baseStats.autoClickRate || 0
    };

    const scaledStats = scaleItemStats(statsToScale, itemTier);

    // Apply empowered bonus (+20% to all stats) if item dropped from corrupted monster
    // Round UP for most stats to avoid floats, but keep lifesteal and autoClickRate precise
    let currentStats = { ...scaledStats };
    if (item.isEmpowered) {
      currentStats = {
        damageBonus: Math.ceil(scaledStats.damageBonus * 1.2),
        critChance: Math.ceil(scaledStats.critChance * 1.2),
        defense: Math.ceil(scaledStats.defense * 1.2),
        maxHpBonus: Math.ceil(scaledStats.maxHpBonus * 1.2),
        attackSpeed: Math.ceil(scaledStats.attackSpeed * 1.2),
        coinBonus: Math.ceil(scaledStats.coinBonus * 1.2),
        healBonus: Math.ceil(scaledStats.healBonus * 1.2),
        lifesteal: scaledStats.lifesteal * 1.2, // Keep precise for % calculation
        autoClickRate: scaledStats.autoClickRate * 1.2 // Keep precise for interval calculation
      };
    }

    // Apply inscription bonuses (Phase 3.4: Equipment Customization)
    // Inscriptions add flat bonuses AFTER tier scaling and empowered multipliers
    const inscriptionBonuses = applyInscriptionBonuses(item.prefix, item.suffix);

    // Sum all bonuses to total stats
    stats.damageBonus += currentStats.damageBonus + inscriptionBonuses.damageBonus;
    stats.critChance += currentStats.critChance + inscriptionBonuses.critChance;
    stats.defense += currentStats.defense + inscriptionBonuses.defense;
    stats.maxHpBonus += currentStats.maxHpBonus + inscriptionBonuses.maxHpBonus;
    stats.attackSpeed += currentStats.attackSpeed + inscriptionBonuses.attackSpeed;
    stats.coinBonus += currentStats.coinBonus + inscriptionBonuses.coinBonus;
    stats.healBonus += currentStats.healBonus + inscriptionBonuses.healBonus;
    stats.lifesteal += currentStats.lifesteal; // No inscription type for lifesteal yet
    stats.autoClickRate += currentStats.autoClickRate; // No inscription type for autoClickRate yet
  }

  return stats;
}

/**
 * Apply inscription bonuses from prefix and suffix
 * Phase 3.4: Equipment Customization - Prefix & Suffix System
 *
 * Inscription bonuses are flat additions that stack with equipment stats
 * Order of application: Base → Tier Scaling → Empowered → Inscriptions
 */
function applyInscriptionBonuses(
  prefix?: Inscription,
  suffix?: Inscription
): TotalEquipmentStats {
  const bonuses: TotalEquipmentStats = {
    damageBonus: 0,
    critChance: 0,
    defense: 0,
    maxHpBonus: 0,
    attackSpeed: 0,
    coinBonus: 0,
    healBonus: 0,
    lifesteal: 0,
    autoClickRate: 0
  };

  // Apply prefix inscription bonus
  if (prefix) {
    addInscriptionBonus(bonuses, prefix);
  }

  // Apply suffix inscription bonus
  if (suffix) {
    addInscriptionBonus(bonuses, suffix);
  }

  return bonuses;
}

/**
 * Add a single inscription's bonus to the stats object
 */
function addInscriptionBonus(
  stats: TotalEquipmentStats,
  inscription: Inscription
): void {
  switch (inscription.type) {
    case 'damage':
      stats.damageBonus += inscription.value;
      break;
    case 'critical':
      stats.critChance += inscription.value;
      break;
    case 'protection':
      stats.defense += inscription.value;
      break;
    case 'vitality':
      stats.maxHpBonus += inscription.value;
      break;
    case 'haste':
      stats.attackSpeed += inscription.value;
      break;
    case 'fortune':
      stats.coinBonus += inscription.value;
      break;
    case 'healing':
      stats.healBonus += inscription.value;
      break;
    case 'lifesteal':
      stats.lifesteal += inscription.value;
      break;
    case 'autoclick':
      stats.autoClickRate += inscription.value;
      break;
    default:
      console.warn(`Unknown inscription type: ${inscription.type}`);
  }
}

/**
 * Calculate damage dealt per click with equipment bonuses
 * @param baseDamage - Base damage per click (usually 1)
 * @param damageBonus - Damage bonus from equipment
 * @param critChance - Crit chance percentage (0-100, capped at 100)
 * @param critMultiplier - Crit damage multiplier (default 2.0, increases with excess crit)
 * @returns Total damage dealt (includes crit if triggered)
 */
export function calculateClickDamage(
  baseDamage: number,
  damageBonus: number,
  critChance: number,
  critMultiplier: number = 2.0
): { damage: number; isCrit: boolean } {
  const totalDamage = baseDamage + damageBonus;

  // Roll for crit (crit chance is capped at 100%)
  const critRoll = Math.random() * 100;
  const isCrit = critRoll < Math.min(100, critChance);

  // Crit deals critMultiplier damage (base 2x + excess crit bonus)
  const finalDamage = isCrit ? Math.floor(totalDamage * critMultiplier) : totalDamage;

  return { damage: finalDamage, isCrit };
}

/**
 * Calculate effective monster attack damage after armor reduction
 * Uses diminishing returns formula to prevent defense from becoming too powerful at high tiers
 *
 * Formula: actualReduction% = (defense / (defense + K)) * maxReduction
 * - K = 67 (diminishing returns constant)
 * - maxReduction = 80% (hard cap, ensures 20% minimum damage always gets through)
 *
 * Examples:
 * - 0 defense → 0% reduction
 * - 10 defense → 10.4% reduction
 * - 25 defense → 21.8% reduction
 * - 50 defense → 34.3% reduction
 * - 100 defense → 47.9% reduction
 * - 200 defense → 60% reduction
 * - ∞ defense → approaches 80% reduction
 *
 * @param baseAttackDamage - Monster's base attack damage
 * @param defense - Defense stat from equipment (not directly a percentage)
 * @returns Reduced damage amount (minimum 1)
 */
export function calculateMonsterDamage(
  baseAttackDamage: number,
  defense: number
): number {
  // Diminishing returns formula constants
  const K = 67; // Diminishing returns constant
  const MAX_REDUCTION = 80; // Hard cap at 80% reduction

  // Calculate actual damage reduction percentage with diminishing returns
  const actualReductionPercent = (defense / (defense + K)) * MAX_REDUCTION;

  // Apply reduction to base damage
  const reductionMultiplier = 1 - (actualReductionPercent / 100);
  const reducedDamage = baseAttackDamage * reductionMultiplier;

  // Always deal at least 1 damage
  return Math.max(1, Math.round(reducedDamage));
}

/**
 * Calculate effective monster attack interval with speed bonuses
 * @param baseInterval - Base attack interval in ms (usually 1000)
 * @param attackSpeed - Attack speed bonus (positive = slower attacks)
 * @returns Modified interval in ms
 */
export function calculateMonsterAttackInterval(
  baseInterval: number,
  attackSpeed: number
): number {
  // attackSpeed is a percentage (e.g., 10 = 10% slower attacks = 1100ms)
  const speedMultiplier = 1 + (attackSpeed / 100);
  return Math.round(baseInterval * speedMultiplier);
}
