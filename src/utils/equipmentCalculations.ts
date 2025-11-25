import type { EquippedItem } from '@/contexts/EquipmentContext';
import { scaleItemStats } from '@/utils/itemTierScaling';
import type { Tier } from '@/lib/biome-config';

export interface TotalEquipmentStats {
  damageBonus: number;
  critChance: number;
  hpReduction: number;
  maxHpBonus: number;
  attackSpeed: number;
  coinBonus: number;
  healBonus: number;
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
    hpReduction: 0,
    maxHpBonus: 0,
    attackSpeed: 0,
    coinBonus: 0,
    healBonus: 0
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
      hpReduction: baseStats.hpReduction || 0,
      maxHpBonus: baseStats.maxHpBonus || 0,
      attackSpeed: baseStats.attackSpeed || 0,
      coinBonus: baseStats.coinBonus || 0,
      healBonus: baseStats.healBonus || 0
    };

    const scaledStats = scaleItemStats(statsToScale, itemTier);

    // Apply empowered bonus (+20% to all stats) if item dropped from corrupted monster
    // Always round UP for empowered stats to avoid float numbers
    if (item.isEmpowered) {
      stats.damageBonus += Math.ceil(scaledStats.damageBonus * 1.2);
      stats.critChance += Math.ceil(scaledStats.critChance * 1.2);
      stats.hpReduction += Math.ceil(scaledStats.hpReduction * 1.2);
      stats.maxHpBonus += Math.ceil(scaledStats.maxHpBonus * 1.2);
      stats.attackSpeed += Math.ceil(scaledStats.attackSpeed * 1.2);
      stats.coinBonus += Math.ceil(scaledStats.coinBonus * 1.2);
      stats.healBonus += Math.ceil(scaledStats.healBonus * 1.2);
    } else {
      // No empowered bonus, just sum the scaled stats
      stats.damageBonus += scaledStats.damageBonus;
      stats.critChance += scaledStats.critChance;
      stats.hpReduction += scaledStats.hpReduction;
      stats.maxHpBonus += scaledStats.maxHpBonus;
      stats.attackSpeed += scaledStats.attackSpeed;
      stats.coinBonus += scaledStats.coinBonus;
      stats.healBonus += scaledStats.healBonus;
    }
  }

  return stats;
}

/**
 * Calculate damage dealt per click with equipment bonuses
 * @param baseDamage - Base damage per click (usually 1)
 * @param damageBonus - Damage bonus from equipment
 * @param critChance - Crit chance percentage (0-100)
 * @returns Total damage dealt (includes crit if triggered)
 */
export function calculateClickDamage(
  baseDamage: number,
  damageBonus: number,
  critChance: number
): { damage: number; isCrit: boolean } {
  const totalDamage = baseDamage + damageBonus;

  // Roll for crit
  const critRoll = Math.random() * 100;
  const isCrit = critRoll < critChance;

  // Crit deals 2x damage
  const finalDamage = isCrit ? totalDamage * 2 : totalDamage;

  return { damage: finalDamage, isCrit };
}

/**
 * Calculate effective monster attack damage after armor reduction
 * @param baseAttackDamage - Monster's base attack damage
 * @param hpReduction - HP reduction from armor (percentage)
 * @returns Reduced damage amount
 */
export function calculateMonsterDamage(
  baseAttackDamage: number,
  hpReduction: number
): number {
  // hpReduction is a percentage (e.g., 10 = 10% reduction)
  const reductionMultiplier = 1 - (hpReduction / 100);
  return Math.max(1, Math.round(baseAttackDamage * reductionMultiplier));
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
