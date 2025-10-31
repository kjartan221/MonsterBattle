'use client';

import { useRouter } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { EquipmentSlot } from '@/contexts/EquipmentContext';
import { useGameState } from '@/contexts/GameStateContext';
import { useBiome } from '@/contexts/BiomeContext';
import { useState } from 'react';
import { useDebuffs } from '@/hooks/useDebuffs';
import { usePlayerConsumable } from '@/hooks/usePlayerConsumable';
import PlayerStatsDisplay from '@/components/battle/PlayerStatsDisplay';
import BiomeMapWidget from '@/components/battle/BiomeMapWidget';
import EquipmentWidget from '@/components/battle/EquipmentWidget';
import EquipmentSelectionModal from '@/components/battle/EquipmentSelectionModal';
import MonsterBattleSection from '@/components/battle/MonsterBattleSection';
import Hotbar from '@/components/battle/Hotbar';
import HotbarSelectionModal from '@/components/battle/HotbarSelectionModal';
import toast from 'react-hot-toast';

export default function BattlePage() {
  const router = useRouter();
  const { playerStats, loading: statsLoading, takeDamage, healHealth } = usePlayer();
  const gameState = useGameState();
  const { setBiomeTier } = useBiome();
  const [equipmentModal, setEquipmentModal] = useState<{
    show: boolean;
    slot: EquipmentSlot | null;
  }>({ show: false, slot: null });

  // Hotbar modal state
  const [hotbarModal, setHotbarModal] = useState<{
    isOpen: boolean;
    slotType: 'spell' | 'consumable';
    slotIndex: number;
  }>({
    isOpen: false,
    slotType: 'consumable',
    slotIndex: 0,
  });

  // Debuff system (managed at page level, passed to child components)
  const { activeDebuffs, applyDebuff, clearDebuffs } = useDebuffs({
    maxHP: playerStats?.maxHealth || 100,
    takeDamage,
    isActive: gameState.canAttackMonster()
  });

  // Consumable system (managed at page level)
  const { consumableSlots, useConsumable, equipConsumable, unequipConsumable } = usePlayerConsumable();

  const handleEquipmentSlotClick = (slot: EquipmentSlot) => {
    setEquipmentModal({ show: true, slot });
  };

  const closeEquipmentModal = () => {
    setEquipmentModal({ show: false, slot: null });
  };

  // Hotbar handlers
  const handleHotbarSlotClick = (slotType: 'spell' | 'consumable', slotIndex: number) => {
    setHotbarModal({ isOpen: true, slotType, slotIndex });
  };

  const handleCloseHotbarModal = () => {
    setHotbarModal({ isOpen: false, slotType: 'consumable', slotIndex: 0 });
  };

  const handleConsumableUse = async (slotIndex: number) => {
    // Get consumable details before using (since it will decrement)
    const slot = consumableSlots[slotIndex];
    if (!slot.itemId) return;

    const { getLootItemById } = await import('@/lib/loot-table');
    const consumableItem = getLootItemById(slot.itemId);
    if (!consumableItem) return;

    // Use the consumable (API call + decrement quantity)
    const success = await useConsumable(slotIndex);
    if (!success) return;

    // Apply consumable effects based on item
    const itemName = consumableItem.name.toLowerCase();
    const description = consumableItem.description.toLowerCase();

    // Health restoration (use explicit healing field)
    if (consumableItem.healing && consumableItem.healing > 0) {
      healHealth(consumableItem.healing);
      toast.success(`Restored ${consumableItem.healing} HP!`, { icon: '💚', duration: 2000 });
    }

    // Debuff removal
    if (itemName.includes('antidote') || itemName.includes('mana') || description.includes('remove')) {
      clearDebuffs();
      toast.success('Debuffs removed!', { icon: '✨', duration: 2000 });
    }

    // Fire resistance (burn immunity) - would need additional state tracking
    if (itemName.includes('fire resistance')) {
      toast.success('Immune to burn for 30s!', { icon: '🔥', duration: 3000 });
      // TODO: Implement burn immunity state
    }
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
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg cursor-pointer"
        >
          📦 Inventory
        </button>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-lg cursor-pointer"
        >
          Logout
        </button>
      </div>

      {/* Monster Battle Section - Center */}
      <MonsterBattleSection
        applyDebuff={applyDebuff}
        clearDebuffs={clearDebuffs}
      />

      {/* Hotbar - Bottom Center (isolated from MonsterBattleSection re-renders) */}
      <Hotbar
        consumableSlots={consumableSlots}
        onConsumableUse={handleConsumableUse}
        onSlotClick={handleHotbarSlotClick}
        canInteract={!gameState.canAttackMonster()} // Can click to equip during rest phase
      />

      {/* Hotbar Selection Modal */}
      <HotbarSelectionModal
        isOpen={hotbarModal.isOpen}
        onClose={handleCloseHotbarModal}
        slotType={hotbarModal.slotType}
        slotIndex={hotbarModal.slotIndex}
        consumableSlots={consumableSlots}
        equipConsumable={equipConsumable}
        unequipConsumable={unequipConsumable}
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
