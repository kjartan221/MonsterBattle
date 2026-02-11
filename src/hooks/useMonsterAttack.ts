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
  isStunned?: boolean; // Pause attacks when monster is stunned (skillshot)
  playerStats: PlayerStats | null;
  takeDamage: (amount: number) => Promise<void>;
  healHealth: (amount: number, maxHpBonus?: number) => Promise<void>; // For defensive lifesteal
  equipmentStats: TotalEquipmentStats;
  applyDebuff?: (effect: DebuffEffect, appliedBy?: string) => boolean;
  additionalDamage?: number; // Additional damage from summons, etc.
  onSummonDamage?: (amount: number) => void; // Report summon damage for cheat detection
  onThornsDamage?: (amount: number) => void; // Apply thorns damage to monster
  onDefensiveLifesteal?: (amount: number) => void; // Report defensive lifesteal healing for cheat detection
  activeDebuffs?: import('@/lib/types').ActiveDebuff[]; // Player debuffs (for defense reduction)
  onSkillShotTrigger?: () => void; // Callback to check for skillshot triggers
}

/**
 * Handles monster attack interval and visual feedback
 * Isolates attack state to prevent BattlePage re-renders
 * Pauses attacks during boss invulnerability phases and skillshot stuns
 */
export function useMonsterAttack({
  monster,
  session,
  battleStarted,
  isSubmitting,
  isInvulnerable = false,
  isStunned = false,
  playerStats,
  takeDamage,
  healHealth,
  equipmentStats,
  applyDebuff,
  additionalDamage = 0,
  onSummonDamage,
  onThornsDamage,
  onDefensiveLifesteal,
  activeDebuffs = [],
  onSkillShotTrigger
}: UseMonsterAttackProps) {
  const [isAttacking, setIsAttacking] = useState(false);

  useEffect(() => {
    // Stop attacking if any of these conditions are met:
    // - No monster/session/playerStats
    // - Session already marked as defeated
    // - Currently submitting battle completion
    // - Battle hasn't started yet
    // - Boss is invulnerable (phase transition)
    // - Monster is stunned (skillshot success)
    // Note: playerStats is checked for existence but NOT in dependency array
    // to prevent re-creating interval on every HP change
    if (!monster || !session || session.isDefeated || !playerStats || isSubmitting || !battleStarted || isInvulnerable || isStunned) return;

    // Safety check for monster.attackDamage
    if (typeof monster.attackDamage !== 'number' || isNaN(monster.attackDamage)) {
      console.error('Invalid monster.attackDamage:', monster.attackDamage);
      return;
    }

    // Calculate effective defense (equipment defense - debuff reductions)
    const defenseReduction = activeDebuffs
      .filter(debuff => debuff.type === 'defense_reduction')
      .reduce((total, debuff) => total + debuff.damageAmount, 0);

    const effectiveDefense = Math.max(0, equipmentStats.defense - defenseReduction);

    // Calculate reduced damage based on effective armor (defense)
    const effectiveDamage = calculateMonsterDamage(
      monster.attackDamage,
      effectiveDefense
    );

    // Add additional damage from summons (not reduced by armor)
    const totalDamage = effectiveDamage + additionalDamage;

    // Calculate attack interval based on attack speed bonuses
    const interval = calculateMonsterAttackInterval(1000, equipmentStats.attackSpeed);

    // Monster attacks player at calculated interval
    const attackInterval = setInterval(async () => {
      // Visual feedback: show attack animation
      setIsAttacking(true);

      // Calculate what the player's HP will be after damage
      const hpAfterDamage = Math.max(0, playerStats.currentHealth - totalDamage);

      // Deal total damage to player (monster + summons)
      await takeDamage(totalDamage);

      // Apply defensive lifesteal healing (% of damage taken)
      // IMPORTANT: Only heal if player HP > 0 AFTER damage (don't revive dead players)
      if (equipmentStats.defensiveLifesteal > 0 && hpAfterDamage > 0) {
        const healAmount = Math.ceil(totalDamage * (equipmentStats.defensiveLifesteal / 100));
        await healHealth(healAmount, equipmentStats.maxHpBonus);

        // Report healing to anti-cheat tracker
        if (onDefensiveLifesteal) {
          onDefensiveLifesteal(healAmount);
        }
      }

      // Apply thorns damage (% of pre-mitigation damage reflected back to monster)
      if (equipmentStats.thorns > 0 && onThornsDamage) {
        // Use monster's base attack damage (pre-mitigation) for thorns calculation
        const preMitigationDamage = monster.attackDamage + additionalDamage;
        const thornsDamage = Math.ceil(preMitigationDamage * (equipmentStats.thorns / 100));
        onThornsDamage(thornsDamage);
      }

      // Check for skillshot trigger on monster attack
      if (onSkillShotTrigger) {
        onSkillShotTrigger();
      }

      // Report summon damage separately for cheat detection (not reduced by armor)
      if (additionalDamage > 0 && onSummonDamage) {
        onSummonDamage(additionalDamage);
      }

      // Apply DoT effect if monster has one
      if (monster.dotEffect && applyDebuff) {
        const applied = applyDebuff(monster.dotEffect, monster._id);
      }

      // Reset attack animation after 300ms
      setTimeout(() => setIsAttacking(false), 300);
    }, interval);

    return () => clearInterval(attackInterval);
  }, [monster, session, isSubmitting, takeDamage, healHealth, battleStarted, isInvulnerable, isStunned, equipmentStats, applyDebuff, additionalDamage, onSummonDamage, onThornsDamage, onDefensiveLifesteal, activeDebuffs, onSkillShotTrigger]);
  // Note: playerStats intentionally excluded from dependencies to prevent infinite loop
  // when HP changes from takeDamage/healHealth calls

  return { isAttacking };
}
