import { useEffect, useState, useCallback, useRef } from 'react';
import type { DebuffEffect, ActiveDebuff, DebuffType } from '@shared/types';
import { Buff, BuffType } from '@/types/buffs';
import { battleScheduler } from '@/stores/battleScheduler';
import { battleEvents } from '@/stores/battleEvents';

// Only damage-over-time types deal tick damage; stat/status modifiers
// (defense_reduction, slow, stun, freeze) are read elsewhere, not ticked.
const DOT_TYPES: DebuffType[] = ['poison', 'burn', 'bleed'];

// One scheduler registration pair per debuff: a repeating tick and an absolute expiry.
const dotKey = (id: string) => `debuffDot:${id}`;
const expiryKey = (id: string) => `debuffExpiry:${id}`;

interface UseDebuffsProps {
  maxHP: number;                                    // Current max HP of the target
  takeDamage: (amount: number) => Promise<void>;   // Retained for the API's shape; player DoT is applied via the dotTicked event
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
 *
 * @remarks The player path no longer calls `takeDamage` here: the tick handler runs in the
 * scheduler, outside React, so it emits `dotTicked` and useBattleEffects applies the damage.
 */
export function useDebuffs({ maxHP, isActive, activeBuffs = [] }: UseDebuffsProps) {
  const [activeDebuffs, setActiveDebuffs] = useState<ActiveDebuff[]>([]);

  // Scheduler handlers outlive the render that registered them, so everything they read that
  // can change mid-battle reaches them through a ref instead of a captured closure.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const calculateDebuffDamageRef = useRef<(debuff: ActiveDebuff) => number>(() => 0);
  const activeDebuffsRef = useRef<ActiveDebuff[]>([]);
  activeDebuffsRef.current = activeDebuffs;

  const cancelDebuffTimers = useCallback((debuffId: string) => {
    battleScheduler.cancel(dotKey(debuffId));
    battleScheduler.cancel(expiryKey(debuffId));
  }, []);

  /**
   * Registers a debuff's tick loop and expiry deadline, once, when it lands. The loop reads
   * live state at fire time - re-registering a `repeat` would reset its anchor.
   */
  const scheduleDebuff = useCallback((debuff: ActiveDebuff) => {
    battleScheduler.at(expiryKey(debuff.id), debuff.expiresAt, () => {
      battleScheduler.cancel(dotKey(debuff.id));
      setActiveDebuffs(prev => prev.filter(d => d.id !== debuff.id));
    });

    if (!DOT_TYPES.includes(debuff.type) || debuff.damageAmount <= 0) return;

    battleScheduler.repeat(dotKey(debuff.id), () => debuff.tickInterval, () => {
      // A DoT deals damage, so it pauses with the battle rather than ticking through
      // submission. The expiry deadline above is not gated: it only releases state.
      if (!isActiveRef.current) return;
      if (Date.now() >= debuff.expiresAt) return; // the expiry deadline owns the cleanup

      // Player HP lives in PlayerContext, out of this handler's reach: describe the tick and
      // let useBattleEffects apply it.
      battleEvents.emit('dotTicked', { damage: calculateDebuffDamageRef.current(debuff) });
    });
  }, []);

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
      return false;
    }

    // Roll for apply chance
    const applyChance = effect.applyChance ?? 100;
    const roll = Math.random() * 100;

    if (roll > applyChance) {
      return false;
    }

    // Apply diminishing returns based on current stack count
    const stackMultiplier = STACK_MULTIPLIERS[currentStacks];
    const adjustedDamage = effect.damageAmount * stackMultiplier;

    // Create active debuff with adjusted damage
    const startTime = Date.now();
    const newDebuff: ActiveDebuff = {
      ...effect,
      damageAmount: adjustedDamage, // Apply diminishing returns
      id: `${effect.type}-${Date.now()}-${Math.random()}`,
      startTime,
      expiresAt: startTime + effect.duration,
      appliedBy,
      targetMaxHP: maxHP
    };

    setActiveDebuffs(prev => [...prev, newDebuff]);
    scheduleDebuff(newDebuff);

    return true;
  }, [maxHP, activeDebuffs, scheduleDebuff]);

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
      }
    }

    return Math.max(1, damage); // Minimum 1 damage
  }, [activeBuffs]);

  // Resistances change as buffs come and go; the tick handler reads the latest calculator.
  calculateDebuffDamageRef.current = calculateDebuffDamage;

  // Nothing sweeps here any more - each debuff owns a tick loop and an expiry deadline from
  // the moment it lands. All that remains is making sure none of them outlive the hook.
  useEffect(() => {
    return () => {
      activeDebuffsRef.current.forEach(debuff => cancelDebuffTimers(debuff.id));
    };
  }, [cancelDebuffTimers]);

  /**
   * Clear all debuffs (battle end, or a cleanse).
   *
   * CALLER CONTRACT: must run before the battle leaves an attempt-bearing phase. That
   * transition calls `battleScheduler.clearAll()`, which cancels a debuff's timers while its
   * `activeDebuffs` entry survives - leaving it stuck: never ticking, never expiring, and for
   * `defense_reduction` a permanent stat penalty. The old gated sweep used to self-heal this.
   */
  const clearDebuffs = useCallback(() => {
    activeDebuffsRef.current.forEach(debuff => cancelDebuffTimers(debuff.id));
    setActiveDebuffs([]);
  }, [cancelDebuffTimers]);

  /**
   * Remove specific debuff by ID
   */
  const removeDebuff = useCallback((debuffId: string) => {
    cancelDebuffTimers(debuffId);
    setActiveDebuffs(prev => prev.filter(d => d.id !== debuffId));
  }, [cancelDebuffTimers]);

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
