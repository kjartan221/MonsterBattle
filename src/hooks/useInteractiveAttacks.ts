import { useState, useCallback, useEffect } from 'react';
import type { InteractiveAttack } from '@/lib/types';

interface UseInteractiveAttacksProps {
  onImpact: (damage: number, visualEffect?: string) => void; // Callback when attack impacts
}

export function useInteractiveAttacks({ onImpact }: UseInteractiveAttacksProps) {
  const [attacks, setAttacks] = useState<InteractiveAttack[]>([]);

  // Add a new interactive attack
  const spawnAttack = useCallback((
    name: string,
    maxHP: number,
    damage: number,
    impactDelay: number,
    visualEffect?: string,
    imageUrl?: string
  ) => {
    const attackId = `attack-${Date.now()}-${Math.random()}`;
    const newAttack: InteractiveAttack = {
      id: attackId,
      name,
      currentHP: maxHP,
      maxHP,
      damage,
      impactTime: Date.now() + (impactDelay * 1000),
      visualEffect,
      imageUrl: imageUrl || '☄️' // Default meteor icon
    };

    setAttacks(prev => [...prev, newAttack]);
  }, []);

  // Damage an interactive attack
  const damageAttack = useCallback((attackId: string, damage: number) => {
    setAttacks(prev => {
      return prev.map(attack => {
        if (attack.id === attackId) {
          const newHP = Math.max(0, attack.currentHP - damage);
          return { ...attack, currentHP: newHP };
        }
        return attack;
      });
    });
  }, []);

  // Remove destroyed attacks
  useEffect(() => {
    const destroyed = attacks.filter(attack => attack.currentHP <= 0);
    if (destroyed.length > 0) {
      // Remove after brief delay for visual feedback
      const timer = setTimeout(() => {
        setAttacks(prev => prev.filter(attack => attack.currentHP > 0));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [attacks]);

  // Check for attack impacts (timer expired)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setAttacks(prev => {
        const impactedAttacks = prev.filter(attack => now >= attack.impactTime && attack.currentHP > 0);

        // Trigger impacts
        impactedAttacks.forEach(attack => {
          onImpact(attack.damage, attack.visualEffect);
        });

        // Remove impacted attacks
        if (impactedAttacks.length > 0) {
          return prev.filter(attack => !impactedAttacks.includes(attack));
        }
        return prev;
      });
    }, 100); // Check every 100ms

    return () => clearInterval(interval);
  }, [onImpact]);

  // Clear all attacks (used when battle ends)
  const clearAttacks = useCallback(() => {
    setAttacks([]);
  }, []);

  return {
    attacks,
    spawnAttack,
    damageAttack,
    clearAttacks
  };
}
