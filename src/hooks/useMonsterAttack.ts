import { useEffect, useState } from 'react';
import type { MonsterFrontend, BattleSessionFrontend } from '@/lib/types';
import type { PlayerStats } from '@/contexts/PlayerContext';
import type { TotalEquipmentStats } from '@/utils/equipmentCalculations';
import { calculateMonsterDamage, calculateMonsterAttackInterval } from '@/utils/equipmentCalculations';

interface UseMonsterAttackProps {
  monster: MonsterFrontend | null;
  session: BattleSessionFrontend | null;
  battleStarted: boolean;
  isSubmitting: boolean;
  playerStats: PlayerStats | null;
  takeDamage: (amount: number) => Promise<void>;
  equipmentStats: TotalEquipmentStats;
}

/**
 * Handles monster attack interval and visual feedback
 * Isolates attack state to prevent BattlePage re-renders
 */
export function useMonsterAttack({
  monster,
  session,
  battleStarted,
  isSubmitting,
  playerStats,
  takeDamage,
  equipmentStats
}: UseMonsterAttackProps) {
  const [isAttacking, setIsAttacking] = useState(false);

  useEffect(() => {
    // Stop attacking if any of these conditions are met:
    // - No monster/session/playerStats
    // - Session already marked as defeated
    // - Currently submitting battle completion
    // - Battle hasn't started yet
    if (!monster || !session || session.isDefeated || !playerStats || isSubmitting || !battleStarted) return;

    // Safety check for monster.attackDamage
    if (typeof monster.attackDamage !== 'number' || isNaN(monster.attackDamage)) {
      console.error('Invalid monster.attackDamage:', monster.attackDamage);
      return;
    }

    // Calculate reduced damage based on armor (hpReduction)
    const effectiveDamage = calculateMonsterDamage(
      monster.attackDamage,
      equipmentStats.hpReduction
    );

    // Calculate attack interval based on attack speed bonuses
    const interval = calculateMonsterAttackInterval(1000, equipmentStats.attackSpeed);

    console.log(`⚔️ Monster attack: ${effectiveDamage} damage every ${interval}ms (base: ${monster.attackDamage}, reduction: ${equipmentStats.hpReduction}%)`);

    // Monster attacks player at calculated interval
    const attackInterval = setInterval(async () => {
      // Visual feedback: show attack animation
      setIsAttacking(true);

      // Deal reduced damage to player
      await takeDamage(effectiveDamage);

      // Reset attack animation after 300ms
      setTimeout(() => setIsAttacking(false), 300);
    }, interval);

    return () => clearInterval(attackInterval);
  }, [monster, session, playerStats, isSubmitting, takeDamage, battleStarted, equipmentStats]);

  return { isAttacking };
}
