import type { EquippedItem } from '@/contexts/EquipmentContext';
import { scaleItemStats } from '@/utils/itemTierScaling';
import type { Tier } from '@/lib/biome-config';

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
    // Always round UP for empowered stats to avoid float numbers
    if (item.isEmpowered) {
      stats.damageBonus += Math.ceil(scaledStats.damageBonus * 1.2);
      stats.critChance += Math.ceil(scaledStats.critChance * 1.2);
      stats.defense += Math.ceil(scaledStats.defense * 1.2);
      stats.maxHpBonus += Math.ceil(scaledStats.maxHpBonus * 1.2);
      stats.attackSpeed += Math.ceil(scaledStats.attackSpeed * 1.2);
      stats.coinBonus += Math.ceil(scaledStats.coinBonus * 1.2);
      stats.healBonus += Math.ceil(scaledStats.healBonus * 1.2);
      stats.lifesteal += Math.ceil(scaledStats.lifesteal * 1.2);
      stats.autoClickRate += Math.ceil(scaledStats.autoClickRate * 1.2);
    } else {
      // No empowered bonus, just sum the scaled stats
      stats.damageBonus += scaledStats.damageBonus;
      stats.critChance += scaledStats.critChance;
      stats.defense += scaledStats.defense;
      stats.maxHpBonus += scaledStats.maxHpBonus;
      stats.attackSpeed += scaledStats.attackSpeed;
      stats.coinBonus += scaledStats.coinBonus;
      stats.healBonus += scaledStats.healBonus;
      stats.lifesteal += scaledStats.lifesteal;
      stats.autoClickRate += scaledStats.autoClickRate;
    }
  }

  return stats;
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
  const finalDamage = isCrit ? totalDamage * critMultiplier : totalDamage;

  return { damage: finalDamage, isCrit };
}

/**
 * Calculate effective monster attack damage after armor reduction
 * @param baseAttackDamage - Monster's base attack damage
 * @param defense - Defense from armor (percentage damage reduction)
 * @returns Reduced damage amount
 */
export function calculateMonsterDamage(
  baseAttackDamage: number,
  defense: number
): number {
  // defense is a percentage (e.g., 10 = 10% reduction)
  const reductionMultiplier = 1 - (defense / 100);
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
