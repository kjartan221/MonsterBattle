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

  // Mobile menu toggles
  const [showBiomeMap, setShowBiomeMap] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);

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
      {/* Player Stats - Top Left (Always visible on desktop, top on mobile) */}
      <PlayerStatsDisplay activeDebuffs={activeDebuffs} />

      {/* Biome Map Widget - Hidden on mobile, show on tablet+, full-screen modal when toggled */}
      {playerStats && (
        <>
          {/* Backdrop overlay for mobile */}
          {showBiomeMap && (
            <div
              className="md:hidden fixed inset-0 bg-black/60 z-40"
              onClick={() => setShowBiomeMap(false)}
            />
          )}
          {/* Widget container */}
          <div className={`hidden md:block ${showBiomeMap ? '!block !fixed !inset-4 !z-50 md:!static md:!z-auto' : ''}`}>
            <BiomeMapWidget
              unlockedZones={playerStats.unlockedZones}
              onSelectBiomeTier={(biome, tier) => {
                setBiomeTier(biome, tier);
                setShowBiomeMap(false); // Auto-close on selection
              }}
              disabled={gameState.canAttackMonster()}
            />
          </div>
        </>
      )}

      {/* Equipment Widget - Hidden on mobile, show on tablet+, full-screen modal when toggled */}
      {playerStats && (
        <>
          {/* Backdrop overlay for mobile */}
          {showEquipment && (
            <div
              className="md:hidden fixed inset-0 bg-black/60 z-40"
              onClick={() => setShowEquipment(false)}
            />
          )}
          {/* Widget container */}
          <div className={`hidden md:block ${showEquipment ? '!block !fixed !inset-4 !z-50 md:!static md:!z-auto' : ''}`}>
            <EquipmentWidget
              onSlotClick={(slot) => {
                handleEquipmentSlotClick(slot);
                setShowEquipment(false); // Auto-close on selection
              }}
              disabled={false}
            />
          </div>
        </>
      )}

      {/* Mobile Toggle Buttons - Left Middle (only visible on mobile) */}
      <div className="md:hidden fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        <button
          onClick={() => setShowBiomeMap(!showBiomeMap)}
          className={`w-14 h-14 rounded-full shadow-xl transition-all cursor-pointer flex items-center justify-center text-2xl ${
            showBiomeMap
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-800 hover:bg-gray-700 border-2 border-gray-600'
          }`}
          title="Toggle World Map"
        >
          🗺️
        </button>
        <button
          onClick={() => setShowEquipment(!showEquipment)}
          className={`w-14 h-14 rounded-full shadow-xl transition-all cursor-pointer flex items-center justify-center text-2xl ${
            showEquipment
              ? 'bg-purple-600 hover:bg-purple-700'
              : 'bg-gray-800 hover:bg-gray-700 border-2 border-gray-600'
          }`}
          title="Toggle Equipment"
        >
          ⚔️
        </button>
      </div>

      {/* Navigation Buttons - Top Right (responsive sizing) */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={() => router.push('/inventory')}
          className="px-3 py-2 md:px-4 text-sm md:text-base bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg cursor-pointer"
        >
          📦 <span className="hidden sm:inline">Inventory</span>
        </button>
        <button
          onClick={handleLogout}
          className="px-3 py-2 md:px-4 text-sm md:text-base bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-lg cursor-pointer"
        >
          <span className="hidden sm:inline">Logout</span><span className="sm:hidden">🚪</span>
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
