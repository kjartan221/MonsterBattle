
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import toast from 'react-hot-toast';
import type { MonsterFrontend, BattleSessionFrontend } from '@shared/types';
import type { LootItem } from '@shared/loot-table';
import { getLootItemsByIds } from '@shared/loot-table';
import { BiomeId, Tier, getBiomeTierDisplayName } from '@shared/biome-config';
import { usePlayer } from '@/contexts/PlayerContext';
import { useBiome } from '@/contexts/BiomeContext';
import { useEquipment } from '@/contexts/EquipmentContext';
import { useGameState } from '@/contexts/GameStateContext';
import { useBattleEffects } from '@/hooks/useBattleEffects';
import { useSpecialAttacks } from '@/hooks/useSpecialAttacks';
import { useSummonedCreatures } from '@/hooks/useSummonedCreatures';
import { useInteractiveAttacks } from '@/hooks/useInteractiveAttacks';
import { useBossPhases } from '@/hooks/useBossPhases';
import { useMonsterHP } from '@/hooks/useMonsterHP';
import { freshAttempt, escapeDeadlineFrom } from '@/stores/battleAttempt';
import { useBattleStore } from '@/stores/battleStore';
import { battleScheduler } from '@/stores/battleScheduler';
import { battleEvents } from '@/stores/battleEvents';
import { elapsedStunTime } from '@/utils/stunAccounting';
import { useSkillShot } from '@/hooks/useSkillShot';
import type { DebuffEffect, SpecialAttack } from '@shared/types';
import { calculateTotalEquipmentStats, calculateClickDamage, calculateEffectiveAutoClickRate, calculateMonsterDamage, calculateMonsterAttackInterval } from '@shared/equipmentCalculations';
import { getSkillshotConfig } from '@/shared/skillshotUtils';
import LootSelectionModal from '@/components/battle/LootSelectionModal';
import CheatDetectionModal from '@/components/battle/CheatDetectionModal';
import BattleStartScreen from '@/components/battle/BattleStartScreen';
import BattleDefeatScreen from '@/components/battle/BattleDefeatScreen';
import MonsterBattleArena from '@/components/battle/MonsterBattleArena';
import SummonCard from '@/components/battle/SummonCard';
import InteractiveAttackCard from '@/components/battle/InteractiveAttackCard';
import BuffIndicators from '@/components/battle/effect-indicators/MonsterBuffIndicators';
import MonsterDebuffIndicators from '@/components/battle/effect-indicators/MonsterDebuffIndicators';
import type { MonsterDebuff } from '@/components/battle/effect-indicators/MonsterDebuffIndicators';
import { BuffType } from '@/types/buffs';
import SpecialAttackFlash from '@/components/battle/SpecialAttackFlash';
import BossPhaseIndicator from '@/components/battle/BossPhaseIndicator';
import CorruptionOverlay from '@/components/battle/CorruptionOverlay';
import SkillShotSingle from '@/components/battle/SkillShotSingle';
import SkillShotChain from '@/components/battle/SkillShotChain';
import EscapeCountdown from '@/components/battle/EscapeCountdown';

interface SpellCastData {
  spellName: string;
  damage?: number;
  healing?: number;
  effect?: string;
  visualEffect?: string;
  // Debuff data for monsters
  debuffType?: 'poison' | 'burn' | 'bleed' | 'stun' | 'slow' | 'freeze';
  debuffValue?: number;
  debuffDamageType?: 'flat' | 'percentage';
  duration?: number;
}

interface MonsterBattleSectionProps {
  onBattleComplete?: () => void;
  applyDebuff: (effect: DebuffEffect, appliedBy?: string) => boolean;
  clearDebuffs: () => void;
  spellDamageHandler?: React.MutableRefObject<((spellData: SpellCastData) => void) | null>; // Phase 2.6: Ref to spell damage handler
  activeBuffs?: import('@/types/buffs').Buff[]; // Phase 2.6: Active player buffs for crit multiplier calculation
  activeDebuffs?: import('@shared/types').ActiveDebuff[]; // Player debuffs (for defense reduction)
  damageShield: (amount: number) => number; // Phase 2.6: Shield damage absorption function
  healingReportHandler?: React.MutableRefObject<((amount: number) => void) | null>; // Report healing for cheat detection
  buffReportHandler?: React.MutableRefObject<((buffType: string, buffValue: number) => void) | null>; // Report buffs for cheat detection
  removeMonsterShieldHandler?: React.MutableRefObject<(() => boolean) | null>; // Phase 3+: Remove monster shield (Acid Vial)
}

export default function MonsterBattleSection({ onBattleComplete, applyDebuff, clearDebuffs, spellDamageHandler, activeBuffs = [], activeDebuffs = [], damageShield, healingReportHandler, buffReportHandler, removeMonsterShieldHandler }: MonsterBattleSectionProps) {
  const { playerStats, resetHealth, getCurrentStreak, takeDamage, healHealth, updatePlayerStats, fetchPlayerStats } = usePlayer();
  const { selectedBiome, selectedTier, setBiomeTier } = useBiome();
  const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2 } = useEquipment();
  const gameState = useGameState();

  // The attempt lives in the store and is constructed by transitions, so there is nothing
  // to reset by hand here. Null outside a battle; the fallbacks keep render paths simple.
  const attempt = gameState.attempt;
  const {
    totalDamage, totalHealing, totalShieldGained, totalDamageReduction, invulnerabilityTime,
    summonDamage, thornsDamage, totalStunTime, skillshotBonusDamage, clickCount,
    shieldHP, escapeAt, isStunned, stunStartTime, stunEndTime,
    damageWindow, damageWindowEndTime, monsterDebuffs, lastHPPercent, triggeredThresholds,
  } = attempt ?? freshAttempt();
  const [critTrigger, setCritTrigger] = useState(0);
  const [defeatData, setDefeatData] = useState<{ goldLost: number; streakLost: number }>({
    goldLost: 0,
    streakLost: 0
  });
  const [cheatModal, setCheatModal] = useState<{ show: boolean; message: string }>({
    show: false,
    message: ''
  });

  // Phase attack visual feedback (separate from regular special attacks)
  const [phaseAttack, setPhaseAttack] = useState<SpecialAttack | null>(null);

  // Phase 2.6: Spell cast visual feedback
  const [spellCast, setSpellCast] = useState<SpecialAttack | null>(null);

  // Ref to store applyDamageToMonster to prevent interval resets
  const applyDamageRef = useRef<((isAutoHit: boolean) => void) | null>(null);

  // Synchronous guard so death is handled exactly once (reset when a new battle starts)
  const hasHandledDeathRef = useRef(false);

  // The scheduled deadline outlives this render, so it calls through a ref.
  const handleMonsterEscapeRef = useRef<(() => void) | null>(null);

  // Memoized equipment stats for stable monster attack intervals
  const equipmentStats = useMemo(() =>
    calculateTotalEquipmentStats(
      equippedWeapon,
      equippedArmor,
      equippedAccessory1,
      equippedAccessory2
    ),
    [equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2]
  );

  // The auto-hit loop is registered once and recomputes its delay every base tick, so it reads
  // equipment through this ref: a mid-battle swap changes the cadence without re-registration.
  const equipmentStatsRef = useRef(equipmentStats);
  equipmentStatsRef.current = equipmentStats;

  // Summoned creatures management (must come before handleSpecialAttack)
  const {
    summons,
    addSummons,
    damageSummon,
    removeDefeatedSummons,
    getTotalSummonDamage,
    getLeftSummon,
    getRightSummon
  } = useSummonedCreatures({
    monster: gameState.monster,
    battleStarted: gameState.canAttackMonster()
  });

  // Memoized so useInteractiveAttacks' 100ms impact interval isn't rebuilt every render (was a lag source)
  const handleInteractiveImpact = useCallback((damage: number, visualEffect?: string) => {
    const damageAfterDefense = calculateMonsterDamage(damage, equipmentStats.defense);
    takeDamage(damageAfterDefense);
    setPhaseAttack({
      type: 'meteor',
      damage: damageAfterDefense, // Show reduced damage
      cooldown: 0,
      visualEffect: visualEffect || 'red',
      message: '💥 Attack impacted!'
    });
    setTimeout(() => setPhaseAttack(null), 3500);
  }, [equipmentStats, takeDamage]);

  // Interactive attacks management (must come before handleSpecialAttack)
  const {
    attacks: interactiveAttacks,
    spawnAttack,
    damageAttack,
    clearAttacks: clearInteractiveAttacks
  } = useInteractiveAttacks({
    onImpact: handleInteractiveImpact
  });

  // SkillShot system - Tier-based progression with challenge modifiers
  // T1-2: Disabled (tutorial phase)
  // T3-5: Progressively more circles based on rarity (common: 2-4, rare: 2-4, epic: 3-5, legendary: 3-5, bosses: +1)
  // Challenge modifiers: +0-4 extra circles, 1.0-0.6x speed (faster)
  const skillshotConfig = useMemo(() => {
    if (!gameState.monster) {
      return { enabled: false, circleCount: 3, circleDuration: 3000 };
    }

    const baseConfig = getSkillshotConfig(
      gameState.monster.tier,
      gameState.monster.rarity,
      gameState.monster.isBoss || false
    );

    // Apply challenge modifiers
    const challengeConfig = playerStats?.battleChallengeConfig || {
      skillshotCircles: 0,
      skillshotSpeed: 1.0
    };

    const modifiedCircleCount = baseConfig.circleCount + (challengeConfig.skillshotCircles || 0);
    const baseDuration = 3000; // 3 seconds base
    const modifiedDuration = Math.round(baseDuration * (challengeConfig.skillshotSpeed || 1.0));

    return {
      enabled: baseConfig.enabled,
      circleCount: modifiedCircleCount,
      circleDuration: modifiedDuration
    };
  }, [gameState.monster?.tier, gameState.monster?.rarity, gameState.monster?.isBoss, playerStats?.battleChallengeConfig?.skillshotCircles, playerStats?.battleChallengeConfig?.skillshotSpeed]);

  const skillShot = useSkillShot({
    enabled: skillshotConfig.enabled && gameState.canAttackMonster() && !gameState.session?.isDefeated,
    mode: 'chain', // Always use chain mode now (tier-based circle count)
    circleCount: skillshotConfig.circleCount, // Tier/rarity-based count + challenge bonus
    circleDuration: skillshotConfig.circleDuration, // Base duration × challenge speed
    // randomTriggerChance: Uses chain mode default (10%)
    // cooldown: Uses chain mode default (20s)
    isBoss: gameState.monster?.isBoss || false
  });

  // Stun and damage-window expiry are one-shot deadlines armed on application. Handlers read
  // the live attempt, since they outlive the render that registered them.
  const scheduleStunExpiry = useCallback((endsAt: number) => {
    battleScheduler.at('stun', endsAt, () => {
      const store = useBattleStore.getState();
      const s = store.state;
      if (s.phase !== 'inProgress' && s.phase !== 'completing') return;
      const { isStunned: stunned, stunStartTime: startedAt, stunEndTime: endedAt } = s.attempt;
      if (!stunned) return;

      // Real elapsed stun. Under-reporting this inflates the monster's active attack time
      // server-side and can flag legitimate stun-chaining.
      store.addToAttempt('totalStunTime', elapsedStunTime({ startedAt, endsAt: endedAt, now: Date.now() }));
      store.patchAttempt({ isStunned: false, stunStartTime: 0 });
    });
  }, []);

  const scheduleDamageWindowExpiry = useCallback((endsAt: number) => {
    battleScheduler.at('damageWindow', endsAt, () => {
      const store = useBattleStore.getState();
      const s = store.state;
      if (s.phase !== 'inProgress' && s.phase !== 'completing') return;
      if (s.attempt.damageWindow <= 1.0) return;

      store.patchAttempt({ damageWindow: 1.0 });
      toast('⏱️ Damage window ended', { duration: 2000 });
    });
  }, []);

  // SkillShot success callback: Rewards based on mode
  useEffect(() => {
    skillShot.onSuccessRef.current = () => {
      const now = Date.now();

      if (skillShot.mode === 'simple') {
        // Simple mode: Small damage boost, no stun

        const damageBoostDuration = 3000; // 3 seconds
        gameState.patchAttempt({
          damageWindow: 1.25, // 25% damage boost
          damageWindowEndTime: now + damageBoostDuration,
        });
        scheduleDamageWindowExpiry(now + damageBoostDuration);

        toast.success('✓ HIT! +25% damage for 3s!', { duration: 2000 });
      } else {
        // Chain mode: Big damage boost + stun

        const stunDuration = 2000; // 2 seconds stun
        const damageWindowDuration = 5000; // 5 seconds of 2x damage

        gameState.patchAttempt({
          // Stun the monster (pause attacks)
          isStunned: true,
          stunStartTime: now,
          stunEndTime: now + stunDuration,
          // Open damage window (2x damage)
          damageWindow: 2.0,
          damageWindowEndTime: now + damageWindowDuration,
        });
        scheduleStunExpiry(now + stunDuration);
        scheduleDamageWindowExpiry(now + damageWindowDuration);

        toast.success('💫 PERFECT! Stunned 2s + 2x damage for 5s!', { duration: 3000 });
      }
    };
  }, [skillShot.mode]);

  // SkillShot failure callback (chain mode only): Defense debuff penalty
  useEffect(() => {
    skillShot.onFailureRef.current = () => {

      // Apply defense reduction debuff using existing debuff system
      const defenseDebuff: DebuffEffect = {
        type: 'defense_reduction',
        damageType: 'flat', // Flat reduction (not DoT)
        damageAmount: 30, // -30 defense
        tickInterval: 5000, // Doesn't tick, just duration tracker
        duration: 5000, // 5 seconds
        applyChance: 100 // Always apply (0-100 scale; 1.0 meant 1% and was silently dropped)
      };

      applyDebuff(defenseDebuff, 'skillshot_failure');
      toast.error('❌ FAILED! -30 defense for 5s!', { duration: 2500 });
    };
  }, [applyDebuff]);

  // SkillShot miss callback (simple mode only): No penalty
  useEffect(() => {
    skillShot.onMissRef.current = () => {
      // No toast needed, just missed opportunity
    };
  }, []);

  // Callback for handling special attacks (damage, summon, heal, interactive)
  // Note: Healing is handled internally by useBossPhases hook
  const handleSpecialAttack = useCallback((attack: SpecialAttack) => {

    // Trigger visual feedback for phase attacks (unless interactive)
    if (!attack.interactive) {
      setPhaseAttack(attack);
      setTimeout(() => setPhaseAttack(null), 3500); // Clear after animation
    }

    // Check if this is an interactive attack
    if (attack.interactive && attack.objectHpPercent && attack.impactDelay && gameState.monster) {
      const objectMaxHP = Math.ceil((attack.objectHpPercent / 100) * gameState.monster.clicksRequired);
      const attackName = attack.message?.split(' ')[1] || attack.type.charAt(0).toUpperCase() + attack.type.slice(1);
      // Use imageUrl from attack definition, fallback to type-based icon
      const imageUrl = attack.imageUrl || (attack.type === 'meteor' ? '☄️' : attack.type === 'fireball' ? '🔥' : '💥');

      spawnAttack(
        attackName,
        objectMaxHP,
        attack.damage || 0,
        attack.impactDelay,
        attack.visualEffect,
        imageUrl
      );
      return; // Don't deal instant damage
    }

    // Non-interactive damage (apply defense reduction)
    if (attack.damage) {
      const totalStats = calculateTotalEquipmentStats(
        equippedWeapon,
        equippedArmor,
        equippedAccessory1,
        equippedAccessory2
      );
      const damageAfterDefense = calculateMonsterDamage(attack.damage, totalStats.defense);
      takeDamage(damageAfterDefense);
    }
    if (attack.healing) {
      // Healing is handled internally by useBossPhases hook
      // Also reduce total damage for tracking
      const healAmount = Math.ceil(attack.healing);
      gameState.addToAttempt('totalDamage', -(healAmount));
    }
    if (attack.type === 'summon' && attack.summons && gameState.monster) {
      addSummons(attack.summons.count, attack.summons.creature, gameState.monster.clicksRequired, gameState.monster.tier);
    }
  }, [takeDamage, addSummons, spawnAttack, gameState.monster]);

  // Expose healing tracking function via ref (for BattlePage to report consumable/spell healing)
  useEffect(() => {
    if (healingReportHandler) {
      healingReportHandler.current = (amount: number) => {
        gameState.addToAttempt('totalHealing', amount);
      };
    }
    return () => {
      if (healingReportHandler) {
        healingReportHandler.current = null;
      }
    };
  }, [healingReportHandler, totalHealing]);

  // Expose buff tracking function via ref (for BattlePage to report consumable/spell buffs)
  useEffect(() => {
    if (buffReportHandler) {
      buffReportHandler.current = (buffType: string, buffValue: number) => {
        if (buffType === 'shield') {
          gameState.addToAttempt('totalShieldGained', buffValue);
        } else if (buffType === 'damage_reduction') {
          gameState.addToAttempt('totalDamageReduction', buffValue);
        }
      };
    }
    return () => {
      if (buffReportHandler) {
        buffReportHandler.current = null;
      }
    };
  }, [buffReportHandler, totalShieldGained, totalDamageReduction]);

  // Expose shield removal function via ref (for Acid Vial consumable)
  useEffect(() => {
    if (removeMonsterShieldHandler) {
      removeMonsterShieldHandler.current = (): boolean => {
        if (shieldHP > 0) {
          gameState.patchAttempt({ shieldHP: 0 });
          return true; // Shield was removed
        }
        return false; // No shield existed
      };
    }
    return () => {
      if (removeMonsterShieldHandler) {
        removeMonsterShieldHandler.current = null;
      }
    };
  }, [removeMonsterShieldHandler, shieldHP]);

  // Determine if this is a boss monster (before calling hooks)
  const isBoss = gameState.monster?.isBoss && gameState.monster.bossPhases && gameState.monster.bossPhases.length > 0;

  // Memoized (stable identities) so useBossPhases' phase-transition effect only re-runs
  // on real phase/HP changes — unstable inline callbacks caused double toasts/heals/summons.
  const handleBossBattleComplete = useCallback(() => {
    // Handled in the effect below (needs latest damage/click values)
  }, []);
  const handleInvulnerabilityStart = useCallback((duration: number) => {
    gameState.addToAttempt('invulnerabilityTime', duration);
  }, []);

  // Boss phase management with stacked HP bar system (only for bosses)
  const bossPhaseData = useBossPhases({
    monster: isBoss ? gameState.monster : null, // Only pass monster if it's a boss
    battleStarted: gameState.canAttackMonster(),
    isSubmitting: gameState.gameState === 'BATTLE_COMPLETING',
    onPhaseAttack: handleSpecialAttack,
    onBattleComplete: handleBossBattleComplete,
    onInvulnerabilityStart: handleInvulnerabilityStart
  });

  // Simple HP tracking for regular monsters (only for non-bosses)
  const regularMonsterHP = useMonsterHP({
    monster: !isBoss ? gameState.monster : null // Only pass monster if it's NOT a boss
  });

  // Unified HP interface (works for both boss and regular monsters)
  const currentPhaseHP = isBoss ? bossPhaseData.currentPhaseHP : regularMonsterHP.currentHP;
  const maxPhaseHP = isBoss ? bossPhaseData.maxPhaseHP : regularMonsterHP.maxHP;
  const currentPhaseNumber = isBoss ? bossPhaseData.currentPhaseNumber : 1;
  const phasesRemaining = isBoss ? bossPhaseData.phasesRemaining : 1;
  const isInvulnerable = isBoss ? bossPhaseData.isInvulnerable : false;
  const damagePhase = isBoss ? bossPhaseData.damagePhase : regularMonsterHP.damageHP;
  const healPhase = isBoss ? bossPhaseData.healPhase : () => {}; // Regular monsters don't heal

  // The DoT loop is registered once for the whole attempt, so it reaches the current HP sink
  // through a ref rather than closing over an identity that flips with `isBoss`.
  const damagePhaseRef = useRef(damagePhase);
  damagePhaseRef.current = damagePhase;

  // Calculate defeat status for UI
  const isDefeated = isBoss
    ? (currentPhaseHP === 0 && phasesRemaining === 1 && maxPhaseHP > 0) // Only defeated if initialized
    // Display only - the victory trigger still keys on totalDamage alone. The attempt is null
    // in victory, so the HP fallback is what keeps the defeat overlay and victory panel up.
    : (gameState.monster
        ? totalDamage >= gameState.monster.clicksRequired
          || (regularMonsterHP.maxHP > 0 && regularMonsterHP.currentHP === 0)
        : false);
  const remainingHP = currentPhaseHP;
  const maxHP = maxPhaseHP;

  // Handle boss defeat (when all phases completed)
  useEffect(() => {
    if (currentPhaseHP === 0 && phasesRemaining === 1 && maxPhaseHP > 0 && gameState.monster?.isBoss && gameState.canAttackMonster() && gameState.gameState === 'BATTLE_IN_PROGRESS') {
      submitBattleCompletion(clickCount, totalDamage);
    }
  }, [currentPhaseHP, phasesRemaining, maxPhaseHP, gameState.monster, gameState.canAttackMonster, clickCount, totalDamage, gameState.gameState]);

  // Boss skillshot triggers at HP thresholds (75%, 50%, 25%)
  useEffect(() => {
    if (!gameState.monster?.isBoss) return;
    if (!gameState.canAttackMonster()) return;
    if (skillShot.isActive || skillShot.isOnCooldown) return;

    const currentHP = currentPhaseHP;
    const maxHP = maxPhaseHP;
    if (maxHP === 0) return;

    const currentPercent = (currentHP / maxHP) * 100;
    const thresholds = [75, 50, 25];

    // Check if we crossed any threshold
    for (const threshold of thresholds) {
      // If we were above threshold and now below, and haven't triggered this one yet
      if (lastHPPercent > threshold && currentPercent <= threshold && !triggeredThresholds.has(threshold)) {

        // Trigger chain mode skillshot
        const success = skillShot.triggerSkillShot('chain');
        if (success) {
          // Replaced, never mutated: Zustand compares by reference.
          gameState.patchAttempt({ triggeredThresholds: new Set(triggeredThresholds).add(threshold) });
          toast(`⚠️ Boss at ${threshold}% HP! Quick Time Event!`, { duration: 2000 });
        }
        break; // Only trigger one at a time
      }
    }

    // Runs every render (`gameState` is a fresh object), and patchAttempt always builds a new
    // attempt - so an unconditional write would loop forever. Only write on a real change.
    if (currentPercent !== lastHPPercent) {
      gameState.patchAttempt({ lastHPPercent: currentPercent });
    }
  }, [currentPhaseHP, maxPhaseHP, lastHPPercent, triggeredThresholds, gameState.monster, gameState, skillShot]);

  // Reset threshold tracking when new monster spawns
  useEffect(() => {
    if (gameState.monster) {
      gameState.patchAttempt({ lastHPPercent: 100, triggeredThresholds: new Set() });
    }
  }, [gameState.monster?._id]);

  // Handle regular monster defeat (from DoT, auto-hits, or manual clicks)
  useEffect(() => {
    // Skip if boss or no monster
    const isBoss = gameState.monster?.isBoss && gameState.monster.bossPhases && gameState.monster.bossPhases.length > 0;
    if (isBoss || !gameState.monster) return;

    // Check if regular monster is defeated
    const isDefeated = totalDamage >= gameState.monster.clicksRequired;

    // Only trigger if:
    // 1. Monster is defeated
    // 2. Battle is in progress (not already completing)
    // 3. Can attack (battle is active)
    if (isDefeated && gameState.gameState === 'BATTLE_IN_PROGRESS' && gameState.canAttackMonster()) {
      submitBattleCompletion(clickCount, totalDamage);
    }
  }, [totalDamage, gameState.monster, gameState.gameState, gameState.canAttackMonster, clickCount]);

  const { lastAttack } = useSpecialAttacks({
    monster: gameState.monster,
    battleStarted: gameState.canAttackMonster(),
    isSubmitting: gameState.gameState === 'BATTLE_COMPLETING',
    onSpecialAttack: handleSpecialAttack
  });

  // Wrapper function to handle shield absorption before taking damage
  const takeDamageWithShield = useCallback(async (amount: number) => {
    // Apply shield absorption first
    const damageAfterShield = damageShield(amount);

    // Take remaining damage (if any)
    if (damageAfterShield > 0) {
      await takeDamage(damageAfterShield);
    }
  }, [damageShield, takeDamage]);

  const handleThornsDamage = useCallback((amount: number) => {
    // Apply thorns damage to monster HP (doesn't count as click)
    damagePhase(amount);
    gameState.addToAttempt('thornsDamage', amount); // Track for anti-cheat
  }, [damagePhase]);

  const handleDefensiveLifesteal = useCallback((amount: number) => {
    // Track defensive lifesteal healing for anti-cheat
    gameState.addToAttempt('totalHealing', amount);
  }, []);

  // The one store->React bridge: the swing loop below and useDebuffs' DoT loop run inside the
  // scheduler, out of PlayerContext's reach, so they emit and this applies.
  const { isAttacking } = useBattleEffects({
    takeDamage: takeDamageWithShield,
    healHealth,
    maxHpBonus: equipmentStats.maxHpBonus,
    onThornsDamage: handleThornsDamage,
    onDefensiveLifesteal: handleDefensiveLifesteal,
    onDotEffect: (effect) => applyDebuff(effect, gameState.monster?._id),
  });

  // Everything the swing handler reads can change mid-battle, and the handler outlives the
  // render that registered it, so it reads through refs rather than a dependency array.
  const swingInputsRef = useRef({
    monster: gameState.monster,
    playerStats,
    isInvulnerable,
    isStunned,
    activeDebuffs,
    getTotalSummonDamage,
    checkSkillShotTrigger: skillShot.checkRandomTrigger,
  });
  swingInputsRef.current = {
    monster: gameState.monster,
    playerStats,
    isInvulnerable,
    isStunned,
    activeDebuffs,
    getTotalSummonDamage,
    checkSkillShotTrigger: skillShot.checkRandomTrigger,
  };

  // The monster's swing. Registered once; `nextDelay` re-reads attack speed each tick so
  // equipment swaps retune the cadence without resetting the anchor. The pauses are
  // handler-side for the same reason - tearing the loop down would grant a free interval.
  useEffect(() => {
    const canSwing = gameState.monster && gameState.session && !gameState.session.isDefeated
      && gameState.canAttackMonster();
    if (!canSwing) {
      battleScheduler.cancel('monsterSwing');
      return;
    }

    battleScheduler.repeat(
      'monsterSwing',
      () => calculateMonsterAttackInterval(1000, equipmentStatsRef.current.attackSpeed),
      () => {
        const live = swingInputsRef.current;
        const monster = live.monster;
        if (!monster || !live.playerStats || live.playerStats.currentHealth <= 0) return;
        if (live.isInvulnerable || live.isStunned) return;

        if (typeof monster.attackDamage !== 'number' || isNaN(monster.attackDamage)) {
          console.error('Invalid monster.attackDamage:', monster.attackDamage);
          return;
        }

        const equipment = equipmentStatsRef.current;

        // Effective defense = equipment defense minus any defense_reduction debuffs.
        const defenseReduction = live.activeDebuffs
          .filter(debuff => debuff.type === 'defense_reduction')
          .reduce((total, debuff) => total + debuff.damageAmount, 0);
        const effectiveDefense = Math.max(0, equipment.defense - defenseReduction);

        // Summon damage bypasses armor; the monster's own hit does not.
        const additionalDamage = live.getTotalSummonDamage();
        const totalDamage = calculateMonsterDamage(monster.attackDamage, effectiveDefense) + additionalDamage;

        // Guard stays here, not in the bridge: lifesteal must not revive a player this swing
        // kills, and anti-cheat must not be told about healing that never happened.
        const hpAfterDamage = Math.max(0, live.playerStats.currentHealth - totalDamage);
        const lifestealHeal = equipment.defensiveLifesteal > 0 && hpAfterDamage > 0
          ? Math.ceil(totalDamage * (equipment.defensiveLifesteal / 100))
          : 0;

        // Thorns reflect the pre-mitigation hit.
        const thornsDamage = equipment.thorns > 0
          ? Math.ceil((monster.attackDamage + additionalDamage) * (equipment.thorns / 100))
          : 0;

        battleEvents.emit('monsterAttacked', {
          damage: totalDamage,
          thornsDamage,
          lifestealHeal,
          dotEffect: monster.dotEffect,
        });

        // Store-side bookkeeping needs no bridge.
        live.checkSkillShotTrigger?.();
        if (additionalDamage > 0) {
          useBattleStore.getState().addToAttempt('summonDamage', additionalDamage);
        }
      },
    );

    return () => battleScheduler.cancel('monsterSwing');
  }, [gameState.gameState, gameState.session, gameState.monster]);

  // Auto-start initial battle when player stats load
  useEffect(() => {
    if (playerStats && !gameState.monster && gameState.canStartBattle()) {
      startBattle();
    }
  }, [playerStats, gameState.monster]);

  // Initialize monster buffs when battle starts. A Fast buff becomes a deadline registered
  // with the scheduler, rather than a decrementing number written once per second.
  useEffect(() => {
    if (!gameState.monster) return;

    const shieldBuff = gameState.monster.buffs?.find(b => b.type === 'shield');
    const fastBuff = gameState.monster.buffs?.find(b => b.type === 'fast');

    if (fastBuff && gameState.gameState === 'BATTLE_IN_PROGRESS') {
      const escapeAt = escapeDeadlineFrom(Date.now(), fastBuff.value);
      gameState.patchAttempt({ shieldHP: shieldBuff ? shieldBuff.value : 0, escapeAt });
      // The handler outlives this render, so it calls through a ref rather than closing
      // over handleMonsterEscape directly.
      battleScheduler.at('escape', escapeAt, () => {
        useBattleStore.getState().patchAttempt({ escapeAt: null });
        handleMonsterEscapeRef.current?.();
      });
    } else {
      battleScheduler.cancel('escape');
      gameState.patchAttempt({ shieldHP: shieldBuff ? shieldBuff.value : 0, escapeAt: null });
    }
  }, [gameState.monster, gameState.gameState]);

  // Check for player death
  useEffect(() => {
    if (playerStats && playerStats.currentHealth <= 0 && gameState.canAttackMonster()) {
      handlePlayerDeath();
    }
  }, [playerStats?.currentHealth, gameState.gameState]);

  const handlePlayerDeath = async () => {
    if (!playerStats || !gameState.session) return;
    // Authoritative + once-only: latch AFTER the guard so a transient null session
    // can't permanently block death handling (ref stays false → retries next render).
    if (hasHandledDeathRef.current) return;
    hasHandledDeathRef.current = true;

    // Clear all active debuffs and interactive attacks
    clearDebuffs();
    clearInteractiveAttacks();
    // Shield, escape timer, stun, damage window and monster debuffs all live in the attempt,
    // which playerDefeated below discards. Nothing to clear by hand.
    if (skillShot.isActive) {
      skillShot.handleComplete(); // Force close any active skillshot overlay
    }

    // Server owns the penalty (gold loss + streak reset); mark session defeated and read it back.
    let goldLost = 0, streakLost = 0;
    try {
      const res = await apiFetch('/api/end-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: gameState.session._id, outcome: 'defeated' }),
      });
      const data = await res.json();
      goldLost = data.goldLost ?? 0;
      streakLost = data.streakLost ?? 0;
    } catch (err) {
      console.error('Error ending battle session:', err);
    }
    await fetchPlayerStats(); // pull the server-applied penalty

    // Store defeat data and transition to defeat screen
    setDefeatData({ goldLost, streakLost });
    gameState.playerDefeated('death');
  };

  const handleDefeatContinue = async () => {
    setDefeatData({ goldLost: 0, streakLost: 0 });
    await resetHealth(equipmentStats.maxHpBonus);
    await startBattle();
  };

  const startBattle = async (useBiome?: BiomeId, useTier?: Tier, isConsecutiveBattle = false) => {
    try {
      gameState.loadingStarted();
      hasHandledDeathRef.current = false; // new battle: allow death to be handled again

      const biome = useBiome || selectedBiome;
      const tier = useTier || selectedTier;

      const requestBody: Record<string, any> = {};
      if (biome && tier) {
        requestBody.biome = biome;
        requestBody.tier = tier;
      }

      const response = await apiFetch('/api/start-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
      });

      if (!response.ok) throw new Error('Failed to start battle');

      const data = await response.json();

      // Always from zero: mid-battle click progress is not persisted server-side, so a
      // resumed session has nothing to restore. The transitions below build the attempt.

      // Sync biome/tier selection
      if (data.monster) {
        setBiomeTier(data.monster.biome, data.monster.tier);
      }

      // Handle different session states
      if (data.session.isDefeated && data.session.lootOptions && !data.session.selectedLootId) {
        // Restore pending loot selection
        const restoredLoot = getLootItemsByIds(data.session.lootOptions);
        // Seed the session first: on a cold load the store is `loading` with a null session,
        // and lootOffered no-ops without one — which stranded the page on the spinner.
        gameState.sessionLoaded(data.session, 'startScreen');
        gameState.lootOffered(restoredLoot);
      } else if (data.session.isDefeated && data.session.selectedLootId) {
        // Session already complete, start fresh battle
        gameState.loadingStarted();
        startBattle(biome || undefined, tier || undefined, false);
        return;
      } else if (!data.isNewSession) {
        // Resuming in-progress battle
        toast.success('Resuming battle', { duration: 2000 });
        gameState.sessionLoaded(data.session, 'startScreen');
      } else if (isConsecutiveBattle) {
        // Consecutive battle - skip start screen
        gameState.sessionLoaded(data.session, 'inProgress');
      } else {
        // New battle - show start screen
        gameState.sessionLoaded(data.session, 'startScreen');
      }

    } catch (err) {
      console.error('Error starting battle:', err);
      toast.error('Failed to start battle. Please refresh the page.');
      gameState.reset();
    }
  };

  const submitBattleCompletion = async (finalClickCount: number, finalTotalDamage: number) => {
    // The player is already dying: handlePlayerDeath has latched but is still awaiting
    // /api/end-battle. Submitting here would race it — if this POST won, playerDefeated
    // would land afterwards and yank away the loot modal. The store's lootOffered guard
    // covers the other ordering.
    if (hasHandledDeathRef.current) return;
    // Validation checks
    if (!gameState.monster || !gameState.session || !gameState.session.startedAt) return;
    if (gameState.gameState === 'BATTLE_COMPLETING') return;

    // Stop all attack sources IMMEDIATELY before state transition
    // This prevents race conditions where attacks land after victory is detected
    clearDebuffs();
    clearInteractiveAttacks();

    // Count the in-flight stun before clearing it; state updates won't land before the POST.
    const finalStunTimeMs = totalStunTime + (isStunned
      ? elapsedStunTime({ startedAt: stunStartTime, endsAt: stunEndTime, now: Date.now() })
      : 0);

    if (skillShot.isActive) {
      skillShot.handleComplete(); // Force close any active skillshot overlay
    }

    gameState.submissionStarted();

    try {
      const response = await apiFetch('/api/attack-monster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: gameState.session._id,
          clickCount: finalClickCount,
          totalDamage: finalTotalDamage,
          usedItems: {},
          currentShieldHP: totalShieldGained,
          damageReductionPercent: totalDamageReduction,
          actualHealing: totalHealing,
          invulnerabilityTimeMs: invulnerabilityTime,
          summonDamage: summonDamage,
          thornsDamage: thornsDamage,
          stunTimeMs: finalStunTimeMs,
          skillshotBonusDamage: skillshotBonusDamage
        }),
      });

      const data = await response.json();

      // Handle API errors
      if (!response.ok && data.error) {
        console.error('Battle completion error:', data.error);
        toast.error(`Failed to complete battle: ${data.error}`);
        gameState.submissionFailed();
        return;
      }

      // Handle cheat detection
      if (data.cheatingDetected) {
        setCheatModal({
          show: true,
          message: data.message || 'Suspicious click rate detected!'
        });
        clearInteractiveAttacks(); // Clear interactive attacks on cheat reset

        // Debuffs, stun and the damage window ride the attempt that attemptRestarted rebuilds.
        if (skillShot.isActive) {
          skillShot.handleComplete(); // Force close any active skillshot overlay
        }

        // The penalty is "restart at double HP". attemptRestarted mirrors the server's new
        // value onto the session so the HP hooks re-initialise instead of leaving the bar at
        // 0 — which, for bosses, fired the defeat effect immediately for a free win — and
        // builds the fresh attempt in the same transition.
        const penalisedClicksRequired = data.newClicksRequired;
        if (penalisedClicksRequired) {
          gameState.attemptRestarted(penalisedClicksRequired);
        } else {
          // No penalty to apply; hand control back rather than stranding the player mid-submit.
          gameState.submissionFailed();
        }
        return;
      }

      if (data.hpCheatDetected) {
        toast.error(data.message || 'You should have been defeated by the monster!\n\nYour battle session has been ended.');
        await handlePlayerDeath();
        return;
      }

      // Handle victory
      if (data.success && data.lootOptions) {
        // Server already incremented the zone streak in attack-monster; refetch to sync.
        await fetchPlayerStats();

        // Apply streak-based healing after victory (unless leveled up - level up does full heal)
        if (!data.levelUp && selectedBiome && selectedTier) {
          const currentStreak = getCurrentStreak(selectedBiome, selectedTier);
          let healPercent = 1.0; // 100%

          if (currentStreak === 0) {
            healPercent = 1.0; // 100%
          } else if (currentStreak <= 2) {
            healPercent = 0.8; // 80%
          } else if (currentStreak <= 5) {
            healPercent = 0.7; // 70%
          } else if (currentStreak <= 9) {
            healPercent = 0.6; // 60%
          } else if (currentStreak <= 24) {
            healPercent = 0.5; // 50%
          } else if (currentStreak <= 49) {
            healPercent = 0.4; // 40%
          } else if (currentStreak <= 99) {
            healPercent = 0.3; // 30%
          } else {
            healPercent = 0.2; // 20% - hardcore mode!
          }

          // Calculate total max HP with equipment bonuses
          const baseMaxHP = playerStats?.maxHealth || 100;
          const totalMaxHP = baseMaxHP + equipmentStats.maxHpBonus;
          const currentHP = playerStats?.currentHealth || totalMaxHP;

          // Apply equipment heal bonus (adds percentage points to base heal percent)
          const equipmentHealBonus = equipmentStats.healBonus / 100;
          const finalHealPercent = healPercent + equipmentHealBonus;

          // Calculate heal amount (percentage of total max HP)
          const healAmount = Math.ceil(totalMaxHP * finalHealPercent);
          const newHP = Math.min(totalMaxHP, currentHP + healAmount);

          // Update HP directly (partial heal based on streak + equipment)
          await updatePlayerStats({ currentHealth: newHP });

          // Show healing notification with equipment bonus if applicable
          const basePercentLabel = `${Math.round(healPercent * 100)}%`;
          const equipmentBonusLabel = equipmentStats.healBonus > 0 ? ` +${equipmentStats.healBonus}%` : '';
          const totalPercentLabel = equipmentStats.healBonus > 0 ? ` = ${Math.round(finalHealPercent * 100)}%` : '';
          toast.success(`Healed ${healAmount} HP (${basePercentLabel}${equipmentBonusLabel}${totalPercentLabel}) - Streak: ${currentStreak}`, { duration: 3000 });
        }

        // Convert loot IDs to full items if needed
        const lootItems = Array.isArray(data.lootOptions) && typeof data.lootOptions[0] === 'string'
          ? getLootItemsByIds(data.lootOptions)
          : data.lootOptions;

        // Update session and transition to loot selection
        if (gameState.session) {
          gameState.updateSession({ ...gameState.session, isDefeated: true, lootOptions: data.lootOptions });
        }
        gameState.lootOffered(lootItems);

        // Show level up notification
        if (data.levelUp) {
          toast.success(
            `🎊 LEVEL UP! ${data.levelUp.previousLevel} → ${data.levelUp.newLevel}\n` +
            `+${data.levelUp.statIncreases.maxHealth} Max HP, ` +
            `+${data.levelUp.statIncreases.baseDamage} Base Damage\n` +
            `HP Fully Restored!`,
            { duration: 5000 }
          );
        }

        // Show zone unlock notification
        if (data.unlockReason) {
          if (data.unlockReason === 'epic_boss') {
            toast.success('👹 Epic Mini-Boss Defeated! Next zone unlocked!', { duration: 4000 });
          } else if (data.unlockReason === '10_streak') {
            toast.success('🎯 10 Win Streak! Next zone unlocked!', { duration: 4000 });
          }
        }
      } else if (!data.cheatingDetected && !data.hpCheatDetected) {
        // If we reach here without success, something went wrong
        console.error('Unexpected response from battle completion:', data);
        toast.error('Failed to complete battle. Please try again.');
        gameState.submissionFailed();
      }

    } catch (err) {
      console.error('Error submitting battle completion:', err);
      toast.error('Failed to complete battle. Please try again.');
      gameState.submissionFailed();
    }
  };

  /**
   * Apply damage to monster (used by both manual clicks and auto-hits)
   * Handles: crit calculation, shield damage, boss phases, lifesteal
   */
  const applyDamageToMonster = useCallback((isAutoHit: boolean = false) => {
    if (!gameState.canAttackMonster() || gameState.session?.isDefeated) return;

    // Use player's base damage instead of defaulting to 1
    const baseDamage = playerStats?.baseDamage || 1;

    // Calculate damage multiplier from buffs (Berserker Rage, etc.)
    const buffDamageMultiplier = activeBuffs
      .filter(buff => buff.buffType === BuffType.DAMAGE_MULT)
      .reduce((sum, buff) => sum + buff.value, 0);
    const totalDamageMultiplier = 1.0 + (buffDamageMultiplier / 100); // 1.0 + (50% = 0.5) = 1.5x

    // Calculate total crit chance (base 5% + equipment + buffs)
    const baseCritChance = 5;
    const buffCritBoost = activeBuffs
      .filter(buff => buff.buffType === BuffType.CRIT_BOOST)
      .reduce((sum, buff) => sum + buff.value, 0);
    const totalCritChance = baseCritChance + equipmentStats.critChance + buffCritBoost;

    // Convert excess crit (>100%) to crit damage multiplier
    const excessCrit = Math.max(0, totalCritChance - 100);
    const critMultiplier = 2.0 + (excessCrit / 100); // Base 2x + excess crit

    let { damage, isCrit } = calculateClickDamage(
      baseDamage,
      equipmentStats.damageBonus,
      totalCritChance,
      critMultiplier
    );

    // Apply damage multiplier from buffs (AFTER crit calculation)
    damage = Math.floor(damage * totalDamageMultiplier);

    // Apply damage window multiplier from skillshot success (2x or 1.25x damage)
    if (damageWindow > 1.0) {
      const baseDamage = damage;
      damage = Math.floor(damage * damageWindow);
      const bonusDamage = damage - baseDamage;
      gameState.addToAttempt('skillshotBonusDamage', bonusDamage);
    }

    if (isCrit) {
      setCritTrigger(prev => prev + 1);
    }

    // Damage shield first if it exists (with 25% damage reduction)
    if (shieldHP > 0) {
      const reducedDamage = Math.ceil(damage * 0.75); // 25% damage reduction
      gameState.patchAttempt({ shieldHP: Math.max(0, shieldHP - reducedDamage) });
      return; // Shield absorbs all damage, excess is ignored
    }

    // Phase 2.5: Apply lifesteal healing (% of damage dealt)
    // ONLY works on manual clicks (not auto-hits) to prevent immortality
    if (!isAutoHit && equipmentStats.lifesteal && equipmentStats.lifesteal > 0) {
      const healAmount = Math.ceil(damage * (equipmentStats.lifesteal / 100));
      healHealth(healAmount, equipmentStats.maxHpBonus);
      // Track healing for cheat detection
      gameState.addToAttempt('totalHealing', healAmount);
    }

    // For bosses: use phase HP system via useBossPhases hook
    const isBoss = gameState.monster?.isBoss && gameState.monster.bossPhases && gameState.monster.bossPhases.length > 0;

    if (isBoss) {
      // Apply damage via useBossPhases hook (caps at phase boundary)
      damagePhase(damage);

      // Track total damage and actual click count
      gameState.addToAttempt('totalDamage', damage);
      if (!isAutoHit) {
        gameState.addToAttempt('clickCount', 1);
      }
    } else {
      // Non-boss: use regular click tracking
      const newTotalDamage = totalDamage + damage;
      const newClickCount = isAutoHit ? clickCount : clickCount + 1;
      gameState.patchAttempt({ totalDamage: newTotalDamage });
      if (!isAutoHit) {
        gameState.patchAttempt({ clickCount: newClickCount });
      }
      damagePhase(damage); // Also use hook for consistency

      // Check victory condition - pass current values to avoid stale state
      if (gameState.monster && newTotalDamage >= gameState.monster.clicksRequired) {
        submitBattleCompletion(newClickCount, newTotalDamage);
      }
    }
  }, [gameState, playerStats, equipmentStats, activeBuffs, shieldHP, totalDamage, clickCount, damagePhase, submitBattleCompletion, healHealth, damageWindow]);

  // Store applyDamageToMonster in ref to prevent interval resets
  useEffect(() => {
    applyDamageRef.current = applyDamageToMonster;
  }, [applyDamageToMonster]);

  const handleClick = () => {
    applyDamageToMonster(false);
  };

  /**
   * Phase 2.6: Handle spell cast effects (damage, healing, visual effects)
   */
  const handleSpellCast = useCallback((spellData: SpellCastData) => {
    if (!gameState.canAttackMonster() || gameState.session?.isDefeated) return;

    // Determine visual effect color based on spell effect
    let visualEffect = spellData.visualEffect || 'purple'; // Default purple for magic
    if (spellData.effect?.toLowerCase().includes('fire')) visualEffect = 'orange';
    if (spellData.effect?.toLowerCase().includes('ice')) visualEffect = 'blue';
    if (spellData.effect?.toLowerCase().includes('lightning') || spellData.effect?.toLowerCase().includes('electric')) visualEffect = 'blue';
    if (spellData.healing && spellData.healing > 0) visualEffect = 'green';

    // Trigger visual effect
    setSpellCast({
      type: spellData.damage ? 'fireball' : 'heal', // Use existing types for icon
      damage: spellData.damage,
      healing: spellData.healing,
      cooldown: 0,
      visualEffect,
      message: `✨ ${spellData.spellName}!`
    });

    // Clear visual effect after animation
    setTimeout(() => setSpellCast(null), 2500);

    // Apply spell damage to monster
    if (spellData.damage && spellData.damage > 0) {
      let damage = spellData.damage;

      // Damage shield first if it exists (with 25% damage reduction)
      if (shieldHP > 0) {
        const reducedDamage = Math.ceil(damage * 0.75); // 25% damage reduction
        gameState.patchAttempt({ shieldHP: Math.max(0, shieldHP - reducedDamage) });
        return; // Shield absorbs all damage, excess is ignored
      }

      // For bosses: use phase HP system
      const isBoss = gameState.monster?.isBoss && gameState.monster.bossPhases && gameState.monster.bossPhases.length > 0;

      if (isBoss) {
        // Apply damage via useBossPhases hook (caps at phase boundary)
        damagePhase(damage);
        gameState.addToAttempt('totalDamage', damage);
      } else {
        // Non-boss: use regular damage tracking
        const newTotalDamage = totalDamage + damage;
        gameState.patchAttempt({ totalDamage: newTotalDamage });
        damagePhase(damage);

        // Check victory condition
        if (gameState.monster && newTotalDamage >= gameState.monster.clicksRequired) {
          submitBattleCompletion(clickCount, newTotalDamage);
        }
      }
    }

    // Apply monster debuff if spell provides one
    if (spellData.debuffType && spellData.debuffValue && spellData.duration) {
      const debuffStartTime = Date.now();
      const durationMs = spellData.duration * 1000; // Convert to milliseconds
      const newDebuff: MonsterDebuff = {
        id: `${spellData.debuffType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: spellData.debuffType,
        damageAmount: spellData.debuffValue,
        damageType: spellData.debuffDamageType || 'flat',
        duration: durationMs,
        startTime: debuffStartTime,
        expiresAt: debuffStartTime + durationMs,
        tickInterval: 1000 // DoT ticks every second
      };
      // New array, not a push: Zustand compares by reference.
      gameState.patchAttempt({ monsterDebuffs: [...monsterDebuffs, newDebuff] });
    }

    // Healing is handled by parent (BattlePage) via healHealth
  }, [gameState, shieldHP, totalDamage, clickCount, monsterDebuffs, damagePhase, submitBattleCompletion]);

  // Phase 2.6: Assign spell damage handler to ref so parent can call it
  useEffect(() => {
    if (spellDamageHandler) {
      spellDamageHandler.current = handleSpellCast;
    }
    return () => {
      if (spellDamageHandler) {
        spellDamageHandler.current = null;
      }
    };
  }, [handleSpellCast, spellDamageHandler]);

  // Phase 2.6: Monster debuff management (auto-removal and DoT ticking).
  // One registration for the whole attempt: the handler no-ops on an empty list, so a debuff
  // being applied or expiring must not tear the loop down and rebuild it.
  useEffect(() => {
    if (!gameState.canAttackMonster()) {
      battleScheduler.cancel('monsterDot');
      return;
    }

    battleScheduler.repeat('monsterDot', () => 500, () => {
      const now = Date.now();
      const store = useBattleStore.getState();
      const liveState = store.state;
      const current = liveState.phase === 'inProgress' || liveState.phase === 'completing'
        ? liveState.attempt.monsterDebuffs
        : [];
      if (current.length === 0) return;

      // Remove expired debuffs and apply DoT damage
      const stillActive = current.filter(debuff => {
        const elapsed = now - debuff.startTime;
        const expired = elapsed >= debuff.duration;

        // Apply DoT damage if debuff is still active and is a DoT type
        if (!expired && debuff.damageAmount && ['poison', 'burn', 'bleed'].includes(debuff.type)) {
          const shouldTick = Math.floor(elapsed / (debuff.tickInterval || 1000)) > Math.floor((elapsed - 500) / (debuff.tickInterval || 1000));
          if (shouldTick) {
            // Apply debuff damage to monster (bypasses shield)
            // DoT damage should NEVER crit - it's flat damage based on debuff.damageAmount
            const damage = debuff.damageAmount; // Store to satisfy TypeScript
            damagePhaseRef.current(damage);
            store.addToAttempt('totalDamage', damage);
          }
        }

        return !expired;
      });

      // filter only ever removes, so a length match means nothing expired. Skipping the
      // write avoids a new attempt object - and a whole-tree re-render - every 500ms.
      if (stillActive.length !== current.length) {
        store.patchAttempt({ monsterDebuffs: stillActive });
      }
    });

    return () => battleScheduler.cancel('monsterDot');
  }, [gameState.gameState]);

  // Phase 2.5: Auto-hit driven by equipment autoClickRate.
  // Registered once while auto-hit is available; `nextDelay` re-reads the live rate every base
  // tick, so an equipment swap changes the cadence without resetting the anchor.
  const hasAutoClick = (equipmentStats.autoClickRate || 0) > 0;
  useEffect(() => {
    // Only run auto-hits during active battle, and only with a non-zero rate.
    if (!hasAutoClick || !gameState.canAttackMonster() || !gameState.session || gameState.session.isDefeated) {
      battleScheduler.cancel('autohit');
      return;
    }

    battleScheduler.repeat(
      'autohit',
      () => {
        const rawAutoClickRate = equipmentStatsRef.current.autoClickRate || 0;
        // Diminishing returns prevent autoclick abuse at high tiers.
        const effectiveAutoClickRate = calculateEffectiveAutoClickRate(rawAutoClickRate);
        if (effectiveAutoClickRate <= 0) return Number.POSITIVE_INFINITY; // idle until the rate returns
        return Math.floor(1000 / effectiveAutoClickRate);
      },
      () => {
        // Use ref to keep the registration stable as the damage function is rebuilt.
        applyDamageRef.current?.(true);
      },
    );

    return () => battleScheduler.cancel('autohit');
  }, [hasAutoClick, gameState.gameState, gameState.session]);

  const handleSummonClick = (summonId: string) => {
    if (!gameState.canAttackMonster() || gameState.session?.isDefeated) return;

    // Use player's base damage instead of defaulting to 1
    const baseDamage = playerStats?.baseDamage || 1;
    let { damage, isCrit } = calculateClickDamage(
      baseDamage,
      equipmentStats.damageBonus,
      equipmentStats.critChance
    );

    if (isCrit) {
      setCritTrigger(prev => prev + 1);
    }

    // Damage the summon
    const defeated = damageSummon(summonId, damage);

    // Remove defeated summons after a brief delay for visual feedback
    if (defeated) {
      setTimeout(() => {
        removeDefeatedSummons();
      }, 500);
    }
  };

  const handleInteractiveAttackClick = (attackId: string) => {
    if (!gameState.canAttackMonster() || gameState.session?.isDefeated) return;

    // Use player's base damage instead of defaulting to 1
    const baseDamage = playerStats?.baseDamage || 1;
    let { damage, isCrit } = calculateClickDamage(
      baseDamage,
      equipmentStats.damageBonus,
      equipmentStats.critChance
    );

    if (isCrit) {
      setCritTrigger(prev => prev + 1);
    }

    // Damage the interactive attack
    damageAttack(attackId, damage);
  };

  const handleMonsterEscape = async () => {
    if (!gameState.session) return;

    // Clear all active debuffs and interactive attacks
    clearDebuffs();
    clearInteractiveAttacks();

    toast.error('The monster escaped!', { duration: 3000 });

    // Treat escape as battle loss (same as player death) - server owns the penalty.
    let goldLost = 0, streakLost = 0;
    try {
      const res = await apiFetch('/api/end-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: gameState.session._id, outcome: 'escaped' }),
      });
      const data = await res.json();
      goldLost = data.goldLost ?? 0;
      streakLost = data.streakLost ?? 0;
    } catch (err) {
      console.error('Error ending battle after escape:', err);
    }
    await fetchPlayerStats(); // pull the server-applied penalty

    setDefeatData({ goldLost, streakLost });
    gameState.playerDefeated('escape');
  };
  // Kept current every render so the scheduled 'escape' deadline callback (registered once,
  // possibly renders ago) always reaches the latest closure instead of a stale one.
  handleMonsterEscapeRef.current = handleMonsterEscape;

  const closeCheatModal = () => {
    setCheatModal({ show: false, message: '' });
  };

  const handleLootSelection = useCallback(async (loot: LootItem) => {
    if (!gameState.session) return;

    try {
      const response = await apiFetch('/api/select-loot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: gameState.session._id,
          lootId: loot.lootId,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save loot selection');

      setTimeout(() => gameState.lootResolved(), 500);
    } catch (err) {
      console.error('Error saving loot selection:', err);
      toast.error('Failed to save loot selection. Please try again.');
    }
  }, [gameState.session, gameState]);

  const handleSkipLoot = useCallback(async () => {
    if (!gameState.session) return;

    try {
      const response = await apiFetch('/api/select-loot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: gameState.session._id,
          lootId: 'SKIPPED',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to skip loot selection');

      setTimeout(() => gameState.lootResolved(), 300);
    } catch (err) {
      console.error('Error skipping loot selection:', err);
      toast.error('Failed to skip loot selection. Please try again.');
    }
  }, [gameState.session, gameState]);

  const handleNextMonster = async (overrideBiome?: BiomeId, overrideTier?: Tier) => {
    clearDebuffs();
    clearInteractiveAttacks();
    // startBattle below transitions through a fresh attempt, which is what clears the
    // shield, escape timer, monster debuffs, stun and damage window.
    if (skillShot.isActive) {
      skillShot.handleComplete(); // Force close any active skillshot overlay
    }

    // Determine which zone we're starting the battle in
    // Use override if provided (from BiomeMapWidget zone change), otherwise use current selection
    const battleBiome = overrideBiome || selectedBiome;
    const battleTier = overrideTier || selectedTier;

    // Update BiomeContext if override was provided (zone was changed)
    if (overrideBiome && overrideTier) {
      setBiomeTier(overrideBiome, overrideTier);
    }

    // No healing here - healing happens after battle victory (with streak reduction)
    // This just starts the next battle
    await fetchPlayerStats();
    await startBattle(overrideBiome, overrideTier, true);
  };

  const handleStartBattle = async () => {
    if (!gameState.session) return;

    // Update battle timer on server (non-blocking)
    try {
      const response = await apiFetch('/api/start-battle-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: gameState.session._id })
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.actualBattleStartedAt) {
        gameState.updateSession({
          ...gameState.session,
          actualBattleStartedAt: data.actualBattleStartedAt
        });
      }
    } catch (error) {
      console.error('Failed to start battle timer:', error);
    }

    gameState.battleStarted();
  };

  // Loading state
  if (gameState.isLoading()) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 bg-black/30 backdrop-blur-sm rounded-lg border border-white/20 min-h-[400px]">
        <div className="text-white text-2xl animate-pulse">Loading battle...</div>
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  // Loot selection modal
  if (gameState.canShowLootModal() && gameState.lootOptions) {
    return (
      <div className="flex flex-col items-center gap-4 sm:gap-6 max-w-2xl w-full">
        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-4">Monster Battle</h1>
        <LootSelectionModal
          lootOptions={gameState.lootOptions}
          tier={gameState.session?.tier || 1}
          isCorrupted={gameState.monster?.isCorrupted}
          onLootSelect={handleLootSelection}
          onSkip={handleSkipLoot}
        />
      </div>
    );
  }

  // Error state - no monster or session loaded
  if (!gameState.monster || !gameState.session) {
    if (gameState.isLoading()) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-12 bg-black/30 backdrop-blur-sm rounded-lg border border-white/20 min-h-[400px]">
          <div className="text-white text-2xl animate-pulse">Loading battle...</div>
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 bg-black/30 backdrop-blur-sm rounded-lg border border-white/20 min-h-[400px]">
        <div className="text-red-400 text-2xl mb-4">Failed to load battle</div>
        <button
          onClick={() => startBattle()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Player Spell Visual Feedback (separate instance to prevent race conditions) */}
      <SpecialAttackFlash attack={spellCast} />

      {/* Monster Special Attack Visual Feedback (phases > regular attacks) */}
      <SpecialAttackFlash attack={phaseAttack || lastAttack} />

      {/* SkillShot System - Dual mode (Simple/Chain) */}
      {(() => {
        return skillShot.mode === 'simple' ? (
          <SkillShotSingle
            isActive={skillShot.isActive}
            duration={skillShot.circleDuration}
            onSuccess={skillShot.handleSuccess}
            onMiss={skillShot.handleMiss}
            onComplete={skillShot.handleComplete}
          />
        ) : (
          <SkillShotChain
            isActive={skillShot.isActive}
            circleCount={skillShot.circleCount}
            duration={skillShot.circleDuration}
            onSuccess={skillShot.handleSuccess}
            onFailure={skillShot.handleFailure}
            onComplete={skillShot.handleComplete}
          />
        );
      })()}

      <div className="flex flex-col items-center gap-4 sm:gap-6 max-w-2xl w-full">
        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-4">Monster Battle</h1>

      {/* Monster Info */}
      <div className="text-center mb-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">{gameState.monster.name}</h2>
        <div className="flex items-center justify-center gap-2">
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            gameState.monster.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white' :
            gameState.monster.rarity === 'epic' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
            gameState.monster.rarity === 'rare' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
            'bg-gray-500 text-white'
          }`}>
            {gameState.monster.rarity.toUpperCase()}
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-700 text-gray-200">
            {getBiomeTierDisplayName(gameState.monster.biome, gameState.monster.tier)}
          </span>
        </div>
      </div>

      {/* Monster Buffs */}
      {gameState.monster.buffs && gameState.monster.buffs.length > 0 && (
        <div className="w-full flex justify-center">
          <BuffIndicators buffs={gameState.monster.buffs} size="medium" />
        </div>
      )}

      {/* Monster Debuffs (from player spells) */}
      {monsterDebuffs.length > 0 && (
        <div className="w-full flex justify-center mt-2">
          <MonsterDebuffIndicators debuffs={monsterDebuffs} size="medium" showDuration={true} />
        </div>
      )}

      {/* Escape Timer (Fast Buff) — owns its own render ticker, so it only re-renders
          (and only exists) while a Fast monster is on screen. */}
      {escapeAt !== null && <EscapeCountdown deadline={escapeAt} />}

      {/* Monster + Summons Battle Area - Responsive Layout */}
      <div className="relative flex items-center justify-center gap-2 sm:gap-4 md:gap-8 w-full flex-wrap md:flex-nowrap">
        {/* Interactive Attacks - Positioned absolutely at top of arena */}
        {interactiveAttacks.map((attack) => (
          <InteractiveAttackCard
            key={attack.id}
            attack={attack}
            isDestroyed={attack.currentHP <= 0}
            onAttack={() => handleInteractiveAttackClick(attack.id)}
          />
        ))}

        {/* Left Summon - Hidden placeholder on mobile when empty */}
        <div className="flex-shrink-0">
          {getLeftSummon() ? (
            <SummonCard
              summon={getLeftSummon()!}
              isDefeated={getLeftSummon()!.currentHP <= 0}
              onAttack={() => handleSummonClick(getLeftSummon()!.id)}
            />
          ) : (
            <div className="hidden md:block w-40 h-40" /> // Placeholder only on desktop
          )}
        </div>

        {/* Monster Battle Arena - Center piece, always visible */}
        <div className="flex-shrink-0">
          {gameState.monster.isCorrupted ? (
            <CorruptionOverlay showLabel={true} size="large" className="rounded-2xl overflow-hidden w-fit">
              <MonsterBattleArena
                monster={gameState.monster}
                isAttacking={isAttacking}
                isDefeated={isDefeated}
                isInvulnerable={isInvulnerable}
                onAttack={handleClick}
                critTrigger={critTrigger}
              />
            </CorruptionOverlay>
          ) : (
            <MonsterBattleArena
              monster={gameState.monster}
              isAttacking={isAttacking}
              isDefeated={isDefeated}
              isInvulnerable={isInvulnerable}
              onAttack={handleClick}
              critTrigger={critTrigger}
            />
          )}
        </div>

        {/* Right Summon - Hidden placeholder on mobile when empty */}
        <div className="flex-shrink-0">
          {getRightSummon() ? (
            <SummonCard
              summon={getRightSummon()!}
              isDefeated={getRightSummon()!.currentHP <= 0}
              onAttack={() => handleSummonClick(getRightSummon()!.id)}
            />
          ) : (
            <div className="hidden md:block w-40 h-40" /> // Placeholder only on desktop
          )}
        </div>
      </div>

      {/* Shield HP Bar */}
      {shieldHP > 0 && (() => {
        // Determine shield background color based on what's underneath (phase color or regular HP)
        let shieldBgColor = 'from-red-600 to-red-500'; // Default: regular HP color

        if (gameState.monster.isBoss && phasesRemaining > 1) {
          // Boss with multiple phases - use current phase color as background
          const totalPhasesOriginal = gameState.monster.bossPhases?.length ? gameState.monster.bossPhases.length + 1 : 1;

          // Determine current phase color (same logic as BossPhaseIndicator)
          if (totalPhasesOriginal >= 4) {
            if (currentPhaseNumber === 1) shieldBgColor = 'from-gray-700 to-gray-800';
            else if (currentPhaseNumber === 2) shieldBgColor = 'from-purple-600 to-purple-500';
            else if (currentPhaseNumber === 3) shieldBgColor = 'from-yellow-500 to-orange-500';
          } else if (totalPhasesOriginal === 3) {
            if (currentPhaseNumber === 1) shieldBgColor = 'from-purple-600 to-purple-500';
            else if (currentPhaseNumber === 2) shieldBgColor = 'from-yellow-500 to-orange-500';
          } else if (totalPhasesOriginal === 2) {
            shieldBgColor = 'from-yellow-500 to-orange-500'; // Orange for 2-phase boss
          }
        }

        const shieldMaxHP = gameState.monster.buffs?.find(b => b.type === 'shield')?.value || shieldHP;
        const shieldPercent = Math.min(100, (shieldHP / shieldMaxHP) * 100);

        return (
          <div className="w-full">
            <div className="flex justify-between mb-2">
              <span className="text-blue-400 font-semibold flex items-center gap-2">
                <span>🛡️</span>
                <span>Shield</span>
                <span className="text-xs bg-blue-500/30 px-2 py-0.5 rounded-full border border-blue-400">
                  -25% Damage
                </span>
              </span>
              <span className="text-blue-400 font-semibold">
                {shieldHP} / {shieldMaxHP}
              </span>
            </div>
            <div className="relative w-full rounded-full h-6 overflow-hidden border-2 border-blue-400">
              {/* Background: Phase color or regular HP color */}
              <div className={`absolute inset-0 bg-gradient-to-r ${shieldBgColor}`} />

              {/* Foreground: Blue shield (depletes) */}
              <div
                className="relative h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${shieldPercent}%` }}
              />

              {/* Shield label */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-xs font-bold drop-shadow-lg z-10">
                  SHIELD
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* HP Bar / Boss Phase Indicator */}
      <BossPhaseIndicator
        monster={gameState.monster}
        currentHP={currentPhaseHP}
        maxHP={maxPhaseHP}
        currentPhase={currentPhaseNumber}
        totalPhases={phasesRemaining}
        phaseHP={[currentPhaseHP]}
        isInvulnerable={isInvulnerable}
      />

      {/* Victory: Calculating rewards */}
      {isDefeated && gameState.gameState === 'BATTLE_COMPLETING' && (
        <div className="hidden sm:block mt-4 p-6 bg-green-500/20 rounded-lg border-2 border-green-400 animate-pulse">
          <p className="text-green-400 text-xl font-bold text-center">
            🎉 Victory! Monster Defeated! 🎉
          </p>
          <p className="text-white text-center mt-2">
            Calculating rewards...
          </p>
        </div>
      )}

      {/* Victory: Rest phase */}
      {isDefeated && gameState.gameState === 'BATTLE_VICTORY' && (
        <div className="hidden sm:block mt-3 sm:mt-4 p-4 sm:p-6 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-lg border border-green-400 sm:border-2">
          <p className="text-green-400 text-base sm:text-xl font-bold text-center mb-1.5 sm:mb-2">
            🎉 Victory Complete! 🎉
          </p>
          <p className="text-white text-sm sm:text-base text-center mb-2 sm:mb-3">
            Loot claimed! Take your time to prepare for the next battle.
          </p>
          <div className="text-center text-xs sm:text-sm text-gray-300 space-y-0.5 sm:space-y-1">
            <p>• Check your equipment and stats</p>
            <p>• Review your inventory</p>
            <p>• Ready for the next challenge? →</p>
          </div>
        </div>
      )}

      {/* Submitting Message */}
      {gameState.gameState === 'BATTLE_COMPLETING' && (
        <div className="mt-4 p-4 bg-blue-500/20 rounded-lg border border-blue-400">
          <p className="text-blue-400 text-center">
            Validating your victory...
          </p>
        </div>
      )}

      {/* Next Monster Button - Fixed position right middle */}
      {gameState.canShowNextMonsterButton() && (
        <button
          onClick={() => handleNextMonster()}
          className="fixed right-2 top-1/2 -translate-y-1/2 md:right-8 flex flex-col items-center gap-1 sm:gap-2 px-4 py-3 sm:px-6 sm:py-8 bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl sm:rounded-2xl shadow-2xl transition-all duration-300 hover:scale-110 animate-pulse border-2 sm:border-4 border-green-400 cursor-pointer z-40"
        >
          <span className="text-sm sm:text-lg">Next</span>
          <span className="text-sm sm:text-lg">Monster</span>
          <span className="text-2xl sm:text-4xl">→</span>
        </button>
      )}

      {/* Cheat Detection Modal */}
      <CheatDetectionModal
        show={cheatModal.show}
        message={cheatModal.message}
        onClose={closeCheatModal}
      />

      {/* Battle Start Screen */}
      {gameState.gameState === 'BATTLE_START_SCREEN' && gameState.monster && (
        <BattleStartScreen
          monsterName={gameState.monster.name}
          monsterRarity={gameState.monster.rarity}
          monsterIcon={gameState.monster.imageUrl}
          onStartBattle={handleStartBattle}
        />
      )}

      {/* Battle Defeat Screen */}
      {gameState.canShowDefeatScreen() && gameState.monster && (
        <BattleDefeatScreen
          monsterName={gameState.monster.name}
          monsterRarity={gameState.monster.rarity}
          monsterIcon={gameState.monster.imageUrl}
          goldLost={defeatData.goldLost}
          streakLost={defeatData.streakLost}
          onContinue={handleDefeatContinue}
        />
      )}
    </div>
    </>
  );
}
