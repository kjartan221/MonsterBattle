import { useEffect, useState, useCallback, useRef } from 'react';
import type { MonsterFrontend } from '@/lib/types';

interface UseMonsterHPProps {
  monster: MonsterFrontend | null;
}

interface MonsterHPData {
  currentHP: number;
  maxHP: number;
  damageHP: (damage: number) => void;
}

/**
 * Simple HP tracking for regular (non-boss) monsters
 *
 * Features:
 * - Tracks current HP and max HP
 * - Provides damageHP() function to apply damage
 * - Automatically resets when new monster loads
 * - No phase logic, no special attacks - just HP tracking
 *
 * For boss monsters with phases, use useBossPhases instead.
 */
export function useMonsterHP({ monster }: UseMonsterHPProps): MonsterHPData {
  const [currentHP, setCurrentHP] = useState<number>(0);
  const [maxHP, setMaxHP] = useState<number>(0);
  const lastInitializedMonsterIdRef = useRef<string | null>(null);

  // Initialize HP when monster loads
  useEffect(() => {
    if (!monster) {
      // Only reset if we haven't already reset
      if (lastInitializedMonsterIdRef.current !== null) {
        console.log('[useMonsterHP] No monster, resetting state');
        lastInitializedMonsterIdRef.current = null;
        setCurrentHP(0);
        setMaxHP(0);
      }
      return;
    }

    const monsterId = monster._id?.toString() || monster.name;

    // Skip if already initialized this monster
    if (lastInitializedMonsterIdRef.current === monsterId) {
      return;
    }

    const totalHP = monster.clicksRequired;
    console.log(`[useMonsterHP] Initializing ${monster.name} with ${totalHP} HP`);

    setMaxHP(totalHP);
    setCurrentHP(totalHP);
    lastInitializedMonsterIdRef.current = monsterId;
  }, [monster]);

  // Damage the monster's HP
  const damageHP = useCallback((damage: number) => {
    setCurrentHP(prev => {
      const newHP = Math.max(0, prev - damage);
      return newHP;
    });
  }, []);

  return {
    currentHP,
    maxHP,
    damageHP
  };
}
