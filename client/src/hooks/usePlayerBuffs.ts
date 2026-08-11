import { useState, useEffect, useCallback, useRef } from 'react';
import { Buff, BuffType, BuffSource } from '@/types/buffs';
import toast from 'react-hot-toast';

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

  // Auto-remove expired buffs
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveBuffs(prev => {
        const stillActive = prev.filter(buff => {
          const expired = buff.duration > 0 && now >= buff.expiresAt;
          if (expired && buff.name) {
            toast(`${buff.name} expired`, { icon: '⏰', duration: 2000 });
          }
          return !expired;
        });
        return stillActive;
      });
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, []);

  /**
   * Apply a new buff to the player
   */
  const applyBuff = useCallback((buffData: Omit<Buff, 'buffId' | 'appliedAt' | 'expiresAt'>) => {
    const now = Date.now();
    const buffId = `${buffData.buffType}_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = buffData.duration > 0 ? now + (buffData.duration * 1000) : Infinity;

    const newBuff: Buff = {
      ...buffData,
      buffId,
      appliedAt: now,
      expiresAt
    };

    setActiveBuffs(prev => [...prev, newBuff]);

    // Show toast notification
    if (newBuff.name) {
      const durationText = newBuff.duration > 0 ? ` (${newBuff.duration}s)` : '';
      toast.success(`${newBuff.icon || '✨'} ${newBuff.name}${durationText}`, { duration: 3000 });
    }
  }, []);

  /**
   * Remove a specific buff by ID
   */
  const removeBuff = useCallback((buffId: string) => {
    setActiveBuffs(prev => prev.filter(buff => buff.buffId !== buffId));
  }, []);

  /**
   * Clear all active buffs
   */
  const clearBuffs = useCallback(() => {
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
