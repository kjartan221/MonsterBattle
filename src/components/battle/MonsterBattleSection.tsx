'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import type { MonsterFrontend, BattleSessionFrontend } from '@/lib/types';
import type { LootItem } from '@/lib/loot-table';
import { getLootItemsByIds } from '@/lib/loot-table';
import { BiomeId, Tier, getBiomeTierDisplayName } from '@/lib/biome-config';
import { usePlayer } from '@/contexts/PlayerContext';
import { useBiome } from '@/contexts/BiomeContext';
import { useEquipment } from '@/contexts/EquipmentContext';
import { useGameState } from '@/contexts/GameStateContext';
import { useMonsterAttack } from '@/hooks/useMonsterAttack';
import { useSpecialAttacks } from '@/hooks/useSpecialAttacks';
import { useSummonedCreatures } from '@/hooks/useSummonedCreatures';
import { useInteractiveAttacks } from '@/hooks/useInteractiveAttacks';
import { useBossPhases } from '@/hooks/useBossPhases';
import { useMonsterHP } from '@/hooks/useMonsterHP';
import type { DebuffEffect, SpecialAttack } from '@/lib/types';
import { calculateTotalEquipmentStats, calculateClickDamage } from '@/utils/equipmentCalculations';
import LootSelectionModal from '@/components/battle/LootSelectionModal';
import CheatDetectionModal from '@/components/battle/CheatDetectionModal';
import BattleStartScreen from '@/components/battle/BattleStartScreen';
import BattleDefeatScreen from '@/components/battle/BattleDefeatScreen';
import MonsterBattleArena from '@/components/battle/MonsterBattleArena';
import SummonCard from '@/components/battle/SummonCard';
import InteractiveAttackCard from '@/components/battle/InteractiveAttackCard';
import BuffIndicators from '@/components/battle/BuffIndicators';
import SpecialAttackFlash from '@/components/battle/SpecialAttackFlash';
import BossPhaseIndicator from '@/components/battle/BossPhaseIndicator';
import CorruptionOverlay from '@/components/battle/CorruptionOverlay';

interface MonsterBattleSectionProps {
  onBattleComplete?: () => void;
  applyDebuff: (effect: DebuffEffect, appliedBy?: string) => boolean;
  clearDebuffs: () => void;
}

export default function MonsterBattleSection({ onBattleComplete, applyDebuff, clearDebuffs }: MonsterBattleSectionProps) {
  const { playerStats, resetHealth, incrementStreak, resetStreak, getCurrentStreak, takeDamage, updatePlayerStats, fetchPlayerStats } = usePlayer();
  const { selectedBiome, selectedTier, setBiomeTier } = useBiome();
  const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2 } = useEquipment();
  const gameState = useGameState();

  // Local battle progress state
  const [totalDamage, setTotalDamage] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const [lastSavedClickCount, setLastSavedClickCount] = useState(0);
  const [critTrigger, setCritTrigger] = useState(0);
  const [defeatData, setDefeatData] = useState<{ goldLost: number; streakLost: number }>({
    goldLost: 0,
    streakLost: 0
  });
  const [cheatModal, setCheatModal] = useState<{ show: boolean; message: string }>({
    show: false,
    message: ''
  });

  // Monster buff tracking
  const [shieldHP, setShieldHP] = useState<number>(0);
  const [escapeTimer, setEscapeTimer] = useState<number | null>(null); // Seconds remaining

  // Phase attack visual feedback (separate from regular special attacks)
  const [phaseAttack, setPhaseAttack] = useState<SpecialAttack | null>(null);

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

  // Interactive attacks management (must come before handleSpecialAttack)
  const {
    attacks: interactiveAttacks,
    spawnAttack,
    damageAttack,
    clearAttacks: clearInteractiveAttacks
  } = useInteractiveAttacks({
    onImpact: (damage, visualEffect) => {
      console.log(`💥 Interactive Attack Impacted! Dealt ${damage} damage`);
      takeDamage(damage);
      // Trigger visual feedback
      setPhaseAttack({
        type: 'meteor',
        damage,
        cooldown: 0,
        visualEffect: visualEffect || 'red',
        message: '💥 Attack impacted!'
      });
      setTimeout(() => setPhaseAttack(null), 3500);
    }
  });

  // Callback for handling special attacks (damage, summon, heal, interactive)
  // Note: Healing is handled internally by useBossPhases hook
  const handleSpecialAttack = useCallback((attack: SpecialAttack) => {
    console.log(`[handleSpecialAttack] Called with attack:`, attack);

    // Trigger visual feedback for phase attacks (unless interactive)
    if (!attack.interactive) {
      setPhaseAttack(attack);
      setTimeout(() => setPhaseAttack(null), 3500); // Clear after animation
    }

    // Check if this is an interactive attack
    if (attack.interactive && attack.objectHpPercent && attack.impactDelay && gameState.monster) {
      console.log(`🎯 Interactive Attack! Spawning ${attack.type}`);
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

    // Non-interactive damage
    if (attack.damage) {
      console.log(`💥 Special Attack Hit! ${attack.type} dealt ${attack.damage} damage`);
      takeDamage(attack.damage);
    }
    if (attack.healing) {
      console.log(`💚 Boss Healed! ${attack.type} restored ${attack.healing} HP (handled by useBossPhases)`);
      // Healing is handled internally by useBossPhases hook
      // Also reduce total damage for tracking
      const healAmount = Math.ceil(attack.healing);
      setTotalDamage(prev => Math.max(0, prev - healAmount));
    }
    if (attack.type === 'summon' && attack.summons && gameState.monster) {
      console.log(`✨ Boss summoned ${attack.summons.count} ${attack.summons.creature.name}(s)!`);
      console.log(`[handleSpecialAttack] Summon details:`, attack.summons);
      addSummons(attack.summons.count, attack.summons.creature, gameState.monster.clicksRequired);
    }
  }, [takeDamage, addSummons, spawnAttack, gameState.monster]);

  // Determine if this is a boss monster (before calling hooks)
  const isBoss = gameState.monster?.isBoss && gameState.monster.bossPhases && gameState.monster.bossPhases.length > 0;

  // Boss phase management with stacked HP bar system (only for bosses)
  const bossPhaseData = useBossPhases({
    monster: isBoss ? gameState.monster : null, // Only pass monster if it's a boss
    battleStarted: gameState.canAttackMonster(),
    isSubmitting: gameState.gameState === 'BATTLE_COMPLETING',
    onPhaseAttack: handleSpecialAttack,
    onBattleComplete: () => {
      console.log(`[MonsterBattleSection] onBattleComplete triggered`);
      // Will handle in useEffect below to access latest damage/click values
    }
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

  // Calculate defeat status for UI
  const isDefeated = isBoss
    ? (currentPhaseHP === 0 && phasesRemaining === 1 && maxPhaseHP > 0) // Only defeated if initialized
    : (gameState.monster ? totalDamage >= gameState.monster.clicksRequired : false);
  const remainingHP = currentPhaseHP;
  const maxHP = maxPhaseHP;

  // Handle boss defeat (when all phases completed)
  useEffect(() => {
    if (currentPhaseHP === 0 && phasesRemaining === 1 && maxPhaseHP > 0 && gameState.monster?.isBoss && gameState.canAttackMonster() && gameState.gameState === 'BATTLE_IN_PROGRESS') {
      console.log(`[MonsterBattleSection] useEffect detected boss defeat, calling submitBattleCompletion with ${clickCount} clicks, ${totalDamage} damage`);
      submitBattleCompletion(clickCount, totalDamage);
    }
  }, [currentPhaseHP, phasesRemaining, maxPhaseHP, gameState.monster, gameState.canAttackMonster, clickCount, totalDamage, gameState.gameState]);

  const { lastAttack } = useSpecialAttacks({
    monster: gameState.monster,
    battleStarted: gameState.canAttackMonster(),
    isSubmitting: gameState.gameState === 'BATTLE_COMPLETING',
    onSpecialAttack: handleSpecialAttack
  });

  // Monster attack system with debuff application
  const { isAttacking } = useMonsterAttack({
    monster: gameState.monster,
    session: gameState.session,
    battleStarted: gameState.canAttackMonster(),
    isSubmitting: gameState.gameState === 'BATTLE_COMPLETING',
    isInvulnerable: isInvulnerable,
    playerStats,
    takeDamage,
    equipmentStats,
    applyDebuff,
    additionalDamage: getTotalSummonDamage()
  });

  // Auto-start initial battle when player stats load
  useEffect(() => {
    if (playerStats && !gameState.monster && gameState.canStartBattle()) {
      startBattle();
    }
  }, [playerStats, gameState.monster]);

  // Initialize monster buffs when battle starts
  useEffect(() => {
    if (!gameState.monster) return;

    // Initialize shield HP
    const shieldBuff = gameState.monster.buffs?.find(b => b.type === 'shield');
    if (shieldBuff) {
      setShieldHP(shieldBuff.value);
      console.log(`[MonsterBattleSection] Shield initialized: ${shieldBuff.value} HP`);
    } else {
      setShieldHP(0);
    }

    // Initialize escape timer
    const fastBuff = gameState.monster.buffs?.find(b => b.type === 'fast');
    if (fastBuff && gameState.gameState === 'BATTLE_IN_PROGRESS') {
      setEscapeTimer(fastBuff.value);
    } else {
      setEscapeTimer(null);
    }
  }, [gameState.monster, gameState.gameState]);

  // Escape timer countdown
  useEffect(() => {
    if (escapeTimer === null || !gameState.canAttackMonster()) return;

    const interval = setInterval(() => {
      setEscapeTimer(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(interval);
          // Monster escaped!
          handleMonsterEscape();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [escapeTimer, gameState.gameState]);

  // Auto-save clicks periodically
  useEffect(() => {
    if (!gameState.canAttackMonster() || !gameState.session || gameState.session.isDefeated) return;

    const interval = setInterval(() => {
      if (clickCount > lastSavedClickCount) {
        saveClicksToBackend();
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [clickCount, lastSavedClickCount, gameState.gameState, gameState.session]);

  // Save clicks when reaching thresholds
  useEffect(() => {
    if (!gameState.canAttackMonster()) return;
    if (clickCount > 0 && clickCount % 5 === 0 && clickCount > lastSavedClickCount) {
      saveClicksToBackend();
    }
  }, [clickCount, lastSavedClickCount, gameState.gameState]);

  // Check for player death
  useEffect(() => {
    if (playerStats && playerStats.currentHealth <= 0 && gameState.canAttackMonster()) {
      handlePlayerDeath();
    }
  }, [playerStats?.currentHealth, gameState.gameState]);

  const handlePlayerDeath = async () => {
    if (!playerStats || !gameState.session) return;

    // Clear all active debuffs and interactive attacks
    clearDebuffs();
    clearInteractiveAttacks();

    // Calculate gold loss (10% of current gold, rounded)
    const goldLost = Math.floor(playerStats.coins * 0.10);
    const streakLost = selectedBiome && selectedTier ? getCurrentStreak(selectedBiome, selectedTier) : 0;

    // Deduct gold and reset streak
    await updatePlayerStats({
      coins: Math.max(0, playerStats.coins - goldLost),
      stats: {
        ...playerStats.stats,
        battlesWonStreak: 0
      }
    });

    // Reset streak for current zone
    if (selectedBiome && selectedTier) {
      await resetStreak(selectedBiome, selectedTier);
    }

    // Mark session as defeated (no loot)
    try {
      await fetch('/api/end-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: gameState.session._id
        }),
      });
    } catch (err) {
      console.error('Error ending battle session:', err);
    }

    // Store defeat data and transition to defeat screen
    setDefeatData({ goldLost, streakLost });
    gameState.setPlayerDefeated();
  };

  const handleDefeatContinue = async () => {
    setDefeatData({ goldLost: 0, streakLost: 0 });
    await resetHealth(equipmentStats.maxHpBonus);
    await startBattle();
  };

  const saveClicksToBackend = async () => {
    if (!gameState.session || clickCount <= lastSavedClickCount) return;

    try {
      await fetch('/api/update-clicks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: gameState.session._id,
          clickCount: clickCount,
        }),
      });

      setLastSavedClickCount(clickCount);
    } catch (err) {
      console.error('Error saving clicks:', err);
    }
  };

  const startBattle = async (useBiome?: BiomeId, useTier?: Tier, isConsecutiveBattle = false) => {
    try {
      gameState.setBattleLoading();

      const biome = useBiome || selectedBiome;
      const tier = useTier || selectedTier;

      const requestBody: Record<string, any> = {};
      if (biome && tier) {
        requestBody.biome = biome;
        requestBody.tier = tier;
      }

      const response = await fetch('/api/start-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
      });

      if (!response.ok) throw new Error('Failed to start battle');

      const data = await response.json();

      // Reset clicks for new sessions, restore for resumed sessions
      const initialClickCount = data.isNewSession ? 0 : data.session.clickCount;
      setClickCount(initialClickCount);
      setLastSavedClickCount(initialClickCount);
      
      // Calculate initial totalDamage based on clicks (for resumed sessions)
      // Estimate: (baseDamage + equipmentBonus) per click, with crit chance factor
      const baseDmg = (playerStats?.baseDamage || 1) + equipmentStats.damageBonus;
      const critMultiplier = 1 + (equipmentStats.critChance / 100); // Average damage increase from crits
      const estimatedDamagePerClick = Math.floor(baseDmg * critMultiplier);
      const initialTotalDamage = data.isNewSession ? 0 : initialClickCount * estimatedDamagePerClick;
      setTotalDamage(initialTotalDamage);

      // Sync biome/tier selection
      if (data.monster) {
        setBiomeTier(data.monster.biome, data.monster.tier);
      }

      // Handle different session states
      if (data.session.isDefeated && data.session.lootOptions && !data.session.selectedLootId) {
        // Restore pending loot selection
        const restoredLoot = getLootItemsByIds(data.session.lootOptions);
        gameState.setLootSelection(restoredLoot);
      } else if (data.session.isDefeated && data.session.selectedLootId) {
        // Session already complete, start fresh battle
        gameState.setBattleLoading();
        startBattle(biome || undefined, tier || undefined, false);
        return;
      } else if (!data.isNewSession) {
        // Resuming in-progress battle
        toast.success(`Resuming battle (${data.session.clickCount} attacks)`, { duration: 2000 });
        gameState.setBattleStartScreen(data.monster, data.session);
      } else if (isConsecutiveBattle) {
        // Consecutive battle - skip start screen
        gameState.setBattleInProgress(data.monster, data.session);
      } else {
        // New battle - show start screen
        gameState.setBattleStartScreen(data.monster, data.session);
      }

    } catch (err) {
      console.error('Error starting battle:', err);
      toast.error('Failed to start battle. Please refresh the page.');
      gameState.setInitializing();
    }
  };

  const submitBattleCompletion = async (finalClickCount: number, finalTotalDamage: number) => {
    // Validation checks
    if (!gameState.monster || !gameState.session || !gameState.session.startedAt) return;
    if (gameState.gameState === 'BATTLE_COMPLETING') return;

    gameState.setBattleCompleting();

    try {
      const response = await fetch('/api/attack-monster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: gameState.session._id,
          clickCount: finalClickCount,
          totalDamage: finalTotalDamage,
          usedItems: []
        }),
      });

      const data = await response.json();

      // Handle API errors
      if (!response.ok && data.error) {
        console.error('Battle completion error:', data.error);
        toast.error(`Failed to complete battle: ${data.error}`);
        gameState.setBattleInProgress();
        return;
      }

      // Handle cheat detection
      if (data.cheatingDetected) {
        setCheatModal({
          show: true,
          message: data.message || 'Suspicious click rate detected!'
        });
        setClickCount(0);
        setLastSavedClickCount(0);
        setTotalDamage(0);
        gameState.setBattleInProgress();
        return;
      }

      if (data.hpCheatDetected) {
        await handlePlayerDeath();
        return;
      }

      // Handle victory
      if (data.success && data.lootOptions) {
        // Increment streak for current zone
        if (selectedBiome && selectedTier) {
          await incrementStreak(selectedBiome, selectedTier);
        }

        // Convert loot IDs to full items if needed
        const lootItems = Array.isArray(data.lootOptions) && typeof data.lootOptions[0] === 'string'
          ? getLootItemsByIds(data.lootOptions)
          : data.lootOptions;

        // Update session and transition to loot selection
        if (gameState.session) {
          gameState.updateSession({ ...gameState.session, isDefeated: true, lootOptions: data.lootOptions });
        }
        gameState.setLootSelection(lootItems);

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
      } else if (!data.cheatingDetected && !data.hpCheatDetected) {
        // If we reach here without success, something went wrong
        console.error('Unexpected response from battle completion:', data);
        toast.error('Failed to complete battle. Please try again.');
        gameState.setBattleInProgress();
      }

    } catch (err) {
      console.error('Error submitting battle completion:', err);
      toast.error('Failed to complete battle. Please try again.');
      gameState.setBattleInProgress();
    }
  };

  const handleClick = () => {
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

    // Damage shield first if it exists (with 25% damage reduction)
    if (shieldHP > 0) {
      const reducedDamage = Math.ceil(damage * 0.75); // 25% damage reduction
      const newShieldHP = Math.max(0, shieldHP - reducedDamage);
      setShieldHP(newShieldHP);
      return; // Shield absorbs all damage, excess is ignored
    }

    // For bosses: use phase HP system via useBossPhases hook
    const isBoss = gameState.monster?.isBoss && gameState.monster.bossPhases && gameState.monster.bossPhases.length > 0;

    if (isBoss) {
      // Apply damage via useBossPhases hook (caps at phase boundary)
      console.log(`[handleClick] Boss detected, calling damagePhase(${damage})`);
      damagePhase(damage);

      // Track total damage and actual click count
      setTotalDamage(prev => prev + damage);
      setClickCount(prev => prev + 1);
    } else {
      // Non-boss: use regular click tracking
      const newTotalDamage = totalDamage + damage;
      const newClickCount = clickCount + 1;
      setTotalDamage(newTotalDamage);
      setClickCount(newClickCount);
      damagePhase(damage); // Also use hook for consistency

      // Check victory condition - pass current values to avoid stale state
      if (gameState.monster && newTotalDamage >= gameState.monster.clicksRequired) {
        submitBattleCompletion(newClickCount, newTotalDamage);
      }
    }
  };

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

    toast.error('The monster escaped!', { duration: 3000 });

    // Treat escape as battle loss (same as player death)
    const goldLost = Math.floor((playerStats?.coins || 0) * 0.10);
    const streakLost = selectedBiome && selectedTier ? getCurrentStreak(selectedBiome, selectedTier) : 0;

    setDefeatData({ goldLost, streakLost });

    // Deduct gold and reset streak
    if (goldLost > 0) {
      await updatePlayerStats({ coins: (playerStats?.coins || 0) - goldLost });
    }
    if (selectedBiome && selectedTier) {
      await resetStreak(selectedBiome, selectedTier);
    }

    // Mark session as defeated
    try {
      await fetch('/api/end-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: gameState.session._id }),
      });
    } catch (err) {
      console.error('Error ending battle after escape:', err);
    }

    gameState.setPlayerDefeated();
  };

  const closeCheatModal = () => {
    setCheatModal({ show: false, message: '' });
  };

  const handleLootSelection = useCallback(async (loot: LootItem) => {
    if (!gameState.session) return;

    try {
      const response = await fetch('/api/select-loot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: gameState.session._id,
          lootId: loot.lootId,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save loot selection');

      setTimeout(() => gameState.setBattleVictory(), 500);
    } catch (err) {
      console.error('Error saving loot selection:', err);
      toast.error('Failed to save loot selection. Please try again.');
    }
  }, [gameState.session, gameState]);

  const handleSkipLoot = useCallback(async () => {
    if (!gameState.session) return;

    try {
      const response = await fetch('/api/select-loot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: gameState.session._id,
          lootId: 'SKIPPED',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to skip loot selection');

      setTimeout(() => gameState.setBattleVictory(), 300);
    } catch (err) {
      console.error('Error skipping loot selection:', err);
      toast.error('Failed to skip loot selection. Please try again.');
    }
  }, [gameState.session, gameState]);

  const handleNextMonster = async (overrideBiome?: BiomeId, overrideTier?: Tier) => {
    clearDebuffs();
    clearInteractiveAttacks();
    setClickCount(0);
    setLastSavedClickCount(0);
    setTotalDamage(0);
    setShieldHP(0);
    setEscapeTimer(null);

    // Determine which zone we're starting the battle in
    // Use override if provided (from BiomeMapWidget zone change), otherwise use current selection
    const battleBiome = overrideBiome || selectedBiome;
    const battleTier = overrideTier || selectedTier;

    // Update BiomeContext if override was provided (zone was changed)
    if (overrideBiome && overrideTier) {
      setBiomeTier(overrideBiome, overrideTier);
    }

    // Streak-based healing after victory (progressively more challenging):
    // - Streak 0: 100% heal (first battle or after death)
    // - Streak 1-2: 80% heal
    // - Streak 3-5: 70% heal
    // - Streak 6-9: 60% heal
    // - Streak 10-24: 50% heal
    // - Streak 25-49: 40% heal
    // - Streak 50-99: 30% heal
    // - Streak 100+: 20% heal (legendary difficulty!)
    //
    // FUTURE FEATURE: Random Healer NPC
    // - Small chance (5-10%) to spawn between battles at high streaks (10+)
    // - Player can spend gold to buy healing (25 gold per 10% HP?)
    // - Creates strategic choice: spend gold for safety or risk it?
    const currentStreak = battleBiome && battleTier ? getCurrentStreak(battleBiome, battleTier) : 0;
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
    // Example: Streak 50 (40% base) + 24% equipment = 64% total heal
    const equipmentHealBonus = equipmentStats.healBonus / 100; // Convert percentage to decimal
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

    await fetchPlayerStats();
    await startBattle(overrideBiome, overrideTier, true);
  };

  const handleStartBattle = () => {
    if (!gameState.session) return;

    // Update battle timer on server (non-blocking)
    fetch('/api/start-battle-timer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: gameState.session._id })
    }).catch(error => console.error('Failed to start battle timer:', error));

    gameState.setBattleInProgress();
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
      <div className="flex flex-col items-center gap-6 max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-white mb-4">Monster Battle</h1>
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
      {/* Special Attack Visual Feedback (phase attacks take priority) */}
      <SpecialAttackFlash attack={phaseAttack || lastAttack} />

      <div className="flex flex-col items-center gap-6 max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-white mb-4">Monster Battle</h1>

      {/* Monster Info */}
      <div className="text-center mb-2">
        <h2 className="text-3xl font-bold text-white mb-1">{gameState.monster.name}</h2>
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

      {/* Escape Timer (Fast Buff) */}
      {escapeTimer !== null && escapeTimer > 0 && (
        <div className="w-full px-6 py-3 bg-yellow-500/20 rounded-lg border-2 border-yellow-400 animate-pulse">
          <div className="flex items-center justify-between">
            <span className="text-yellow-400 font-bold text-lg">⚡ Monster Escaping!</span>
            <span className="text-yellow-200 font-bold text-xl">{escapeTimer}s</span>
          </div>
          <div className="mt-2 text-yellow-200 text-sm text-center">
            Defeat it before it escapes!
          </div>
        </div>
      )}

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
            <CorruptionOverlay showLabel={true} size="large">
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

      {/* Click Counter */}
      <div className="px-8 py-3 bg-black/30 rounded-lg border border-white/20">
        <p className="text-white text-lg">
          Damage: <span className="font-bold text-yellow-400">{totalDamage}</span> / {gameState.monster.clicksRequired}
        </p>
      </div>

      {/* Victory: Calculating rewards */}
      {isDefeated && gameState.gameState === 'BATTLE_COMPLETING' && (
        <div className="mt-4 p-6 bg-green-500/20 rounded-lg border-2 border-green-400 animate-pulse">
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
        <div className="mt-3 sm:mt-4 p-4 sm:p-6 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-lg border border-green-400 sm:border-2">
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
          className="fixed right-4 top-1/2 -translate-y-1/2 md:right-8 flex flex-col items-center gap-1 sm:gap-2 px-4 py-4 sm:px-6 sm:py-8 bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl sm:rounded-2xl shadow-2xl transition-all duration-300 hover:scale-110 animate-pulse border-2 sm:border-4 border-green-400 cursor-pointer z-40"
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
