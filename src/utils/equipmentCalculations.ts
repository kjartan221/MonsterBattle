import type { EquippedItem } from '@/contexts/EquipmentContext';
import { scaleItemStats } from '@/utils/itemTierScaling';
import type { Tier } from '@/lib/biome-config';
import type { Inscription } from '@/lib/types';
import type { EquipmentStats } from '@/lib/loot-table';
import { formatStatValue } from '@/utils/statFormat';

export interface TotalEquipmentStats {
  damageBonus: number;
  critChance: number;
  defense: number;
  maxHpBonus: number;
  attackSpeed: number;
  coinBonus: number;
  healBonus: number;
  lifesteal: number;      // Phase 2.5: % of damage dealt returned as HP (offensive)
  defensiveLifesteal: number; // % of damage taken returned as HP (defensive)
  thorns: number;         // % of damage taken reflected back to monster (uses pre-mitigation damage)
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
    defensiveLifesteal: 0,
    thorns: 0,
    autoClickRate: 0
  };

  const equippedItems = [equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2];

  for (const item of equippedItems) {
    if (!item?.lootItem?.equipmentStats) continue;

    // Delegate per-item math (tier scaling -> empowered -> inscriptions) to the shared helper
    // so gameplay totals and per-item UI displays never drift apart.
    const itemStats = calculateItemStats(
      item.lootItem.equipmentStats,
      item.tier,
      item.isEmpowered,
      item.prefix,
      item.suffix
    );

    // Sum all bonuses to total stats
    stats.damageBonus += itemStats.damageBonus || 0;
    stats.critChance += itemStats.critChance || 0;
    stats.defense += itemStats.defense || 0;
    stats.maxHpBonus += itemStats.maxHpBonus || 0;
    stats.attackSpeed += itemStats.attackSpeed || 0;
    stats.coinBonus += itemStats.coinBonus || 0;
    stats.healBonus += itemStats.healBonus || 0;
    stats.lifesteal += itemStats.lifesteal || 0;
    stats.defensiveLifesteal += itemStats.defensiveLifesteal || 0;
    stats.thorns += itemStats.thorns || 0;
    stats.autoClickRate += itemStats.autoClickRate || 0;
  }

  return stats;
}

/**
 * Single-item PRECISE stats: tier scaling -> empowered (+20%) -> inscriptions.
 * Gameplay source of truth - summed by calculateTotalEquipmentStats. Do NOT
 * round here; rounding belongs only in getDisplayEquipmentStats (UI).
 *
 * Only includes a stat key if the base item has it, or an inscription grants a
 * nonzero bonus for it - preserves the "hide inapplicable stat" UI behavior while
 * still surfacing inscription-only bonuses.
 */
export function calculateItemStats(
  baseStats: EquipmentStats,
  tier: number,
  isEmpowered?: boolean,
  prefix?: Inscription,
  suffix?: Inscription
): EquipmentStats {
  const itemTier = tier as Tier;

  // Same per-item math as the loop above
  const statsToScale = {
    damageBonus: baseStats.damageBonus || 0,
    critChance: baseStats.critChance || 0,
    defense: baseStats.defense || 0,
    maxHpBonus: baseStats.maxHpBonus || 0,
    attackSpeed: baseStats.attackSpeed || 0,
    coinBonus: baseStats.coinBonus || 0,
    healBonus: baseStats.healBonus || 0,
    lifesteal: baseStats.lifesteal || 0,
    defensiveLifesteal: baseStats.defensiveLifesteal || 0,
    thorns: baseStats.thorns || 0,
    autoClickRate: baseStats.autoClickRate || 0
  };

  const scaledStats = scaleItemStats(statsToScale, itemTier);

  // Apply empowered bonus (+20% to all stats) if item dropped from corrupted monster
  // Round UP for most stats to avoid floats, but keep lifesteal/defensiveLifesteal/thorns/autoClickRate precise
  let currentStats = { ...scaledStats };
  if (isEmpowered) {
    currentStats = {
      damageBonus: Math.ceil(scaledStats.damageBonus * 1.2),
      critChance: Math.ceil(scaledStats.critChance * 1.2),
      defense: Math.ceil(scaledStats.defense * 1.2),
      maxHpBonus: Math.ceil(scaledStats.maxHpBonus * 1.2),
      attackSpeed: Math.ceil(scaledStats.attackSpeed * 1.2),
      coinBonus: Math.ceil(scaledStats.coinBonus * 1.2),
      healBonus: Math.ceil(scaledStats.healBonus * 1.2),
      lifesteal: scaledStats.lifesteal * 1.2, // Keep precise for % calculation
      defensiveLifesteal: scaledStats.defensiveLifesteal * 1.2, // Keep precise for % calculation
      thorns: scaledStats.thorns * 1.2, // Keep precise for % calculation
      autoClickRate: scaledStats.autoClickRate * 1.2 // Keep precise for interval calculation
    };
  }

  // Apply inscription bonuses (Phase 3.4: Equipment Customization)
  // Inscriptions add flat bonuses AFTER tier scaling and empowered multipliers
  const inscriptionBonuses = applyInscriptionBonuses(prefix, suffix);

  const result: EquipmentStats = {};
  (Object.keys(statsToScale) as (keyof typeof statsToScale)[]).forEach((key) => {
    const total = currentStats[key] + inscriptionBonuses[key];
    if (baseStats[key] !== undefined || total !== 0) {
      result[key] = total;
    }
  });

  // Resistance stats aren't part of tier/empowered/inscription math (untouched today) - pass through as-is
  if (baseStats.fireResistance !== undefined) result.fireResistance = baseStats.fireResistance;
  if (baseStats.poisonResistance !== undefined) result.poisonResistance = baseStats.poisonResistance;
  if (baseStats.bleedResistance !== undefined) result.bleedResistance = baseStats.bleedResistance;

  return result;
}

/**
 * Single-item DISPLAY stats: same as calculateItemStats but rounded to 2
 * decimals for UI (via formatStatValue). UI-only - never call this for
 * gameplay math. This is the ONE place display rounding happens.
 */
export function getDisplayEquipmentStats(
  baseStats: EquipmentStats,
  tier: number,
  isEmpowered?: boolean,
  prefix?: Inscription,
  suffix?: Inscription
): EquipmentStats {
  const preciseStats = calculateItemStats(baseStats, tier, isEmpowered, prefix, suffix);

  const rounded: EquipmentStats = {};
  (Object.keys(preciseStats) as (keyof EquipmentStats)[]).forEach((key) => {
    const value = preciseStats[key];
    rounded[key] = typeof value === 'number' ? formatStatValue(value) : value;
  });

  return rounded;
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
    defensiveLifesteal: 0,
    thorns: 0,
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
    case 'defensiveLifesteal':
      stats.defensiveLifesteal += inscription.value;
      break;
    case 'thorns':
      stats.thorns += inscription.value;
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
 * Uses diminishing returns formula to prevent attack speed from becoming too powerful at high tiers
 *
 * Formula: actualSlowdown% = (attackSpeed / (attackSpeed + K)) * maxSlowdown
 * - K = 67 (diminishing returns constant, same as defense)
 * - maxSlowdown = 50% (hard cap, prevents monsters from being frozen)
 *
 * Examples:
 * - 0 attackSpeed → 0% slowdown (1000ms)
 * - 10 attackSpeed → ~6.5% slowdown (1065ms)
 * - 25 attackSpeed → ~13.6% slowdown (1136ms)
 * - 50 attackSpeed → ~21.6% slowdown (1216ms)
 * - 100 attackSpeed → ~30% slowdown (1300ms)
 * - 200 attackSpeed → ~40% slowdown (1400ms)
 * - ∞ attackSpeed → approaches 50% slowdown (1500ms max)
 *
 * @param baseInterval - Base attack interval in ms (usually 1000)
 * @param attackSpeed - Attack speed stat from equipment (not directly a percentage)
 * @returns Modified interval in ms
 */
export function calculateMonsterAttackInterval(
  baseInterval: number,
  attackSpeed: number
): number {
  // Diminishing returns formula constants
  const K = 67; // Diminishing returns constant (same as defense)
  const MAX_SLOWDOWN = 50; // Hard cap at 50% slowdown

  // Calculate actual slowdown percentage with diminishing returns
  const actualSlowdownPercent = (attackSpeed / (attackSpeed + K)) * MAX_SLOWDOWN;

  // Apply slowdown to base interval
  const slowdownMultiplier = 1 + (actualSlowdownPercent / 100);
  return Math.round(baseInterval * slowdownMultiplier);
}

/**
 * Calculate effective auto-click rate with diminishing returns
 * Uses diminishing returns formula to prevent autoclick from becoming too powerful at high tiers
 *
 * Formula: effectiveRate = (autoClickRate / (autoClickRate + K)) * maxRate
 * - K = 8 (diminishing returns constant - faster curve than defense)
 * - maxRate = 7 hits/sec (soft cap, prevents trivializing combat)
 *
 * Examples:
 * - 0 autoClickRate → 0 hits/sec
 * - 2 autoClickRate → 1.4 hits/sec (70% efficiency)
 * - 4 autoClickRate → 2.33 hits/sec (58% efficiency)
 * - 8 autoClickRate → 3.5 hits/sec (43.75% efficiency)
 * - 12 autoClickRate → 4.2 hits/sec (35% efficiency)
 * - 16 autoClickRate → 4.67 hits/sec (29% efficiency)
 * - ∞ autoClickRate → approaches 7 hits/sec
 *
 * @param autoClickRate - Raw auto-click rate from equipment (stacks additively)
 * @returns Effective auto-click rate per second (with diminishing returns applied)
 */
export function calculateEffectiveAutoClickRate(
  autoClickRate: number
): number {
  // No autoclick, no effect
  if (autoClickRate <= 0) return 0;

  // Diminishing returns formula constants
  const K = 8; // Diminishing returns constant (faster curve than defense/attackSpeed)
  const MAX_RATE = 7; // Soft cap at 7 hits/sec

  // Calculate effective rate with diminishing returns
  const effectiveRate = (autoClickRate / (autoClickRate + K)) * MAX_RATE;

  return effectiveRate;
}
