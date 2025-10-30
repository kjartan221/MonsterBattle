'use client';

import { useRouter } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { EquipmentSlot } from '@/contexts/EquipmentContext';
import { useGameState } from '@/contexts/GameStateContext';
import { useBiome } from '@/contexts/BiomeContext';
import { useState } from 'react';
import { useDebuffs } from '@/hooks/useDebuffs';
import PlayerStatsDisplay from '@/components/battle/PlayerStatsDisplay';
import BiomeMapWidget from '@/components/battle/BiomeMapWidget';
import EquipmentWidget from '@/components/battle/EquipmentWidget';
import EquipmentSelectionModal from '@/components/battle/EquipmentSelectionModal';
import MonsterBattleSection from '@/components/battle/MonsterBattleSection';
import Hotbar from '@/components/battle/Hotbar';
import toast from 'react-hot-toast';

export default function BattlePage() {
  const router = useRouter();
  const { playerStats, loading: statsLoading, takeDamage } = usePlayer();
  const gameState = useGameState();
  const { setBiomeTier } = useBiome();
  const [equipmentModal, setEquipmentModal] = useState<{
    show: boolean;
    slot: EquipmentSlot | null;
  }>({ show: false, slot: null });

  // Debuff system (managed at page level, passed to child components)
  const { activeDebuffs, applyDebuff, clearDebuffs } = useDebuffs({
    maxHP: playerStats?.maxHealth || 100,
    takeDamage,
    isActive: gameState.canAttackMonster()
  });

  const handleEquipmentSlotClick = (slot: EquipmentSlot) => {
    setEquipmentModal({ show: true, slot });
  };

  const closeEquipmentModal = () => {
    setEquipmentModal({ show: false, slot: null });
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/');
      }
    } catch (err) {
      console.error('Error logging out:', err);
      toast.error('Failed to logout');
    }
  };

  // Show loading only on initial page load
  if (statsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950">
        <div className="text-white text-2xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950 p-4 relative">
      {/* Player Stats - Top Left */}
      <PlayerStatsDisplay activeDebuffs={activeDebuffs} />

      {/* Biome Map Widget - Top Left (below player stats) */}
      {playerStats && (
        <BiomeMapWidget
          unlockedZones={playerStats.unlockedZones}
          onSelectBiomeTier={setBiomeTier}
          disabled={gameState.canAttackMonster()}
        />
      )}

      {/* Equipment Widget - Left side under BiomeMapWidget */}
      {playerStats && (
        <EquipmentWidget
          onSlotClick={handleEquipmentSlotClick}
          disabled={false}
        />
      )}

      {/* Navigation Buttons - Top Right */}
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

      {/* Monster Battle Section - Center (only this re-renders when getting new monster) */}
      <MonsterBattleSection
        applyDebuff={applyDebuff}
        clearDebuffs={clearDebuffs}
      />

      {/* Hotbar - Bottom Center */}
      <Hotbar
        onSpellCast={() => {
          console.log('Spell cast!');
          toast.success('Spell cast!');
        }}
        onConsumableUse={(slot) => {
          console.log(`Consumable used from slot ${slot}`);
          toast.success(`Used consumable from slot ${slot + 1}`);
        }}
      />

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
