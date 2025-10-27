'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { MonsterFrontend, BattleSessionFrontend } from '@/lib/types';
import type { LootItem } from '@/lib/loot-table';
import { getLootItemsByIds } from '@/lib/loot-table';
import { usePlayer } from '@/contexts/PlayerContext';
import PlayerStatsDisplay from '@/components/battle/PlayerStatsDisplay';
import LootSelectionModal from '@/components/battle/LootSelectionModal';
import CheatDetectionModal from '@/components/battle/CheatDetectionModal';

export default function BattlePage() {
  const router = useRouter();
  const { playerStats, loading: statsLoading, resetHealth, incrementStreak, resetStreak } = usePlayer();
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

  useEffect(() => {
    // Start battle once player stats are loaded
    if (!statsLoading && playerStats) {
      startBattle();
    }
  }, [statsLoading, playerStats]);

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

    // Reset win streak
    await resetStreak();

    toast.error('You have been defeated! Your win streak has been reset.', {
      duration: 4000,
    });

    // Wait a moment before redirecting
    setTimeout(() => {
      router.push('/battle'); // This will restart the battle with full HP
    }, 2000);
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

  const startBattle = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/start-battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      // Check for cheat detection
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

  const handleNextMonster = async () => {
    setShowNextMonster(false);
    setClicks(0);
    setLastSavedClicks(0);
    setIsSubmitting(false);
    setLoading(true);

    toast.loading('Summoning new monster...', { duration: 1000 });

    // Reset HP to full before starting new battle
    await resetHealth();

    // Start a new battle
    await startBattle();
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
            onClick={startBattle}
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

  // Rarity colors
  const rarityColors = {
    common: 'from-gray-500 to-gray-600',
    rare: 'from-blue-500 to-blue-600',
    epic: 'from-purple-500 to-purple-600',
    legendary: 'from-yellow-500 to-orange-600'
  };

  const rarityBorderColors = {
    common: 'border-gray-400',
    rare: 'border-blue-400',
    epic: 'border-purple-400',
    legendary: 'border-yellow-400'
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950 p-4 relative">
      {/* Player Stats - Top Left */}
      <PlayerStatsDisplay />

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
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            monster.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white' :
            monster.rarity === 'epic' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
            monster.rarity === 'rare' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
            'bg-gray-500 text-white'
          }`}>
            {monster.rarity.toUpperCase()}
          </span>
        </div>

        {/* Monster Click Area */}
        <button
          onClick={handleClick}
          disabled={isDefeated}
          className={`w-72 h-72 bg-gradient-to-br ${rarityColors[monster.rarity]} rounded-2xl shadow-2xl transition-transform duration-150 flex items-center justify-center cursor-pointer border-4 ${rarityBorderColors[monster.rarity]} ${
            isDefeated
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:scale-105 active:scale-95 hover:border-white/60'
          }`}
        >
          <div className="text-center">
            <div className="text-9xl mb-4">{monster.imageUrl}</div>
            {!isDefeated && (
              <p className="text-white text-xl font-bold">Click to Attack!</p>
            )}
            {isDefeated && (
              <p className="text-white text-xl font-bold">DEFEATED!</p>
            )}
          </div>
        </button>

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
          onClick={handleNextMonster}
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
    </div>
  );
}
