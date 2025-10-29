import { useEffect, useState, useCallback } from 'react';
import type { MonsterFrontend, SpecialAttack } from '@/lib/types';

interface UseSpecialAttacksProps {
  monster: MonsterFrontend | null;
  battleStarted: boolean;
  isSubmitting: boolean;
  onSpecialAttack: (attack: SpecialAttack) => void;
}

interface SpecialAttackCooldowns {
  [attackType: string]: number; // Timestamp of last attack
}

export function useSpecialAttacks({
  monster,
  battleStarted,
  isSubmitting,
  onSpecialAttack
}: UseSpecialAttacksProps) {
  const [cooldowns, setCooldowns] = useState<SpecialAttackCooldowns>({});
  const [lastAttack, setLastAttack] = useState<SpecialAttack | null>(null);

  // Reset cooldowns when monster changes or battle ends
  useEffect(() => {
    if (!monster || !battleStarted) {
      setCooldowns({});
      setLastAttack(null);
    }
  }, [monster, battleStarted]);

  // Check and execute special attacks
  useEffect(() => {
    if (!monster || !battleStarted || isSubmitting || !monster.specialAttacks) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // Check each special attack
      for (const attack of monster.specialAttacks!) {
        const lastAttackTime = cooldowns[attack.type] || 0;
        const timeSinceLastAttack = (now - lastAttackTime) / 1000; // Convert to seconds

        // If cooldown has passed, execute attack
        if (timeSinceLastAttack >= attack.cooldown) {
          console.log(`🎯 Special Attack: ${attack.type} - ${attack.message}`);

          // Update cooldown
          setCooldowns(prev => ({
            ...prev,
            [attack.type]: now
          }));

          // Store last attack for visual feedback
          setLastAttack(attack);

          // Clear visual feedback after 2 seconds
          setTimeout(() => {
            setLastAttack(null);
          }, 2000);

          // Trigger callback
          onSpecialAttack(attack);
        }
      }
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, [monster, battleStarted, isSubmitting, cooldowns, onSpecialAttack]);

  return {
    lastAttack // For visual feedback
  };
}
