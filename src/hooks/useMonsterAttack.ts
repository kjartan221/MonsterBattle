import { useEffect, useState } from 'react';
import type { MonsterFrontend, BattleSessionFrontend, DebuffEffect } from '@/lib/types';
import type { PlayerStats } from '@/contexts/PlayerContext';
import type { TotalEquipmentStats } from '@/utils/equipmentCalculations';
import { calculateMonsterDamage, calculateMonsterAttackInterval } from '@/utils/equipmentCalculations';

interface UseMonsterAttackProps {
  monster: MonsterFrontend | null;
  session: BattleSessionFrontend | null;
  battleStarted: boolean;
  isSubmitting: boolean;
  isInvulnerable?: boolean;
  playerStats: PlayerStats | null;
  takeDamage: (amount: number) => Promise<void>;
  equipmentStats: TotalEquipmentStats;
  applyDebuff?: (effect: DebuffEffect, appliedBy?: string) => boolean;
}

/**
 * Handles monster attack interval and visual feedback
 * Isolates attack state to prevent BattlePage re-renders
 * Pauses attacks during boss invulnerability phases
 */
export function useMonsterAttack({
  monster,
  session,
  battleStarted,
  isSubmitting,
  isInvulnerable = false,
  playerStats,
  takeDamage,
  equipmentStats,
  applyDebuff
}: UseMonsterAttackProps) {
  const [isAttacking, setIsAttacking] = useState(false);

  useEffect(() => {
    // Stop attacking if any of these conditions are met:
    // - No monster/session/playerStats
    // - Session already marked as defeated
    // - Currently submitting battle completion
    // - Battle hasn't started yet
    // - Boss is invulnerable (phase transition)
    // Note: playerStats is checked for existence but NOT in dependency array
    // to prevent re-creating interval on every HP change
    if (!monster || !session || session.isDefeated || !playerStats || isSubmitting || !battleStarted || isInvulnerable) return;

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

      // Apply DoT effect if monster has one
      if (monster.dotEffect && applyDebuff) {
        const applied = applyDebuff(monster.dotEffect, monster._id);
        if (applied) {
          console.log(`🦠 Monster applied ${monster.dotEffect.type} debuff!`);
        }
      }

      // Reset attack animation after 300ms
      setTimeout(() => setIsAttacking(false), 300);
    }, interval);

    return () => clearInterval(attackInterval);
  }, [monster, session, isSubmitting, takeDamage, battleStarted, isInvulnerable, equipmentStats, applyDebuff]);
  // Note: playerStats intentionally excluded from dependencies to prevent infinite loop
  // when HP changes from takeDamage calls

  return { isAttacking };
}
