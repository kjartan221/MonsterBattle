'use client';

import { useRouter } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { EquipmentSlot, useEquipment } from '@/contexts/EquipmentContext';
import { useGameState } from '@/contexts/GameStateContext';
import { useBiome } from '@/contexts/BiomeContext';
import { useState, useCallback, useRef } from 'react';
import { useDebuffs } from '@/hooks/useDebuffs';
import { usePlayerBuffs } from '@/hooks/usePlayerBuffs';
import { BuffSource } from '@/types/buffs';
import { usePlayerConsumable } from '@/hooks/usePlayerConsumable';
import { usePlayerSpell } from '@/hooks/usePlayerSpell';
import { calculateTotalEquipmentStats } from '@/utils/equipmentCalculations';
import PlayerStatsDisplay from '@/components/battle/PlayerStatsDisplay';
import BiomeMapWidget from '@/components/battle/BiomeMapWidget';
import EquipmentWidget from '@/components/battle/EquipmentWidget';
import EquipmentSelectionModal from '@/components/battle/EquipmentSelectionModal';
import MonsterBattleSection from '@/components/battle/MonsterBattleSection';
import Hotbar from '@/components/battle/Hotbar';
import HotbarSelectionModal from '@/components/battle/HotbarSelectionModal';
import QuickActionsBar from '@/components/battle/QuickActionsBar';
import MonsterManualModal from '@/components/battle/MonsterManualModal';
import LootItemDetailsModal from '@/components/battle/LootItemDetailsModal';
import ChallengeSettingsModal from '@/components/battle/ChallengeSettingsModal';
import { LootItem } from '@/lib/loot-table';
import toast from 'react-hot-toast';
import NavigationButtons from '@/components/navigation/NavigationButtons';

export default function BattlePage() {
  const router = useRouter();
  const { playerStats, loading: statsLoading, takeDamage, healHealth } = usePlayer();
  const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2 } = useEquipment();
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

  // Quick Actions modal states
  const [showMonsterManual, setShowMonsterManual] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [selectedLootItem, setSelectedLootItem] = useState<LootItem | null>(null);

  // Buff system (managed at page level, passed to child components)
  const { activeBuffs, applyBuff, clearBuffs, damageShield } = usePlayerBuffs();

  // Wrapper function to handle shield absorption before taking damage
  const takeDamageWithShield = useCallback(async (amount: number) => {
    // Apply shield absorption first
    const damageAfterShield = damageShield(amount);

    // Take remaining damage (if any)
    if (damageAfterShield > 0) {
      await takeDamage(damageAfterShield);
    }
  }, [damageShield, takeDamage]);

  // Debuff system (managed at page level, passed to child components)
  const { activeDebuffs, applyDebuff, clearDebuffs } = useDebuffs({
    maxHP: playerStats?.maxHealth || 100,
    takeDamage: takeDamageWithShield,
    isActive: gameState.canAttackMonster(),
    activeBuffs // Pass player buffs for DoT resistance calculation
  });

  // Consumable system (managed at page level)
  const { consumableSlots, useConsumable, equipConsumable, unequipConsumable } = usePlayerConsumable();

  // Phase 2.6: Spell system (managed at page level)
  const { spellSlot, castSpell, equipSpell, unequipSpell } = usePlayerSpell();

  // Ref to MonsterBattleSection's spell damage handler
  const spellDamageHandlerRef = useRef<((spellData: any) => void) | null>(null);

  // Ref to MonsterBattleSection's healing tracker
  const healingReportHandlerRef = useRef<((amount: number) => void) | null>(null);

  // Ref to MonsterBattleSection's buff tracker
  const buffReportHandlerRef = useRef<((buffType: string, buffValue: number) => void) | null>(null);

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

  // Quick Actions handlers
  const handleOpenMonsterManual = () => {
    setShowMonsterManual(true);
  };

  const handleCloseMonsterManual = () => {
    setShowMonsterManual(false);
  };

  const handleOpenChallengeModal = () => {
    setShowChallengeModal(true);
  };

  const handleCloseChallengeModal = () => {
    setShowChallengeModal(false);
  };

  const handleLootItemClick = (item: LootItem) => {
    setSelectedLootItem(item);
  };

  const handleCloseLootItemDetails = () => {
    setSelectedLootItem(null);
  };

  const handleConsumableUse = useCallback(async (slotIndex: number) => {
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
      // Calculate equipment stats to get max HP bonus
      const equipmentStats = calculateTotalEquipmentStats(
        equippedWeapon,
        equippedArmor,
        equippedAccessory1,
        equippedAccessory2
      );
      healHealth(consumableItem.healing, equipmentStats.maxHpBonus);
      // Report healing for cheat detection
      if (healingReportHandlerRef.current) {
        healingReportHandlerRef.current(consumableItem.healing);
      }
      toast.success(`Restored ${consumableItem.healing} HP!`, { icon: '💚', duration: 2000 });
    }

    // Debuff removal
    if (itemName.includes('antidote') || itemName.includes('mana') || description.includes('remove')) {
      clearDebuffs();
      toast.success('Debuffs removed!', { icon: '✨', duration: 2000 });
    }

    // Apply buff if consumable has buff data
    if (consumableItem.buffData) {
      const { buffType, buffValue, duration } = consumableItem.buffData;
      applyBuff({
        buffType: buffType as any,
        value: buffValue,
        duration,
        source: BuffSource.CONSUMABLE,
        sourceId: consumableItem.lootId,
        name: consumableItem.name,
        icon: consumableItem.icon
      });
      // Report buff for cheat detection
      if (buffReportHandlerRef.current) {
        buffReportHandlerRef.current(buffType, buffValue);
      }

      // Show appropriate toast message based on buff type
      if (buffType.includes('resistance')) {
        const resistanceType = buffType.replace('_resistance', '');
        toast.success(`+${buffValue}% ${resistanceType} resistance for ${duration}s!`, { icon: '🛡️', duration: 3000 });
      } else if (buffType === 'shield') {
        toast.success(`+${buffValue} HP shield for ${duration}s!`, { icon: '🛡️', duration: 3000 });
      } else {
        toast.success(`${consumableItem.name} activated!`, { icon: '✨', duration: 2000 });
      }
    }
  }, [consumableSlots, useConsumable, healHealth, clearDebuffs, applyBuff, equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2]);

  // Phase 2.6: Handle spell casting (wrapped in useCallback to prevent re-casting on re-renders)
  const handleSpellCast = useCallback(async () => {
    if (!spellSlot.spellId || !playerStats) return;

    // Cast spell via API
    const result: {
      success: boolean;
      damage?: number;
      healing?: number;
      spellName?: string;
      effect?: string;
      // Buff data (for player buffs)
      buffType?: string;
      buffValue?: number;
      duration?: number;
      // Debuff data (for monster debuffs)
      debuffType?: string;
      debuffValue?: number;
      debuffDamageType?: 'flat' | 'percentage';
    } = await castSpell();
    if (!result.success) return;

    // Apply healing locally, passing equipment max HP bonus
    if (result.healing && result.healing > 0) {
      // Calculate equipment stats to get max HP bonus
      const equipmentStats = calculateTotalEquipmentStats(
        equippedWeapon,
        equippedArmor,
        equippedAccessory1,
        equippedAccessory2
      );
      healHealth(result.healing, equipmentStats.maxHpBonus);
      // Report healing for cheat detection
      if (healingReportHandlerRef.current) {
        healingReportHandlerRef.current(result.healing);
      }
    }

    // Apply player buff if spell provides one
    if (result.buffType && result.buffValue && result.duration) {
      applyBuff({
        buffType: result.buffType as any,
        value: result.buffValue,
        duration: result.duration,
        source: BuffSource.SPELL,
        sourceId: spellSlot.spellId || undefined,
        name: result.spellName,
        icon: '✨'
      });
      // Report buff for cheat detection
      if (buffReportHandlerRef.current) {
        buffReportHandlerRef.current(result.buffType, result.buffValue);
      }
    }

    // Pass spell data to MonsterBattleSection for damage application and visual effects
    if (spellDamageHandlerRef.current) {
      // Debug logging for spell data before passing to MonsterBattleSection
      if (result.debuffType && result.debuffValue) {
        console.log('[BattlePage] Passing spell debuff to MonsterBattleSection:', {
          spellName: result.spellName,
          debuffType: result.debuffType,
          debuffValue: result.debuffValue,
          debuffDamageType: result.debuffDamageType,
          duration: result.duration
        });
      }

      spellDamageHandlerRef.current({
        spellName: result.spellName || 'Spell',
        damage: result.damage,
        healing: result.healing,
        effect: result.effect,
        // Pass debuff data for monster application
        debuffType: result.debuffType,
        debuffValue: result.debuffValue,
        debuffDamageType: result.debuffDamageType,
        duration: result.duration
      });
    }
  }, [spellSlot.spellId, castSpell, healHealth, applyBuff, playerStats, equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2]);

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
      <PlayerStatsDisplay activeDebuffs={activeDebuffs} activeBuffs={activeBuffs} />

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

      {/* Quick Actions Bar - Below BiomeMapWidget */}
      <QuickActionsBar
        onMonsterManualClick={handleOpenMonsterManual}
        onChallengeClick={handleOpenChallengeModal}
        disabled={false}
      />

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
        <NavigationButtons
          showMarketplace
          showInventory
          showLogout
        />
      </div>

      {/* Monster Battle Section - Center */}
      <MonsterBattleSection
        applyDebuff={applyDebuff}
        clearDebuffs={clearDebuffs}
        spellDamageHandler={spellDamageHandlerRef}
        activeBuffs={activeBuffs}
        damageShield={damageShield}
        healingReportHandler={healingReportHandlerRef}
        buffReportHandler={buffReportHandlerRef}
      />

      {/* Hotbar - Bottom Center (isolated from MonsterBattleSection re-renders) */}
      <Hotbar
        spellSlot={spellSlot}
        consumableSlots={consumableSlots}
        onSpellCast={handleSpellCast}
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
        spellSlot={spellSlot}
        consumableSlots={consumableSlots}
        equipSpell={equipSpell}
        unequipSpell={unequipSpell}
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

      {/* Monster Manual Modal */}
      {showMonsterManual && (
        <MonsterManualModal
          onClose={handleCloseMonsterManual}
          onItemClick={handleLootItemClick}
        />
      )}

      {/* Challenge Settings Modal */}
      {showChallengeModal && (
        <ChallengeSettingsModal
          isOpen={showChallengeModal}
          onClose={handleCloseChallengeModal}
        />
      )}

      {/* Loot Item Details Modal */}
      {selectedLootItem && (
        <LootItemDetailsModal
          item={selectedLootItem}
          onClose={handleCloseLootItemDetails}
        />
      )}
    </div>
  );
}
