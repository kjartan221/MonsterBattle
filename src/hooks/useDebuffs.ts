import { useEffect, useState, useCallback } from 'react';
import type { DebuffEffect, ActiveDebuff, DebuffType } from '@/lib/types';
import { Buff, BuffType } from '@/types/buffs';

interface UseDebuffsProps {
  maxHP: number;                                    // Current max HP of the target
  takeDamage: (amount: number) => Promise<void>;   // Function to apply damage
  isActive: boolean;                                // Whether debuffs should tick (battle active)
  activeBuffs?: Buff[];                             // Player buffs (for calculating resistances)
}

/**
 * Manages active debuffs (DoTs and status effects)
 * Works for both player and monster debuffs
 *
 * @example Player debuffs
 * const { activeDebuffs, applyDebuff } = useDebuffs({
 *   maxHP: playerStats.maxHealth,
 *   takeDamage: playerTakeDamage,
 *   isActive: battleActive
 * });
 *
 * @example Monster debuffs
 * const { activeDebuffs, applyDebuff } = useDebuffs({
 *   maxHP: monster.clicksRequired,
 *   takeDamage: applyMonsterDamage,
 *   isActive: !monster.isDefeated
 * });
 */
export function useDebuffs({ maxHP, takeDamage, isActive, activeBuffs = [] }: UseDebuffsProps) {
  const [activeDebuffs, setActiveDebuffs] = useState<ActiveDebuff[]>([]);

  /**
   * Apply a new debuff with stacking and diminishing returns
   * Stacking formula:
   * - Stack 1: 100% damage (base amount)
   * - Stack 2: 75% damage (diminishing)
   * - Stack 3: 50% damage (further diminishing)
   * - Max 3 stacks
   *
   * Example: Poison at 2% base
   * - 1 stack: 2% damage
   * - 2 stacks: 2% + 1.5% = 3.5% total
   * - 3 stacks: 2% + 1.5% + 1% = 4.5% total
   */
  const applyDebuff = useCallback((effect: DebuffEffect, appliedBy?: string) => {
    const MAX_STACKS = 3;
    const STACK_MULTIPLIERS = [1.0, 0.75, 0.5]; // Diminishing returns per stack

    // Check current stack count for this debuff type
    const currentStacks = activeDebuffs.filter(d => d.type === effect.type).length;

    if (currentStacks >= MAX_STACKS) {
      console.log(`⚠️ ${effect.type} already at max stacks (${MAX_STACKS}), cannot apply more`);
      return false;
    }

    // Roll for apply chance
    const applyChance = effect.applyChance ?? 100;
    const roll = Math.random() * 100;

    if (roll > applyChance) {
      console.log(`❌ Debuff ${effect.type} failed to apply (${roll.toFixed(1)}% > ${applyChance}%)`);
      return false;
    }

    // Apply diminishing returns based on current stack count
    const stackMultiplier = STACK_MULTIPLIERS[currentStacks];
    const adjustedDamage = effect.damageAmount * stackMultiplier;

    // Create active debuff with adjusted damage
    const newDebuff: ActiveDebuff = {
      ...effect,
      damageAmount: adjustedDamage, // Apply diminishing returns
      id: `${effect.type}-${Date.now()}-${Math.random()}`,
      startTime: Date.now(),
      appliedBy,
      targetMaxHP: maxHP
    };

    setActiveDebuffs(prev => [...prev, newDebuff]);
    console.log(`✅ Applied ${effect.type} debuff (stack ${currentStacks + 1}/${MAX_STACKS}): ${adjustedDamage.toFixed(2)}${effect.damageType === 'percentage' ? '%' : ''} damage (${(stackMultiplier * 100).toFixed(0)}% effectiveness)`);

    return true;
  }, [maxHP, activeDebuffs]);

  /**
   * Remove expired debuffs (without useCallback to avoid dependency issues)
   */
  const removeExpiredDebuffs = () => {
    setActiveDebuffs(prev => {
      const now = Date.now();
      const remaining = prev.filter(d => (now - d.startTime) < d.duration);
      const expired = prev.length - remaining.length;

      if (expired > 0) {
        console.log(`⏱️ Removed ${expired} expired debuff(s)`);
      }

      return remaining;
    });
  };

  /**
   * Calculate actual damage from debuff (with resistance reduction)
   */
  const calculateDebuffDamage = useCallback((debuff: ActiveDebuff): number => {
    // Calculate base damage
    let damage: number;
    if (debuff.damageType === 'percentage') {
      // Percentage of target's max HP at time of application
      damage = Math.ceil((debuff.damageAmount / 100) * debuff.targetMaxHP);
    } else {
      // Flat damage
      damage = debuff.damageAmount;
    }

    // Apply DoT resistance from player buffs
    let resistancePercent = 0;

    // Map debuff types to resistance buff types
    const resistanceMap: Record<string, BuffType> = {
      'burn': BuffType.FIRE_RESISTANCE,
      'poison': BuffType.POISON_RESISTANCE,
      'bleed': BuffType.BLEED_RESISTANCE
    };

    const resistanceType = resistanceMap[debuff.type];
    if (resistanceType) {
      // Sum all resistance buffs of this type
      resistancePercent = activeBuffs
        .filter(buff => buff.buffType === resistanceType)
        .reduce((sum, buff) => sum + buff.value, 0);

      // Cap resistance at 100% (complete immunity)
      resistancePercent = Math.min(100, resistancePercent);

      if (resistancePercent > 0) {
        const originalDamage = damage;
        damage = Math.floor(damage * (1 - resistancePercent / 100));
        console.log(`🛡️ ${debuff.type} resistance: ${resistancePercent}% (${originalDamage} → ${damage} damage)`);
      }
    }

    return Math.max(1, damage); // Minimum 1 damage
  }, [activeBuffs]);

  /**
   * Tick all active DoT debuffs
   */
  useEffect(() => {
    if (!isActive || activeDebuffs.length === 0) return;

    // Remove expired debuffs at the start of each effect run
    const now = Date.now();
    const activeNonExpired = activeDebuffs.filter(d => (now - d.startTime) < d.duration);

    if (activeNonExpired.length !== activeDebuffs.length) {
      // Some debuffs expired, update state and let effect re-run
      setActiveDebuffs(activeNonExpired);
      return;
    }

    // Create individual intervals for each debuff (to support different tick rates)
    const intervals: NodeJS.Timeout[] = [];

    activeNonExpired.forEach(debuff => {
      // Only tick damaging debuffs
      if (debuff.damageAmount > 0) {
        const interval = setInterval(async () => {
          // Check if debuff is still valid (not expired)
          const elapsed = Date.now() - debuff.startTime;
          if (elapsed >= debuff.duration) {
            clearInterval(interval);
            removeExpiredDebuffs();
            return;
          }

          const damage = calculateDebuffDamage(debuff);
          await takeDamage(damage);
          console.log(`💀 ${debuff.type.toUpperCase()} tick: ${damage} damage (${debuff.damageType})`);
        }, debuff.tickInterval);

        intervals.push(interval);
      }
    });

    return () => {
      intervals.forEach(interval => clearInterval(interval));
    };
  }, [activeDebuffs, isActive, takeDamage, calculateDebuffDamage]);

  /**
   * Clear all debuffs (e.g., when battle ends or player uses cleanse)
   */
  const clearDebuffs = useCallback(() => {
    setActiveDebuffs([]);
    console.log('🧹 Cleared all debuffs');
  }, []);

  /**
   * Remove specific debuff by ID
   */
  const removeDebuff = useCallback((debuffId: string) => {
    setActiveDebuffs(prev => prev.filter(d => d.id !== debuffId));
    console.log(`🗑️ Removed debuff ${debuffId}`);
  }, []);

  /**
   * Check if a specific debuff type is active
   */
  const hasDebuff = useCallback((type: DebuffType): boolean => {
    return activeDebuffs.some(d => d.type === type);
  }, [activeDebuffs]);

  /**
   * Get count of active debuffs of a specific type
   */
  const getDebuffCount = useCallback((type: DebuffType): number => {
    return activeDebuffs.filter(d => d.type === type).length;
  }, [activeDebuffs]);

  /**
   * Get remaining duration for a specific debuff type (returns longest duration)
   */
  const getDebuffDuration = useCallback((type: DebuffType): number => {
    const debuffsOfType = activeDebuffs.filter(d => d.type === type);
    if (debuffsOfType.length === 0) return 0;

    const now = Date.now();
    const remainingDurations = debuffsOfType.map(d =>
      Math.max(0, d.duration - (now - d.startTime))
    );

    return Math.max(...remainingDurations);
  }, [activeDebuffs]);

  return {
    activeDebuffs,
    applyDebuff,
    clearDebuffs,
    removeDebuff,
    hasDebuff,
    getDebuffCount,
    getDebuffDuration
  };
}
