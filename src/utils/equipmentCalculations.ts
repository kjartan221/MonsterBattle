import type { EquippedItem } from '@/contexts/EquipmentContext';

export interface TotalEquipmentStats {
  damageBonus: number;
  critChance: number;
  hpReduction: number;
  maxHpBonus: number;
  attackSpeed: number;
  coinBonus: number;
}

/**
 * Calculate total equipment bonuses from all equipped items
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
    coinBonus: 0
  };

  const equippedItems = [equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2];

  for (const item of equippedItems) {
    if (!item?.lootItem?.equipmentStats) continue;

    const itemStats = item.lootItem.equipmentStats;

    stats.damageBonus += itemStats.damageBonus || 0;
    stats.critChance += itemStats.critChance || 0;
    stats.hpReduction += itemStats.hpReduction || 0;
    stats.maxHpBonus += itemStats.maxHpBonus || 0;
    stats.attackSpeed += itemStats.attackSpeed || 0;
    stats.coinBonus += itemStats.coinBonus || 0;
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
