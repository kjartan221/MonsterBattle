'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { MonsterFrontend, BattleSessionFrontend } from '@/lib/types';
import type { LootItem } from '@/lib/loot-table';
import { getLootItemsByIds } from '@/lib/loot-table';
import { BiomeId, Tier, getBiomeTierDisplayName } from '@/lib/biome-config';
import { usePlayer } from '@/contexts/PlayerContext';
import { useBiome } from '@/contexts/BiomeContext';
import { useMonsterAttack } from '@/hooks/useMonsterAttack';
import { EquipmentSlot } from '@/contexts/EquipmentContext';
import PlayerStatsDisplay from '@/components/battle/PlayerStatsDisplay';
import LootSelectionModal from '@/components/battle/LootSelectionModal';
import CheatDetectionModal from '@/components/battle/CheatDetectionModal';
import BattleStartScreen from '@/components/battle/BattleStartScreen';
import BattleDefeatScreen from '@/components/battle/BattleDefeatScreen';
import MonsterCard from '@/components/battle/MonsterCard';
import BiomeMapWidget from '@/components/battle/BiomeMapWidget';
import EquipmentWidget from '@/components/battle/EquipmentWidget';
import EquipmentSelectionModal from '@/components/battle/EquipmentSelectionModal';

export default function BattlePage() {
  const router = useRouter();
  const { playerStats, loading: statsLoading, resetHealth, incrementStreak, resetStreak, takeDamage, updatePlayerStats, fetchPlayerStats } = usePlayer();
  const { selectedBiome, selectedTier, setBiomeTier } = useBiome();
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
  const [battleStarted, setBattleStarted] = useState(false); // Track if user has clicked "Start Battle"
  const [defeatScreen, setDefeatScreen] = useState<{
    show: boolean;
    goldLost: number;
    streakLost: number;
  }>({ show: false, goldLost: 0, streakLost: 0 });
  const [equipmentModal, setEquipmentModal] = useState<{
    show: boolean;
    slot: EquipmentSlot | null;
  }>({ show: false, slot: null });

  useEffect(() => {
    // Start battle once player stats are loaded (only if we don't have a monster yet)
    if (!statsLoading && playerStats && !monster) {
      startBattle();
    }
  }, [statsLoading, playerStats, monster]);

  // Periodically save clicks to backend (every 5 clicks or every 10 seconds)
  useEffect(() => {
    if (!session || !monster || isSubmitting) return;

    const clickDifference = clicks - lastSavedClicks;

    // Save if we've accumulated 5 clicks since last save
    if (clickDifference >= 5) {
      saveClicksToBackend();
    }

    // Also save every 10 seconds if there are unsaved clicks
    const interval = setInterval(() => {
      if (clicks > lastSavedClicks && clicks < monster.clicksRequired) {
        saveClicksToBackend();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [clicks, lastSavedClicks, session, monster, isSubmitting]);

  // Monster attack loop: Use hook to handle attack interval and visual feedback
  const { isAttacking } = useMonsterAttack({
    monster,
    session,
    battleStarted,
    isSubmitting,
    playerStats,
    takeDamage
  });

  // Death mechanic: Watch for HP reaching 0
  useEffect(() => {
    if (!playerStats || !session || session.isDefeated) return;

    // If HP reaches 0 during battle, player has died
    if (playerStats.currentHealth <= 0) {
      handlePlayerDeath();
    }
  }, [playerStats?.currentHealth, session]);

  const handlePlayerDeath = async () => {
    console.log('Player has been defeated!');

    if (!playerStats || !session) return;

    // TODO: Replace with biome+tier specific gold loss percentage
    // This should be calculated based on the current biome and tier the player is in
    // Example: Forest Tier 1 = 5%, Desert Tier 2 = 15%, Volcano Tier 5 = 30%
    // For now, using flat 10% loss
    const goldLossPercentage = 0.10;
    const goldLost = Math.round(playerStats.coins * goldLossPercentage);
    const streakLost = playerStats.stats.battlesWonStreak;

    // Deduct gold if player has any
    if (goldLost > 0) {
      const newCoins = Math.max(0, playerStats.coins - goldLost);
      await updatePlayerStats({ coins: newCoins });
    }

    // Reset win streak
    await resetStreak();

    // End the battle session in the database (mark as defeated with no loot)
    try {
      await fetch('/api/end-battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session._id
        }),
      });
    } catch (err) {
      console.error('Error ending battle session:', err);
      // Continue even if this fails - player can still try again
    }

    // Reset battle started state so start screen shows after death
    setBattleStarted(false);

    // Show defeat screen
    setDefeatScreen({
      show: true,
      goldLost,
      streakLost
    });
  };

  const handleDefeatContinue = async () => {
    // Close defeat screen
    setDefeatScreen({ show: false, goldLost: 0, streakLost: 0 });

    // Restore HP to full
    await resetHealth();

    // Start a new battle (this will fetch a new monster)
    await startBattle();

    // battleStarted is already false (set in handlePlayerDeath), so start screen will show
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
      // Silently fail - not critical enough to show error to user
    }
  };

  const startBattle = async (useBiome?: BiomeId, useTier?: Tier) => {
    try {
      setLoading(true);

      // Use provided values or fall back to context
      const biome = useBiome || selectedBiome;
      const tier = useTier || selectedTier;

      // Prepare request body with optional biome/tier selection
      const requestBody: any = {};
      if (biome && tier) {
        requestBody.biome = biome;
        requestBody.tier = tier;
        console.log(`🎯 Starting battle in zone: ${biome}, tier: ${tier}`);
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
      setLastSavedClicks(data.session.clickCount); // Initialize saved clicks
      setStartTime(new Date(data.session.startedAt));

      // Sync selectedBiome/selectedTier with the monster we received
      // This ensures "Next Monster" continues in the same zone
      if (data.monster) {
        console.log(`✅ Battle started! Monster: ${data.monster.name}, Biome: ${data.monster.biome}, Tier: ${data.monster.tier}`);
        console.log(`🔄 Syncing context: selectedBiome=${selectedBiome} → ${data.monster.biome}, selectedTier=${selectedTier} → ${data.monster.tier}`);
        setBiomeTier(data.monster.biome, data.monster.tier);
      }

      // Check if session is defeated and has pending loot selection
      if (data.session.isDefeated && data.session.lootOptions && !data.session.selectedLootId) {
        // Restore loot selection modal
        const restoredLoot = getLootItemsByIds(data.session.lootOptions);
        setLootOptions(restoredLoot);
        toast.success('Battle completed! Choose your loot.');
      } else if (data.session.isDefeated && data.session.selectedLootId) {
        // Loot already selected, show next monster button
        setShowNextMonster(true);
        toast.success('Battle completed! Ready for next monster.');
      } else if (!data.isNewSession) {
        toast.success(`Resuming your battle! (${data.session.clickCount} attacks)`);
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
      // Note: We no longer send timeElapsed from client
      // Server will calculate it from session.startedAt
      const response = await fetch('/api/attack-monster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session._id,
          clickCount: finalClicks
        }),
      });

      const data = await response.json();

      // Check for HP cheat detection (player should have died)
      if (data.hpCheatDetected) {
        console.warn('HP cheat detected - player should have died');

        // Reset battle started state so start screen shows after defeat
        setBattleStarted(false);

        // Show defeat screen with penalties
        setDefeatScreen({
          show: true,
          goldLost: data.goldLost || 0,
          streakLost: data.streakLost || 0
        });

        // Refresh player stats to show updated gold/streak
        await fetchPlayerStats();

        toast.error('⚠️ Battle ended - HP verification failed');
        return;
      }

      // Check for click rate cheat detection
      if (data.cheatingDetected) {
        // Reset monster HP
        setClicks(0);

        // Update monster with new doubled clicks required
        setMonster({
          ...monster,
          clicksRequired: data.newClicksRequired
        });

        // Show cheat detection modal
        setCheatModal({
          show: true,
          message: `${data.message}\n\nYour click rate: ${data.clickRate} clicks/second\nMonster HP has been doubled to ${data.newClicksRequired}!`
        });

        // Reset start time for new attempt
        setStartTime(new Date());
      } else if (data.success) {
        // Battle completed successfully
        console.log('Battle completed!', data);

        // Update session with the one from API (already has isDefeated: true)
        setSession(data.session);

        // Show loot selection modal
        if (data.lootOptions && data.lootOptions.length > 0) {
          setLootOptions(data.lootOptions);
          toast.success('🎉 Monster defeated! Choose your loot!');
        }
      } else if (data.error) {
        toast.error(data.error);
      }

    } catch (err) {
      console.error('Error submitting battle:', err);
      toast.error('Failed to submit battle. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClick = () => {
    if (!monster || !session || isSubmitting) return;

    const newClicks = clicks + 1;
    setClicks(newClicks);

    // Check if monster is defeated
    if (newClicks >= monster.clicksRequired) {
      submitBattleCompletion(newClicks);
    }
  };

  const closeCheatModal = () => {
    setCheatModal({ show: false, message: '' });
  };

  const handleEquipmentSlotClick = (slot: EquipmentSlot) => {
    setEquipmentModal({ show: true, slot });
  };

  const closeEquipmentModal = () => {
    setEquipmentModal({ show: false, slot: null });
  };

  const handleLootSelection = async (loot: LootItem) => {
    if (!session) return;

    console.log('User selected loot:', loot);

    try {
      // Save loot selection to backend
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

      toast.success(`You claimed: ${loot.icon} ${loot.name}!`, {
        duration: 3000,
      });

      // Update local session state
      setSession({
        ...session,
        selectedLootId: loot.lootId
      });

      // Increment win streak after successful battle
      await incrementStreak();

      // Restore HP to full after battle win
      await resetHealth();

      // Close modal and show next monster button
      setTimeout(() => {
        setLootOptions(null);
        setShowNextMonster(true);
      }, 1500);

    } catch (err) {
      console.error('Error saving loot selection:', err);
      toast.error('Failed to save loot selection. Please try again.');
    }
  };

  const handleNextMonster = async (overrideBiome?: BiomeId, overrideTier?: Tier) => {
    console.log(`🔄 Next Monster clicked.`);
    console.log(`   Context state: selectedBiome=${selectedBiome}, selectedTier=${selectedTier}`);
    console.log(`   Override values: overrideBiome=${overrideBiome}, overrideTier=${overrideTier}`);

    setShowNextMonster(false);
    setClicks(0);
    setLastSavedClicks(0);
    setIsSubmitting(false);
    setLoading(true);
    // Keep battleStarted as true - player is already engaged in battle flow

    toast.loading('Summoning new monster...', { duration: 1000 });

    // Reset HP to full before starting new battle
    await resetHealth();

    // Refresh player stats to get updated unlocked zones
    await fetchPlayerStats();

    // Start a new battle, passing override values if provided
    // This avoids stale closure issues with React state
    await startBattle(overrideBiome, overrideTier);
  };

  const handleBiomeTierSelection = (biome: BiomeId, tier: Tier) => {
    if (session && !session.isDefeated) {
      toast.error('Complete your current battle first!');
      return;
    }

    console.log(`🗺️ User selected biome: ${biome}, tier: ${tier}`);
    console.log(`📊 Current context before change: selectedBiome=${selectedBiome}, selectedTier=${selectedTier}`);
    setBiomeTier(biome, tier);
    console.log(`📊 Context updated to: selectedBiome=${biome}, selectedTier=${tier}`);
    toast.success(`Selected: ${getBiomeTierDisplayName(biome, tier)}`);

    // If there's a completed battle (loot selected), start new battle immediately
    // Pass the biome/tier as parameters to avoid stale closure values
    if (session && session.isDefeated && session.selectedLootId) {
      console.log('⚡ Auto-starting next battle with new selection...');
      handleNextMonster(biome, tier);
    }
  };

  const handleStartBattle = async () => {
    if (!session) return;

    // Update the battle timer on the server
    try {
      await fetch('/api/start-battle-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session._id })
      });
    } catch (error) {
      console.error('Failed to start battle timer:', error);
      // Continue anyway - don't block the user
    }

    setBattleStarted(true);
    toast.success('Battle started! Fight!', { duration: 2000 });
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Logged out successfully!');
        router.push('/');
      } else {
        throw new Error('Logout failed');
      }
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('Failed to logout. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950">
        <div className="text-white text-2xl animate-pulse">Loading battle...</div>
      </div>
    );
  }

  if (!monster || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950">
        <div className="text-center">
          <div className="text-red-400 text-2xl mb-4">Failed to load battle</div>
          <button
            onClick={() => startBattle()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const progress = (clicks / monster.clicksRequired) * 100;
  const isDefeated = clicks >= monster.clicksRequired;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950 p-4 relative">
      {/* Player Stats - Top Left */}
      <PlayerStatsDisplay />

      {/* Biome Map Widget - Top Left (below player stats) */}
      {playerStats && (
        <BiomeMapWidget
          unlockedZones={playerStats.unlockedZones}
          onSelectBiomeTier={handleBiomeTierSelection}
          disabled={session?.isDefeated === false} // Disable during active battle
        />
      )}

      {/* Navigation Buttons */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={() => router.push('/inventory')}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-lg flex items-center gap-2 cursor-pointer"
        >
          <span>📦</span>
          Inventory
        </button>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-lg cursor-pointer"
        >
          Logout
        </button>
      </div>

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
        />

        {/* Progress Bar */}
        <div className="w-full max-w-md">
          <div className="flex justify-between text-white text-sm mb-2">
            <span>Health</span>
            <span className="font-bold">
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
      </div>

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
      />

      {/* Battle Start Screen - Shows before battle begins */}
      {!battleStarted && monster && (
        <BattleStartScreen
          monsterName={monster.name}
          monsterRarity={monster.rarity}
          monsterIcon={monster.imageUrl}
          onStartBattle={handleStartBattle}
        />
      )}

      {/* Battle Defeat Screen - Shows after death */}
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

      {/* Equipment Widget - Left side under BiomeMapWidget */}
      {!loading && playerStats && (
        <EquipmentWidget
          onSlotClick={handleEquipmentSlotClick}
          disabled={!battleStarted || isSubmitting}
        />
      )}

      {/* Equipment Selection Modal */}
      {equipmentModal.show && equipmentModal.slot && (
        <EquipmentSelectionModal
          isOpen={equipmentModal.show}
          onClose={closeEquipmentModal}
          slot={equipmentModal.slot}
        />
      )}
    </div>
  );
}
