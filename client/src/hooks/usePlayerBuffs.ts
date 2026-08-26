import { useState, useEffect, useCallback, useRef } from 'react';
import { Buff, BuffType, BuffSource } from '@/types/buffs';
import { pruneExpiredBuffs } from '@/utils/buffExpiry';
import { battleScheduler } from '@/stores/battleScheduler';
import { useBattleStore } from '@/stores/battleStore';
import toast from 'react-hot-toast';

/** One scheduler key per buff, so expiry is a deadline rather than a 2Hz sweep. */
const expiryKey = (buffId: string) => `buff:${buffId}`;

interface UsePlayerBuffsResult {
  activeBuffs: Buff[];
  applyBuff: (buff: Omit<Buff, 'buffId' | 'appliedAt' | 'expiresAt'>) => void;
  removeBuff: (buffId: string) => void;
  clearBuffs: () => void;
  hasBuffType: (buffType: BuffType) => boolean;
  getBuffValue: (buffType: BuffType) => number;
  getTotalDamageBoost: () => number;
  getTotalCritBoost: () => number;
  getShieldHP: () => number;
  damageShield: (amount: number) => number; // Returns damage that went through shield
}

/**
 * Hook to manage player buffs
 * Handles temporary and permanent buffs from spells, equipment, and consumables
 *
 * Features:
 * - Auto-expiration based on duration
 * - Stacking buffs (multiple buffs of same type add together)
 * - Shield HP tracking
 * - Toast notifications for buff application/expiration
 */
export function usePlayerBuffs(): UsePlayerBuffsResult {
  const [activeBuffs, setActiveBuffs] = useState<Buff[]>([]);
  const buffsRef = useRef<Buff[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    buffsRef.current = activeBuffs;
  }, [activeBuffs]);

  // One deadline per buff rather than a 500ms sweep, so an idle battle costs nothing.
  // pruneExpiredBuffs returns the same array reference when nothing expired, so a spurious
  // wake bails out of setState.
  const sweepExpired = useCallback(() => {
    const { buffs, expired } = pruneExpiredBuffs(buffsRef.current, Date.now());
    if (expired.length === 0) return;

    // Advance the ref immediately: two deadlines can land in the same tick, and the second
    // handler must not sweep a list that predates the first.
    buffsRef.current = buffs;
    expired.forEach(buff => battleScheduler.cancel(expiryKey(buff.buffId)));

    setActiveBuffs(buffs);
    expired.forEach(buff => {
      if (buff.name) toast(`${buff.name} expired`, { icon: '⏰', duration: 2000 });
    });
  }, []);

  const scheduleExpiry = useCallback((buff: Buff) => {
    if (buff.durationMs <= 0 || !Number.isFinite(buff.expiresAt)) return; // permanent
    battleScheduler.at(expiryKey(buff.buffId), buff.expiresAt, sweepExpired);
  }, [sweepExpired]);

  // Buffs outlive an attempt, but the scheduler's lifetime clears every registration when the
  // battle ends. Re-arm after, keyed on phase so this lands on the commit following the clear.
  // `at` takes an absolute deadline, so re-registering is idempotent (unlike `repeat`).
  const phase = useBattleStore(store => store.state.phase);
  useEffect(() => {
    activeBuffs.forEach(scheduleExpiry);
  }, [activeBuffs, phase, scheduleExpiry]);

  /**
   * Apply a new buff to the player
   */
  const applyBuff = useCallback((buffData: Omit<Buff, 'buffId' | 'appliedAt' | 'expiresAt'>) => {
    const now = Date.now();
    const buffId = `${buffData.buffType}_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = buffData.durationMs > 0 ? now + buffData.durationMs : Infinity;

    const newBuff: Buff = {
      ...buffData,
      buffId,
      appliedAt: now,
      expiresAt
    };

    setActiveBuffs(prev => [...prev, newBuff]);
    scheduleExpiry(newBuff);

    // Show toast notification
    if (newBuff.name) {
      const durationText = newBuff.durationMs > 0 ? ` (${newBuff.durationMs / 1000}s)` : '';
      toast.success(`${newBuff.icon || '✨'} ${newBuff.name}${durationText}`, { duration: 3000 });
    }
  }, [scheduleExpiry]);

  /**
   * Remove a specific buff by ID
   */
  const removeBuff = useCallback((buffId: string) => {
    battleScheduler.cancel(expiryKey(buffId));
    setActiveBuffs(prev => prev.filter(buff => buff.buffId !== buffId));
  }, []);

  /**
   * Clear all active buffs
   */
  const clearBuffs = useCallback(() => {
    buffsRef.current.forEach(buff => battleScheduler.cancel(expiryKey(buff.buffId)));
    setActiveBuffs([]);
  }, []);

  /**
   * Check if player has any buff of a specific type
   */
  const hasBuffType = useCallback((buffType: BuffType): boolean => {
    return buffsRef.current.some(buff => buff.buffType === buffType);
  }, []);

  /**
   * Get total value for a specific buff type (stacks all buffs of that type)
   */
  const getBuffValue = useCallback((buffType: BuffType): number => {
    return buffsRef.current
      .filter(buff => buff.buffType === buffType)
      .reduce((sum, buff) => sum + buff.value, 0);
  }, []);

  /**
   * Get total damage boost from all damage buffs
   */
  const getTotalDamageBoost = useCallback((): number => {
    const flatBoost = getBuffValue(BuffType.DAMAGE_BOOST);
    const multBoost = getBuffValue(BuffType.DAMAGE_MULT);
    return flatBoost + multBoost; // Multiplier handled in damage calculation
  }, [getBuffValue]);

  /**
   * Get total crit chance boost
   */
  const getTotalCritBoost = useCallback((): number => {
    return getBuffValue(BuffType.CRIT_BOOST);
  }, [getBuffValue]);

  /**
   * Get current shield HP
   */
  const getShieldHP = useCallback((): number => {
    return getBuffValue(BuffType.SHIELD);
  }, [getBuffValue]);

  /**
   * Apply damage to shield buffs, absorbing as much as possible
   * @param amount - Damage to absorb
   * @returns Damage that wasn't absorbed (0 if fully absorbed)
   */
  const damageShield = useCallback((amount: number): number => {
    let remainingDamage = amount;

    // Get all shield buffs sorted by expiry time (oldest first to consume them in order)
    const shieldBuffs = buffsRef.current
      .filter(buff => buff.buffType === BuffType.SHIELD)
      .sort((a, b) => a.expiresAt - b.expiresAt);

    if (shieldBuffs.length === 0) {
      return amount; // No shield, all damage goes through
    }

    // Track which buffs to update/remove
    const updatedBuffIds = new Set<string>();
    const removedBuffIds = new Set<string>();

    for (const shield of shieldBuffs) {
      if (remainingDamage <= 0) break;

      if (shield.value >= remainingDamage) {
        // Shield absorbs all remaining damage
        shield.value -= remainingDamage;
        remainingDamage = 0;

        if (shield.value <= 0) {
          // Shield depleted, mark for removal
          removedBuffIds.add(shield.buffId);
          if (shield.name) {
            toast('🛡️ Shield depleted', { duration: 2000 });
          }
        } else {
          // Shield still has HP, mark for update
          updatedBuffIds.add(shield.buffId);
        }
      } else {
        // Shield absorbs partial damage and breaks
        remainingDamage -= shield.value;
        shield.value = 0;
        removedBuffIds.add(shield.buffId);
        if (shield.name) {
          toast('🛡️ Shield broken!', { duration: 2000 });
        }
      }
    }

    // A depleted shield is gone for good; drop its expiry deadline with it.
    removedBuffIds.forEach(buffId => battleScheduler.cancel(expiryKey(buffId)));

    // Apply updates to state
    setActiveBuffs(prev => {
      return prev
        .filter(buff => !removedBuffIds.has(buff.buffId))
        .map(buff => {
          if (updatedBuffIds.has(buff.buffId)) {
            // Find the updated value from shieldBuffs
            const updatedShield = shieldBuffs.find(s => s.buffId === buff.buffId);
            return updatedShield ? { ...buff, value: updatedShield.value } : buff;
          }
          return buff;
        });
    });

    return Math.max(0, remainingDamage);
  }, []);

  return {
    activeBuffs,
    applyBuff,
    removeBuff,
    clearBuffs,
    hasBuffType,
    getBuffValue,
    getTotalDamageBoost,
    getTotalCritBoost,
    getShieldHP,
    damageShield
  };
}
