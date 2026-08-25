import { useEffect, useState, useCallback, useRef } from 'react';
import type { MonsterFrontend } from '@shared/types';

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
        lastInitializedMonsterIdRef.current = null;
        setCurrentHP(0);
        setMaxHP(0);
      }
      return;
    }

    // Keyed on clicksRequired too: the cheat penalty doubles a monster's HP in place, and
    // keying on identity alone left the bar pinned at its depleted value.
    const monsterId = `${monster._id?.toString() || monster.name}:${monster.clicksRequired}`;

    // Skip if already initialized this monster
    if (lastInitializedMonsterIdRef.current === monsterId) {
      return;
    }

    const totalHP = monster.clicksRequired;

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
