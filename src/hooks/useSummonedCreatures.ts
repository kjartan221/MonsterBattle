import { useState, useEffect, useCallback } from 'react';
import type { SummonedCreature, SummonDefinition, MonsterFrontend } from '@/lib/types';

interface UseSummonedCreaturesProps {
  monster: MonsterFrontend | null;
  battleStarted: boolean;
}

/**
 * Manages summoned creatures during boss battles
 *
 * Features:
 * - Add summons during phase transitions
 * - Track individual summon HP
 * - Calculate total attack damage from all alive summons
 * - Reset summons on monster change or battle end
 */
export function useSummonedCreatures({
  monster,
  battleStarted
}: UseSummonedCreaturesProps) {
  const [summons, setSummons] = useState<SummonedCreature[]>([]);

  // Reset summons when monster changes or battle ends
  useEffect(() => {
    if (!monster || !battleStarted) {
      setSummons([]);
    }
  }, [monster, battleStarted]);

  // Add summons (called during phase transitions)
  const addSummons = useCallback((count: number, definition: SummonDefinition, bossMaxHP: number) => {
    const newSummons: SummonedCreature[] = [];

    for (let i = 0; i < count; i++) {
      const hp = Math.ceil(bossMaxHP * (definition.hpPercent / 100));
      const position: 'left' | 'right' = i === 0 ? 'left' : 'right';

      newSummons.push({
        id: `${definition.name}_${Date.now()}_${i}`,
        name: definition.name,
        currentHP: hp,
        maxHP: hp,
        attackDamage: definition.attackDamage,
        imageUrl: definition.imageUrl,
        position
      });
    }

    setSummons(prev => [...prev, ...newSummons]);
    console.log(`✨ Summoned ${count} ${definition.name}(s)!`);
  }, []);

  // Damage a specific summon
  const damageSummon = useCallback((summonId: string, damage: number): boolean => {
    let defeated = false;

    setSummons(prev => prev.map(summon => {
      if (summon.id === summonId) {
        const newHP = Math.max(0, summon.currentHP - damage);
        if (newHP === 0 && summon.currentHP > 0) {
          defeated = true;
          console.log(`💀 ${summon.name} defeated!`);
        }
        return { ...summon, currentHP: newHP };
      }
      return summon;
    }));

    return defeated;
  }, []);

  // Remove defeated summons
  const removeDefeatedSummons = useCallback(() => {
    setSummons(prev => prev.filter(summon => summon.currentHP > 0));
  }, []);

  // Get total attack damage from all alive summons
  const getTotalSummonDamage = useCallback((): number => {
    return summons.reduce((total, summon) => {
      return total + (summon.currentHP > 0 ? summon.attackDamage : 0);
    }, 0);
  }, [summons]);

  // Get summons by position
  const getLeftSummon = useCallback((): SummonedCreature | null => {
    return summons.find(s => s.position === 'left' && s.currentHP > 0) || null;
  }, [summons]);

  const getRightSummon = useCallback((): SummonedCreature | null => {
    return summons.find(s => s.position === 'right' && s.currentHP > 0) || null;
  }, [summons]);

  return {
    summons,
    addSummons,
    damageSummon,
    removeDefeatedSummons,
    getTotalSummonDamage,
    getLeftSummon,
    getRightSummon
  };
}
