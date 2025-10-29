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
import type { DebuffEffect } from '@/lib/types';
import { calculateTotalEquipmentStats, calculateClickDamage } from '@/utils/equipmentCalculations';
import LootSelectionModal from '@/components/battle/LootSelectionModal';
import CheatDetectionModal from '@/components/battle/CheatDetectionModal';
import BattleStartScreen from '@/components/battle/BattleStartScreen';
import BattleDefeatScreen from '@/components/battle/BattleDefeatScreen';
import MonsterCard from '@/components/battle/MonsterCard';

interface MonsterBattleSectionProps {
  onBattleComplete?: () => void;
  applyDebuff: (effect: DebuffEffect, appliedBy?: string) => boolean;
  clearDebuffs: () => void;
}

export default function MonsterBattleSection({ onBattleComplete, applyDebuff, clearDebuffs }: MonsterBattleSectionProps) {
  const { playerStats, resetHealth, incrementStreak, resetStreak, takeDamage, updatePlayerStats, fetchPlayerStats } = usePlayer();
  const { selectedBiome, selectedTier, setBiomeTier } = useBiome();
  const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2 } = useEquipment();
  const gameState = useGameState();

  // Local battle progress state
  const [clicks, setClicks] = useState(0);
  const [lastSavedClicks, setLastSavedClicks] = useState(0);
  const [critTrigger, setCritTrigger] = useState(0);
  const [defeatData, setDefeatData] = useState<{ goldLost: number; streakLost: number }>({
    goldLost: 0,
    streakLost: 0
  });
  const [cheatModal, setCheatModal] = useState<{ show: boolean; message: string }>({
    show: false,
    message: ''
  });

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

  // Monster attack system with debuff application
  const { isAttacking } = useMonsterAttack({
    monster: gameState.monster,
    session: gameState.session,
    battleStarted: gameState.canAttackMonster(),
    isSubmitting: gameState.gameState === 'BATTLE_COMPLETING',
    playerStats,
    takeDamage,
    equipmentStats,
    applyDebuff
  });

  // Auto-start initial battle when player stats load
  useEffect(() => {
    if (playerStats && !gameState.monster && gameState.canStartBattle()) {
      startBattle();
    }
  }, [playerStats, gameState.monster]);

  // Auto-save clicks periodically
  useEffect(() => {
    if (!gameState.canAttackMonster() || !gameState.session || gameState.session.isDefeated) return;

    const interval = setInterval(() => {
      if (clicks > lastSavedClicks) {
        saveClicksToBackend();
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [clicks, lastSavedClicks, gameState.gameState, gameState.session]);

  // Save clicks when reaching thresholds
  useEffect(() => {
    if (!gameState.canAttackMonster()) return;
    if (clicks > 0 && clicks % 5 === 0 && clicks > lastSavedClicks) {
      saveClicksToBackend();
    }
  }, [clicks, lastSavedClicks, gameState.gameState]);

  // Check for player death
  useEffect(() => {
    if (playerStats && playerStats.currentHealth <= 0 && gameState.canAttackMonster()) {
      handlePlayerDeath();
    }
  }, [playerStats?.currentHealth, gameState.gameState]);

  const handlePlayerDeath = async () => {
    if (!playerStats || !gameState.session) return;

    // Clear all active debuffs
    clearDebuffs();

    // Calculate gold loss (10% of current gold, rounded)
    const goldLost = Math.floor(playerStats.coins * 0.10);
    const streakLost = playerStats.stats.battlesWonStreak;

    // Deduct gold and reset streak
    await updatePlayerStats({
      coins: Math.max(0, playerStats.coins - goldLost),
      stats: {
        ...playerStats.stats,
        battlesWonStreak: 0
      }
    });

    // Reset streak
    await resetStreak();

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
    await resetHealth();
    await startBattle();
  };

  const saveClicksToBackend = async () => {
    if (!gameState.session || clicks <= lastSavedClicks) return;

    try {
      await fetch('/api/update-clicks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: gameState.session._id,
          clickCount: clicks,
        }),
      });

      setLastSavedClicks(clicks);
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
      const initialClicks = data.isNewSession ? 0 : data.session.clickCount;
      setClicks(initialClicks);
      setLastSavedClicks(initialClicks);

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

  const submitBattleCompletion = async (finalClicks: number) => {
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
          clickCount: finalClicks,
          usedItems: []
        }),
      });

      const data = await response.json();

      // Handle cheat detection
      if (data.cheatingDetected) {
        setCheatModal({
          show: true,
          message: data.message || 'Suspicious click rate detected!'
        });
        setClicks(0);
        setLastSavedClicks(0);
        gameState.setBattleInProgress();
        return;
      }

      if (data.hpCheatDetected) {
        await handlePlayerDeath();
        return;
      }

      // Handle victory
      if (data.success && data.lootOptions) {
        await incrementStreak();

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
            `+${data.levelUp.statIncreases.baseDamage} Base Damage`,
            { duration: 5000 }
          );
        }
      }

    } catch (err) {
      console.error('Error submitting battle completion:', err);
      toast.error('Failed to complete battle. Please try again.');
      gameState.setBattleInProgress();
    }
  };

  const handleClick = () => {
    if (!gameState.canAttackMonster() || gameState.session?.isDefeated) return;

    const { damage, isCrit } = calculateClickDamage(
      1,
      equipmentStats.damageBonus,
      equipmentStats.critChance
    );

    if (isCrit) {
      setCritTrigger(prev => prev + 1);
    }

    const newClicks = clicks + damage;
    setClicks(newClicks);

    if (gameState.monster && newClicks >= gameState.monster.clicksRequired) {
      submitBattleCompletion(newClicks);
    }
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
    setClicks(0);
    setLastSavedClicks(0);

    await resetHealth();
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

  const remainingHP = gameState.monster ? Math.max(0, gameState.monster.clicksRequired - clicks) : 0;
  const remainingHPPercent = gameState.monster ? (remainingHP / gameState.monster.clicksRequired) * 100 : 0;
  const isDefeated = gameState.monster ? clicks >= gameState.monster.clicksRequired : false;

  return (
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

      {/* Monster Click Area */}
      <MonsterCard
        monster={gameState.monster}
        isAttacking={isAttacking}
        isDefeated={isDefeated}
        onAttack={handleClick}
        critTrigger={critTrigger}
      />

      {/* HP Bar */}
      <div className="w-full">
        <div className="flex justify-between mb-2">
          <span className="text-white font-semibold">HP</span>
          <span className="text-white font-semibold">
            {remainingHP} / {gameState.monster.clicksRequired}
          </span>
        </div>
        <div className="w-full bg-black/30 rounded-full h-6 overflow-hidden border border-white/20">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300 flex items-center justify-center"
            style={{ width: `${Math.min(100, remainingHPPercent)}%` }}
          >
            {remainingHPPercent > 10 && (
              <span className="text-white text-xs font-bold">
                {Math.round(remainingHPPercent)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Click Counter */}
      <div className="px-8 py-3 bg-black/30 rounded-lg border border-white/20">
        <p className="text-white text-lg">
          Attacks: <span className="font-bold text-yellow-400">{clicks}</span> / {gameState.monster.clicksRequired}
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
        <div className="mt-4 p-6 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-lg border-2 border-green-400">
          <p className="text-green-400 text-xl font-bold text-center mb-2">
            🎉 Victory Complete! 🎉
          </p>
          <p className="text-white text-center mb-3">
            Loot claimed! Take your time to prepare for the next battle.
          </p>
          <div className="text-center text-sm text-gray-300 space-y-1">
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

      {/* Next Monster Button - Fixed position on right side */}
      {gameState.canShowNextMonsterButton() && (
        <button
          onClick={() => handleNextMonster()}
          className="fixed right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 px-6 py-8 bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-2xl shadow-2xl transition-all duration-300 hover:scale-110 animate-pulse border-4 border-green-400 cursor-pointer"
        >
          <span className="text-lg">Next</span>
          <span className="text-lg">Monster</span>
          <span className="text-4xl">→</span>
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
  );
}
