import { useEffect, useRef, useState } from 'react';
import type { DebuffEffect } from '@shared/types';
import { battleEvents } from '@/stores/battleEvents';

export interface BattleEffectHandlers {
  /** Player HP sink, after shield absorption. */
  takeDamage: (amount: number) => void | Promise<void>;
  healHealth: (amount: number, maxHpBonus?: number) => void | Promise<void>;
  /** Equipment max-HP bonus, so defensive lifesteal caps at the same ceiling the UI shows. */
  maxHpBonus?: number;
  /** Reflected damage to the monster. */
  onThornsDamage?: (amount: number) => void;
  /** Anti-cheat accounting for defensive lifesteal. */
  onDefensiveLifesteal?: (amount: number) => void;
  /** Monster's on-hit DoT. */
  onDotEffect?: (effect: DebuffEffect) => void;
}

/** How long the monster-attack flash stays lit. */
const ATTACK_FLASH_MS = 300;

/**
 * The single store->React bridge for combat.
 *
 * The swing and DoT loops now live in the scheduler, where they can read live state without a
 * dependency array keeping them fresh - but they cannot reach PlayerContext. Rather than
 * hoisting player HP into the store, they emit what happened and this hook applies it. One
 * subscription replaces the seventeen-dependency effect that used to own the swing.
 *
 * Handlers are read through a ref, so the subscriptions are registered exactly once and a
 * changing `takeDamage` identity never re-registers them. Mount this once per battle screen.
 */
export function useBattleEffects(handlers: BattleEffectHandlers): { isAttacking: boolean } {
  const [isAttacking, setIsAttacking] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const offAttacked = battleEvents.on('monsterAttacked', ({ damage, thornsDamage, lifestealHeal, dotEffect }) => {
      const current = handlersRef.current;

      // Visual feedback: light the flash, and restart its timer if a faster swing lands first.
      setIsAttacking(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setIsAttacking(false), ATTACK_FLASH_MS);

      // Damage first, then the heal: both are functional setState, so this ordering is what
      // lets PlayerContext refuse to heal a player the same swing just killed.
      void current.takeDamage(damage);

      if (lifestealHeal > 0) {
        void current.healHealth(lifestealHeal, current.maxHpBonus);
        current.onDefensiveLifesteal?.(lifestealHeal);
      }

      if (thornsDamage > 0) current.onThornsDamage?.(thornsDamage);
      if (dotEffect) current.onDotEffect?.(dotEffect);
    });

    const offDotTicked = battleEvents.on('dotTicked', ({ damage }) => {
      void handlersRef.current.takeDamage(damage);
    });

    return () => {
      offAttacked();
      offDotTicked();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return { isAttacking };
}
