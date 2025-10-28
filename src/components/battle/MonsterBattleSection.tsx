'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { MonsterFrontend, BattleSessionFrontend } from '@/lib/types';
import type { LootItem } from '@/lib/loot-table';
import { getLootItemsByIds } from '@/lib/loot-table';
import { BiomeId, Tier, getBiomeTierDisplayName } from '@/lib/biome-config';
import { usePlayer } from '@/contexts/PlayerContext';
import { useBiome } from '@/contexts/BiomeContext';
import { useEquipment } from '@/contexts/EquipmentContext';
import { useMonsterAttack } from '@/hooks/useMonsterAttack';
import { calculateTotalEquipmentStats, calculateClickDamage } from '@/utils/equipmentCalculations';
import LootSelectionModal from '@/components/battle/LootSelectionModal';
import CheatDetectionModal from '@/components/battle/CheatDetectionModal';
import BattleStartScreen from '@/components/battle/BattleStartScreen';
import BattleDefeatScreen from '@/components/battle/BattleDefeatScreen';
import MonsterCard from '@/components/battle/MonsterCard';

interface MonsterBattleSectionProps {
  onBattleComplete?: () => void;
}

export default function MonsterBattleSection({ onBattleComplete }: MonsterBattleSectionProps) {
  const { playerStats, resetHealth, incrementStreak, resetStreak, takeDamage, updatePlayerStats, fetchPlayerStats } = usePlayer();
  const { selectedBiome, selectedTier, setBiomeTier } = useBiome();
  const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2 } = useEquipment();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<BattleSessionFrontend | null>(null);
  const [monster, setMonster] = useState<MonsterFrontend | null>(null);
  const [clicks, setClicks] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cheatModal, setCheatModal] = useState<{ show: boolean; message: string }>({
    show: false,
    message: ''
  });
  const [lootOptions, setLootOptions] = useState<LootItem[] | null>(null);
  const [lastSavedClicks, setLastSavedClicks] = useState(0);
  const [showNextMonster, setShowNextMonster] = useState(false);
  const [battleStarted, setBattleStarted] = useState(false);
  const [defeatScreen, setDefeatScreen] = useState<{
    show: boolean;
    goldLost: number;
    streakLost: number;
  }>({ show: false, goldLost: 0, streakLost: 0 });
  const [critTrigger, setCritTrigger] = useState(0);

  // Calculate total equipment stats
  const equipmentStats = calculateTotalEquipmentStats(
    equippedWeapon,
    equippedArmor,
    equippedAccessory1,
    equippedAccessory2
  );

  // Monster attack hook
  const { isAttacking } = useMonsterAttack({
    monster,
    session,
    battleStarted,
    isSubmitting,
    playerStats,
    takeDamage,
    equipmentStats
  });

  useEffect(() => {
    // Start battle once player stats are loaded
    if (playerStats && !monster) {
      startBattle();
    }
  }, [playerStats, monster]);

  // Auto-save clicks periodically
  useEffect(() => {
    if (!battleStarted || !session || session.isDefeated) return;

    const interval = setInterval(() => {
      if (clicks > lastSavedClicks) {
        saveClicksToBackend();
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [clicks, lastSavedClicks, battleStarted, session]);

  // Save clicks when reaching thresholds
  useEffect(() => {
    if (!battleStarted) return;
    if (clicks > 0 && clicks % 5 === 0 && clicks > lastSavedClicks) {
      saveClicksToBackend();
    }
  }, [clicks, lastSavedClicks, battleStarted]);

  // Check for player death
  useEffect(() => {
    if (playerStats && playerStats.currentHealth <= 0 && battleStarted && !defeatScreen.show) {
      handlePlayerDeath();
    }
  }, [playerStats?.currentHealth, battleStarted, defeatScreen.show]);

  const handlePlayerDeath = async () => {
    if (!playerStats || !session) return;

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
          sessionId: session._id
        }),
      });
    } catch (err) {
      console.error('Error ending battle session:', err);
    }

    setBattleStarted(false);
    setDefeatScreen({
      show: true,
      goldLost,
      streakLost
    });
  };

  const handleDefeatContinue = async () => {
    setDefeatScreen({ show: false, goldLost: 0, streakLost: 0 });
    await resetHealth();
    await startBattle();
  };

  const saveClicksToBackend = async () => {
    if (!session || clicks <= lastSavedClicks) return;

    try {
      await fetch('/api/update-clicks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session._id,
          clickCount: clicks,
        }),
      });

      setLastSavedClicks(clicks);
    } catch (err) {
      console.error('Error saving clicks:', err);
    }
  };

  const startBattle = async (useBiome?: BiomeId, useTier?: Tier) => {
    try {
      const biome = useBiome || selectedBiome;
      const tier = useTier || selectedTier;

      const requestBody: Record<string, any> = {};

      if (biome && tier) {
        console.log(`🎯 Starting battle with: biome=${biome}, tier=${tier}`);
        requestBody.biome = biome;
        requestBody.tier = tier;
      } else {
        console.log('🎯 Starting battle (no biome/tier specified, API will use default)');
      }

      const response = await fetch('/api/start-battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
      });

      if (!response.ok) {
        throw new Error('Failed to start battle');
      }

      const data = await response.json();
      setSession(data.session);
      setMonster(data.monster);
      setClicks(data.session.clickCount);
      setLastSavedClicks(data.session.clickCount);
      setStartTime(new Date(data.session.startedAt));

      // Sync selectedBiome/selectedTier
      if (data.monster) {
        console.log(`✅ Battle started! Monster: ${data.monster.name}, Biome: ${data.monster.biome}, Tier: ${data.monster.tier}`);
        setBiomeTier(data.monster.biome, data.monster.tier);
      }

      // Check if session is defeated and has pending loot selection
      if (data.session.isDefeated && data.session.lootOptions && !data.session.selectedLootId) {
        const restoredLoot = getLootItemsByIds(data.session.lootOptions);
        setLootOptions(restoredLoot);
      } else if (data.session.isDefeated && data.session.selectedLootId) {
        setShowNextMonster(true);
      } else if (!data.isNewSession) {
        // Resuming battle - show toast only for this case as it's informational
        toast.success(`Resuming battle (${data.session.clickCount} attacks)`, { duration: 2000 });
      }

    } catch (err) {
      console.error('Error starting battle:', err);
      toast.error('Failed to start battle. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const submitBattleCompletion = async (finalClicks: number) => {
    if (!monster || !session || !startTime || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/attack-monster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session._id,
          clickCount: finalClicks,
          usedItems: []
        }),
      });

      const data = await response.json();

      if (data.cheatingDetected) {
        setCheatModal({
          show: true,
          message: data.message || 'Suspicious click rate detected!'
        });

        if (data.newClicksRequired) {
          setMonster({ ...monster, clicksRequired: data.newClicksRequired });
        }
        setClicks(0);
        setLastSavedClicks(0);
        setIsSubmitting(false);
        return;
      }

      if (data.hpCheatDetected) {
        // Player should have died but defeated monster anyway
        await handlePlayerDeath();
        setIsSubmitting(false);
        return;
      }

      if (data.success && data.lootOptions) {
        await incrementStreak();
        setSession({ ...session, isDefeated: true, lootOptions: data.lootOptions });
        setLootOptions(data.lootOptions);

        // Show rewards (XP and coins)
        if (data.rewards) {
          console.log(`💰 Rewards: +${data.rewards.xp} XP, +${data.rewards.coins} coins`);
        }

        // Check for level up
        if (data.levelUp) {
          toast.success(
            `🎊 LEVEL UP! ${data.levelUp.previousLevel} → ${data.levelUp.newLevel}\n` +
            `+${data.levelUp.statIncreases.maxHealth} Max HP, ` +
            `+${data.levelUp.statIncreases.baseDamage} Base Damage`,
            { duration: 5000 }
          );
        }

        // Refresh player stats to show updated XP/level/coins
        await fetchPlayerStats();
      }

      setIsSubmitting(false);

    } catch (err) {
      console.error('Error submitting battle completion:', err);
      toast.error('Failed to complete battle. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleClick = () => {
    if (!battleStarted || isSubmitting || session?.isDefeated) return;

    // Calculate damage with equipment bonuses (base damage is 1 per click)
    const { damage, isCrit } = calculateClickDamage(
      1, // base damage per click
      equipmentStats.damageBonus,
      equipmentStats.critChance
    );

    // Show crit feedback
    if (isCrit) {
      console.log(`💥 CRITICAL HIT! Dealt ${damage} damage!`);
      setCritTrigger(prev => prev + 1); // Trigger crit badge animation
    }

    const newClicks = clicks + damage;
    setClicks(newClicks);

    if (newClicks >= monster!.clicksRequired) {
      submitBattleCompletion(newClicks);
    }
  };

  const closeCheatModal = () => {
    setCheatModal({ show: false, message: '' });
  };

  const handleLootSelection = async (loot: LootItem) => {
    if (!session) return;

    console.log('User selected loot:', loot);

    try {
      const response = await fetch('/api/select-loot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session._id,
          lootId: loot.lootId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save loot selection');
      }

      setTimeout(() => {
        setLootOptions(null);
        setShowNextMonster(true);
      }, 500);

    } catch (err) {
      console.error('Error saving loot selection:', err);
      toast.error('Failed to save loot selection. Please try again.');
    }
  };

  const handleSkipLoot = async () => {
    if (!session) return;

    console.log('User skipped loot selection');

    try {
      const response = await fetch('/api/select-loot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session._id,
          lootId: 'SKIPPED',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to skip loot selection');
      }

      console.log('✅ Loot selection skipped, session marked as complete');

      setTimeout(() => {
        setLootOptions(null);
        setShowNextMonster(true);
      }, 300);

    } catch (err) {
      console.error('Error skipping loot selection:', err);
      toast.error('Failed to skip loot selection. Please try again.');
    }
  };

  const handleNextMonster = async (overrideBiome?: BiomeId, overrideTier?: Tier) => {
    console.log(`🔄 Next Monster clicked.`);

    setShowNextMonster(false);
    setClicks(0);
    setLastSavedClicks(0);
    setIsSubmitting(false);
    setLoading(true);

    // Reset HP and refresh stats in background (non-blocking)
    resetHealth().catch(err => console.error('Failed to reset health:', err));
    fetchPlayerStats().catch(err => console.error('Failed to fetch player stats:', err));

    await startBattle(overrideBiome, overrideTier);
  };

  const handleStartBattle = () => {
    if (!session) return;

    // Update battle timer on server (non-blocking)
    fetch('/api/start-battle-timer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session._id })
    }).catch(error => console.error('Failed to start battle timer:', error));

    setBattleStarted(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 bg-black/30 backdrop-blur-sm rounded-lg border border-white/20 min-h-[400px]">
        <div className="text-white text-2xl animate-pulse">Loading battle...</div>
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!monster || !session) {
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

  const progress = (clicks / monster.clicksRequired) * 100;
  const isDefeated = clicks >= monster.clicksRequired;

  return (
    <div className="flex flex-col items-center gap-6 max-w-2xl w-full">
      <h1 className="text-4xl font-bold text-white mb-4">Monster Battle</h1>

      {/* Monster Info */}
      <div className="text-center mb-2">
        <h2 className="text-3xl font-bold text-white mb-1">{monster.name}</h2>
        <div className="flex items-center justify-center gap-2">
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            monster.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white' :
            monster.rarity === 'epic' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
            monster.rarity === 'rare' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
            'bg-gray-500 text-white'
          }`}>
            {monster.rarity.toUpperCase()}
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-700 text-gray-200">
            {getBiomeTierDisplayName(monster.biome, monster.tier)}
          </span>
        </div>
      </div>

      {/* Monster Click Area */}
      <MonsterCard
        monster={monster}
        isAttacking={isAttacking}
        isDefeated={isDefeated}
        onAttack={handleClick}
        critTrigger={critTrigger}
      />

      {/* Progress Bar */}
      <div className="w-full">
        <div className="flex justify-between mb-2">
          <span className="text-white font-semibold">HP</span>
          <span className="text-white font-semibold">
            {Math.max(0, monster.clicksRequired - clicks)} / {monster.clicksRequired}
          </span>
        </div>
        <div className="w-full bg-black/30 rounded-full h-6 overflow-hidden border border-white/20">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300 flex items-center justify-center"
            style={{ width: `${Math.min(100, progress)}%` }}
          >
            {progress > 10 && (
              <span className="text-white text-xs font-bold">
                {Math.round(progress)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Click Counter */}
      <div className="px-8 py-3 bg-black/30 rounded-lg border border-white/20">
        <p className="text-white text-lg">
          Attacks: <span className="font-bold text-yellow-400">{clicks}</span> / {monster.clicksRequired}
        </p>
      </div>

      {/* Defeated Message */}
      {isDefeated && !isSubmitting && (
        <div className="mt-4 p-6 bg-green-500/20 rounded-lg border-2 border-green-400 animate-pulse">
          <p className="text-green-400 text-xl font-bold text-center">
            🎉 Victory! Monster Defeated! 🎉
          </p>
          <p className="text-white text-center mt-2">
            Loot will be awarded soon...
          </p>
        </div>
      )}

      {/* Submitting Message */}
      {isSubmitting && (
        <div className="mt-4 p-4 bg-blue-500/20 rounded-lg border border-blue-400">
          <p className="text-blue-400 text-center">
            Validating your victory...
          </p>
        </div>
      )}

      {/* Next Monster Button - Fixed position on right side */}
      {showNextMonster && !lootOptions && (
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

      {/* Loot Selection Modal */}
      <LootSelectionModal
        lootOptions={lootOptions}
        onLootSelect={handleLootSelection}
        onSkip={handleSkipLoot}
      />

      {/* Battle Start Screen */}
      {!battleStarted && monster && (
        <BattleStartScreen
          monsterName={monster.name}
          monsterRarity={monster.rarity}
          monsterIcon={monster.imageUrl}
          onStartBattle={handleStartBattle}
        />
      )}

      {/* Battle Defeat Screen */}
      {defeatScreen.show && monster && (
        <BattleDefeatScreen
          monsterName={monster.name}
          monsterRarity={monster.rarity}
          monsterIcon={monster.imageUrl}
          goldLost={defeatScreen.goldLost}
          streakLost={defeatScreen.streakLost}
          onContinue={handleDefeatContinue}
        />
      )}
    </div>
  );
}
