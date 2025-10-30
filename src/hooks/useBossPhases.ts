import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import type { MonsterFrontend, BossPhase, SpecialAttack } from '@/lib/types';

interface UseBossPhasesProps {
  monster: MonsterFrontend | null;
  currentHP: number;
  maxHP: number;
  battleStarted: boolean;
  isSubmitting: boolean;
  onPhaseAttack?: (attack: SpecialAttack) => void;
}

interface PhaseData {
  currentPhase: number;
  totalPhases: number;
  isInvulnerable: boolean;
  phaseHP: number[]; // HP for each phase bar
  phaseTransitionMessage: string | null; // Optional message for UI display (for future bosses)
}

/**
 * Manages boss phase transitions with invulnerability and special attacks
 *
 * Features:
 * - Tracks current phase based on HP threshold
 * - Triggers invulnerability during phase transitions
 * - Pauses monster attacks during transitions
 * - Executes phase-specific special attacks
 * - Provides stacked HP bar data for visual display
 */
export function useBossPhases({
  monster,
  currentHP,
  maxHP,
  battleStarted,
  isSubmitting,
  onPhaseAttack
}: UseBossPhasesProps): PhaseData {
  const [currentPhase, setCurrentPhase] = useState(1);
  const [isInvulnerable, setIsInvulnerable] = useState(false);
  const [phaseTransitionMessage, setPhaseTransitionMessage] = useState<string | null>(null);
  const hasTriggeredPhases = useRef<Set<number>>(new Set());
  const invulnerabilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const phaseAttackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get boss phases from monster data
  const bossPhases = monster?.bossPhases || [];
  const totalPhases = bossPhases.length || 1;
  const isBoss = monster?.isBoss && bossPhases.length > 0;

  // Calculate HP per phase (for stacked HP bars)
  const phaseHP: number[] = [];
  if (isBoss && bossPhases.length > 0) {
    // Calculate HP for each phase based on thresholds
    const sortedPhases = [...bossPhases].sort((a, b) => b.hpThreshold - a.hpThreshold);

    for (let i = 0; i < sortedPhases.length; i++) {
      const phase = sortedPhases[i];
      const nextThreshold = sortedPhases[i + 1]?.hpThreshold || 0;
      const phaseHPAmount = Math.ceil(maxHP * ((phase.hpThreshold - nextThreshold) / 100));
      phaseHP.push(phaseHPAmount);
    }
  } else {
    // Not a boss, single HP bar
    phaseHP.push(maxHP);
  }

  // Reset phase tracking when monster changes or battle ends
  useEffect(() => {
    if (!monster || !battleStarted) {
      setCurrentPhase(1);
      setIsInvulnerable(false);
      setPhaseTransitionMessage(null);
      hasTriggeredPhases.current.clear();

      // Clear any pending timeouts
      if (invulnerabilityTimeoutRef.current) {
        clearTimeout(invulnerabilityTimeoutRef.current);
        invulnerabilityTimeoutRef.current = null;
      }
      if (phaseAttackTimeoutRef.current) {
        clearTimeout(phaseAttackTimeoutRef.current);
        phaseAttackTimeoutRef.current = null;
      }
    }
  }, [monster, battleStarted]);

  // Check for phase transitions based on HP percentage
  useEffect(() => {
    if (!isBoss || !battleStarted || isSubmitting) return;

    const currentHPPercent = (currentHP / maxHP) * 100;

    // Check each phase threshold
    for (const phase of bossPhases) {
      // If HP drops below threshold and phase hasn't been triggered yet
      if (currentHPPercent <= phase.hpThreshold && !hasTriggeredPhases.current.has(phase.phaseNumber)) {
        console.log(`🔥 PHASE TRANSITION! Boss entering Phase ${phase.phaseNumber}`);

        // Mark phase as triggered
        hasTriggeredPhases.current.add(phase.phaseNumber);
        setCurrentPhase(phase.phaseNumber);

        // Start invulnerability
        setIsInvulnerable(true);

        // Show phase message
        if (phase.message) {
          setPhaseTransitionMessage(phase.message);
          toast(phase.message, {
            icon: '⚔️',
            duration: 3000,
            style: {
              background: '#7c3aed',
              color: '#fff',
              fontWeight: 'bold'
            }
          });

          // Clear message after 3 seconds
          setTimeout(() => {
            setPhaseTransitionMessage(null);
          }, 3000);
        }

        // Execute phase-specific special attacks after 1 second (during invulnerability)
        if (phase.specialAttacks && phase.specialAttacks.length > 0 && onPhaseAttack) {
          phaseAttackTimeoutRef.current = setTimeout(() => {
            const attack = phase.specialAttacks![0]; // Execute first special attack
            console.log(`💥 Phase Attack: ${attack.type}`);
            onPhaseAttack(attack);
          }, 1000);
        }

        // End invulnerability after specified duration
        invulnerabilityTimeoutRef.current = setTimeout(() => {
          setIsInvulnerable(false);
          console.log(`✅ Invulnerability ended. Boss is vulnerable again!`);

          toast('The boss is vulnerable again!', {
            icon: '⚔️',
            duration: 2000
          });
        }, phase.invulnerabilityDuration);

        // Only trigger one phase at a time
        break;
      }
    }
  }, [currentHP, maxHP, isBoss, battleStarted, isSubmitting, bossPhases, onPhaseAttack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (invulnerabilityTimeoutRef.current) {
        clearTimeout(invulnerabilityTimeoutRef.current);
      }
      if (phaseAttackTimeoutRef.current) {
        clearTimeout(phaseAttackTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentPhase,
    totalPhases,
    isInvulnerable,
    phaseHP,
    phaseTransitionMessage
  };
}
