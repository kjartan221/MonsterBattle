import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import type { MonsterFrontend, BossPhase, SpecialAttack } from '@/lib/types';

interface UseBossPhasesProps {
  monster: MonsterFrontend | null;
  battleStarted: boolean;
  isSubmitting: boolean;
  onPhaseAttack?: (attack: SpecialAttack) => void;
  onBattleComplete?: () => void; // Callback when all phases defeated
  onInvulnerabilityStart?: (duration: number) => void; // Callback when boss becomes invulnerable
}

interface PhaseData {
  currentPhaseHP: number;      // Current HP in active phase bar
  maxPhaseHP: number;          // Max HP for active phase bar
  currentPhaseNumber: number;  // Which phase (1, 2, 3, etc.)
  phasesRemaining: number;     // Phases left (totalPhases, totalPhases-1, ..., 1)
  isInvulnerable: boolean;     // Boss invulnerable during transitions
  damagePhase: (damage: number) => void;  // Function to damage current phase HP
  healPhase: (healing: number) => void;   // Function to heal current phase HP
}

/**
 * Manages boss phase HP with stacked HP bar system
 *
 * Features:
 * - Divides boss HP into separate phase bars based on hpThreshold
 * - Each phase is independent HP bar that depletes separately
 * - Excess damage ignored at phase boundaries (like shields)
 * - Phase transitions trigger when phase HP reaches 0
 * - Invulnerability during phase transitions
 * - Executes phase-specific special attacks (heal, summon, etc.)
 * - Comprehensive debug logging for state verification
 *
 * System Design:
 * - Total HP divided by phase thresholds (e.g., 50% = 2x 50% phases)
 * - damagePhase() caps damage at 0, ignores excess
 * - healPhase() can exceed maxPhaseHP (for boss heals)
 * - Phase transition triggers automatically when phase HP = 0
 * - Last phase shows regular HP bar (phasesRemaining = 1)
 */
export function useBossPhases({
  monster,
  battleStarted,
  isSubmitting,
  onPhaseAttack,
  onBattleComplete,
  onInvulnerabilityStart
}: UseBossPhasesProps): PhaseData {
  // Phase HP state
  const [currentPhaseHP, setCurrentPhaseHP] = useState<number>(0);
  const [maxPhaseHP, setMaxPhaseHP] = useState<number>(0);
  const [currentPhaseNumber, setCurrentPhaseNumber] = useState<number>(1);
  const [phasesRemaining, setPhasesRemaining] = useState<number>(1);
  const [isInvulnerable, setIsInvulnerable] = useState(false);

  const invulnerabilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const phaseAttackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInitializedMonsterIdRef = useRef<string | null>(null);

  // Get boss data
  const bossPhases = monster?.bossPhases || [];
  const isBoss = monster?.isBoss && bossPhases.length > 0;
  const totalPhases = isBoss ? bossPhases.length + 1 : 1;

  // Initialize phase HP when monster loads (only when monster ID changes)
  useEffect(() => {
    if (!monster) {
      // Only reset if we haven't already reset
      if (lastInitializedMonsterIdRef.current !== null) {
        lastInitializedMonsterIdRef.current = null;
        setCurrentPhaseHP(0);
        setMaxPhaseHP(0);
        setCurrentPhaseNumber(1);
        setPhasesRemaining(1);
        setIsInvulnerable(false);
      }
      return;
    }

    const monsterId = monster._id?.toString() || monster.name;

    // Skip if already initialized this monster (prevents rerender spam)
    if (lastInitializedMonsterIdRef.current === monsterId) {
      return;
    }

    const totalHP = monster.clicksRequired;

    if (isBoss) {
      // Calculate first phase HP
      const sortedPhases = [...bossPhases].sort((a, b) => b.hpThreshold - a.hpThreshold);
      const firstThreshold = sortedPhases[0]?.hpThreshold || 0;
      const firstPhaseHP = Math.ceil(totalHP * ((100 - firstThreshold) / 100));

      setMaxPhaseHP(firstPhaseHP);
      setCurrentPhaseHP(firstPhaseHP);
      setCurrentPhaseNumber(1);
      setPhasesRemaining(totalPhases);
      setIsInvulnerable(false);
    } else {
      // Regular monster, single HP bar
      setMaxPhaseHP(totalHP);
      setCurrentPhaseHP(totalHP);
      setCurrentPhaseNumber(1);
      setPhasesRemaining(1);
      setIsInvulnerable(false);
    }

    // Mark this monster as initialized
    lastInitializedMonsterIdRef.current = monsterId;

    // Clear any pending timeouts
    if (invulnerabilityTimeoutRef.current) {
      clearTimeout(invulnerabilityTimeoutRef.current);
      invulnerabilityTimeoutRef.current = null;
    }
    if (phaseAttackTimeoutRef.current) {
      clearTimeout(phaseAttackTimeoutRef.current);
      phaseAttackTimeoutRef.current = null;
    }
  }, [monster, isBoss, bossPhases, totalPhases]);

  // Phase transition logic - triggers when phase HP reaches 0
  useEffect(() => {
    if (!monster || !battleStarted || isSubmitting) {
      return;
    }

    // Check if phase HP depleted and more phases remain
    if (currentPhaseHP <= 0 && phasesRemaining > 1 && !isInvulnerable) {
      const nextPhaseNumber = currentPhaseNumber + 1;
      const phaseDefinition = bossPhases.find(p => p.phaseNumber === nextPhaseNumber);

      if (!phaseDefinition) {
        console.error(`[useBossPhases] ERROR: No phase definition found for phase ${nextPhaseNumber}`);
        return;
      }

      // Start invulnerability
      setIsInvulnerable(true);
      const invulnDuration = phaseDefinition.invulnerabilityDuration || 2000;

      // Report invulnerability duration for cheat detection
      if (onInvulnerabilityStart) {
        onInvulnerabilityStart(invulnDuration);
      }

      // Show phase message
      if (phaseDefinition.message) {
        toast(phaseDefinition.message, {
          icon: '⚔️',
          duration: 3000,
          style: {
            background: '#7c3aed',
            color: '#fff',
            fontWeight: 'bold'
          }
        });
      }

      // Calculate next phase HP
      const totalHP = monster.clicksRequired;
      const sortedPhases = [...bossPhases].sort((a, b) => b.hpThreshold - a.hpThreshold);
      const currentThreshold = phaseDefinition.hpThreshold;
      const nextThreshold = sortedPhases.find(p => p.hpThreshold < currentThreshold)?.hpThreshold || 0;
      const nextPhaseHP = Math.ceil(totalHP * ((currentThreshold - nextThreshold) / 100));

      // Execute phase-specific special attacks after 1 second (during invulnerability)
      if (phaseDefinition.specialAttacks && phaseDefinition.specialAttacks.length > 0) {
        phaseAttackTimeoutRef.current = setTimeout(() => {
          // First, set the new phase HP
          setCurrentPhaseNumber(nextPhaseNumber);
          setMaxPhaseHP(nextPhaseHP);
          setCurrentPhaseHP(nextPhaseHP);
          setPhasesRemaining(prev => prev - 1);

          // Then execute special attacks (healing will add to the NEW phase HP)
          phaseDefinition.specialAttacks!.forEach((attack) => {
            // Handle healing internally
            if (attack.healing) {
              const healAmount = Math.ceil(attack.healing);
              setCurrentPhaseHP(prev => prev + healAmount);
            }

            // Call external handler for other effects (damage, summon, etc.)
            if (onPhaseAttack) {
              onPhaseAttack(attack);
            }
          });
        }, 1000);
      }

      // End invulnerability after transition duration
      invulnerabilityTimeoutRef.current = setTimeout(() => {
        setIsInvulnerable(false);

        // Only set phase HP if no special attacks (they already set it)
        if (!phaseDefinition.specialAttacks || phaseDefinition.specialAttacks.length === 0) {
          setCurrentPhaseNumber(nextPhaseNumber);
          setMaxPhaseHP(nextPhaseHP);
          setCurrentPhaseHP(nextPhaseHP);
          setPhasesRemaining(prev => prev - 1);
        }

        toast('The boss is vulnerable again!', {
          icon: '⚔️',
          duration: 2000
        });
      }, phaseDefinition.invulnerabilityDuration);
    }
    // Check if last phase depleted
    else if (currentPhaseHP <= 0 && phasesRemaining === 1) {
      if (onBattleComplete) {
        onBattleComplete();
      }
    }
  }, [currentPhaseHP, phasesRemaining, currentPhaseNumber, monster, battleStarted, isSubmitting, isInvulnerable, bossPhases, onPhaseAttack, onBattleComplete]);

  // Damage phase HP (caps at 0, ignores excess)
  const damagePhase = useCallback((damage: number) => {
    if (isInvulnerable) {
      return;
    }

    setCurrentPhaseHP(prev => Math.max(0, prev - damage));
  }, [isInvulnerable]);

  // Heal phase HP (can exceed maxPhaseHP for boss heals)
  const healPhase = useCallback((healing: number) => {
    const healAmount = Math.ceil(healing);
    setCurrentPhaseHP(prev => prev + healAmount);
  }, []);

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
    currentPhaseHP,
    maxPhaseHP,
    currentPhaseNumber,
    phasesRemaining,
    isInvulnerable,
    damagePhase,
    healPhase
  };
}
