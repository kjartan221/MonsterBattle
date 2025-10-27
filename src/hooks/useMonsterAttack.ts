import { useEffect, useState } from 'react';
import type { MonsterFrontend, BattleSessionFrontend } from '@/lib/types';
import type { PlayerStats } from '@/contexts/PlayerContext';

interface UseMonsterAttackProps {
  monster: MonsterFrontend | null;
  session: BattleSessionFrontend | null;
  battleStarted: boolean;
  isSubmitting: boolean;
  playerStats: PlayerStats | null;
  takeDamage: (amount: number) => Promise<void>;
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
  takeDamage
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

    // Monster attacks player every 1 second
    const attackInterval = setInterval(async () => {
      // Visual feedback: show attack animation
      setIsAttacking(true);

      // Deal damage to player
      await takeDamage(monster.attackDamage);

      // Reset attack animation after 300ms
      setTimeout(() => setIsAttacking(false), 300);
    }, 1000); // Attack every 1 second

    return () => clearInterval(attackInterval);
  }, [monster, session, playerStats, isSubmitting, takeDamage, battleStarted]);

  return { isAttacking };
}
