import { useEffect, useState, useCallback } from 'react';
import type { DebuffEffect, ActiveDebuff, DebuffType } from '@/lib/types';

interface UseDebuffsProps {
  maxHP: number;                                    // Current max HP of the target
  takeDamage: (amount: number) => Promise<void>;   // Function to apply damage
  isActive: boolean;                                // Whether debuffs should tick (battle active)
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
export function useDebuffs({ maxHP, takeDamage, isActive }: UseDebuffsProps) {
  const [activeDebuffs, setActiveDebuffs] = useState<ActiveDebuff[]>([]);

  /**
   * Apply a new debuff
   * Checks apply chance and adds debuff to active list
   */
  const applyDebuff = useCallback((effect: DebuffEffect, appliedBy?: string) => {
    // Roll for apply chance
    const applyChance = effect.applyChance ?? 100;
    const roll = Math.random() * 100;

    if (roll > applyChance) {
      console.log(`❌ Debuff ${effect.type} failed to apply (${roll.toFixed(1)}% > ${applyChance}%)`);
      return false;
    }

    // Create active debuff
    const newDebuff: ActiveDebuff = {
      ...effect,
      id: `${effect.type}-${Date.now()}-${Math.random()}`,
      startTime: Date.now(),
      appliedBy,
      targetMaxHP: maxHP
    };

    setActiveDebuffs(prev => [...prev, newDebuff]);
    console.log(`✅ Applied ${effect.type} debuff: ${effect.damageAmount}${effect.damageType === 'percentage' ? '%' : ''} damage every ${effect.tickInterval}ms for ${effect.duration}ms`);

    return true;
  }, [maxHP]);

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
   * Calculate actual damage from debuff
   */
  const calculateDebuffDamage = useCallback((debuff: ActiveDebuff): number => {
    if (debuff.damageType === 'percentage') {
      // Percentage of target's max HP at time of application
      const damage = Math.ceil((debuff.damageAmount / 100) * debuff.targetMaxHP);
      return Math.max(1, damage); // Minimum 1 damage
    } else {
      // Flat damage
      return debuff.damageAmount;
    }
  }, []);

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
