'use client';

import { useEquipment, EquipmentSlot } from '@/contexts/EquipmentContext';
import { useState } from 'react';
import { tierToRoman, getTierBadgeClassName } from '@/utils/tierUtils';
import StatRangeIndicator from '@/components/crafting/StatRangeIndicator';

interface EquipmentWidgetProps {
  onSlotClick: (slot: EquipmentSlot) => void;
  disabled?: boolean;
}

export default function EquipmentWidget({ onSlotClick, disabled = false }: EquipmentWidgetProps) {
  const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2, isLoading } = useEquipment();

  const getSlotDisplay = (slot: EquipmentSlot) => {
    switch (slot) {
      case 'weapon':
        return {
          label: 'Weapon',
          icon: equippedWeapon?.lootItem.icon || '⚔️',
          name: equippedWeapon?.lootItem.name || 'Empty',
          isEmpty: !equippedWeapon,
          rarity: equippedWeapon?.lootItem.rarity,
          tier: equippedWeapon?.tier,
          crafted: equippedWeapon?.crafted,
          statRoll: equippedWeapon?.statRoll
        };
      case 'armor':
        return {
          label: 'Armor',
          icon: equippedArmor?.lootItem.icon || '🛡️',
          name: equippedArmor?.lootItem.name || 'Empty',
          isEmpty: !equippedArmor,
          rarity: equippedArmor?.lootItem.rarity,
          tier: equippedArmor?.tier,
          crafted: equippedArmor?.crafted,
          statRoll: equippedArmor?.statRoll
        };
      case 'accessory1':
        return {
          label: 'Accessory 1',
          icon: equippedAccessory1?.lootItem.icon || '💍',
          name: equippedAccessory1?.lootItem.name || 'Empty',
          isEmpty: !equippedAccessory1,
          rarity: equippedAccessory1?.lootItem.rarity,
          tier: equippedAccessory1?.tier,
          crafted: equippedAccessory1?.crafted,
          statRoll: equippedAccessory1?.statRoll
        };
      case 'accessory2':
        return {
          label: 'Accessory 2',
          icon: equippedAccessory2?.lootItem.icon || '📿',
          name: equippedAccessory2?.lootItem.name || 'Empty',
          isEmpty: !equippedAccessory2,
          rarity: equippedAccessory2?.lootItem.rarity,
          tier: equippedAccessory2?.tier,
          crafted: equippedAccessory2?.crafted,
          statRoll: equippedAccessory2?.statRoll
        };
    }
  };

  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'common':
        return 'border-gray-500';
      case 'rare':
        return 'border-blue-500';
      case 'epic':
        return 'border-purple-500';
      case 'legendary':
        return 'border-yellow-500';
      default:
        return 'border-gray-700';
    }
  };

  const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory1', 'accessory2'];

  if (isLoading) {
    return (
      <div className="fixed top-[492px] sm:top-[512px] left-2 sm:left-4 z-40 w-[calc(100vw-1rem)] sm:w-[320px] max-w-[320px]">
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="text-white text-sm text-center">Loading equipment...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-[492px] sm:top-[512px] left-2 sm:left-4 z-40 w-[calc(100vw-1rem)] sm:w-[320px] max-w-[320px]">
      <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/20">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">⚔️</span>
          <span className="text-base font-bold text-gray-100">Equipment</span>
        </div>

        {/* Equipment Slots */}
        <div className="space-y-2">
          {slots.map((slot) => {
            const slotData = getSlotDisplay(slot);
            return (
              <button
                key={slot}
                onClick={() => onSlotClick(slot)}
                disabled={disabled}
                className={`
                  relative w-full flex items-center gap-3 p-2 rounded border-2 transition-all
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'}
                  ${slotData.isEmpty ? 'border-gray-700 bg-gray-900/50' : `${getRarityColor(slotData.rarity)} bg-gray-800/70`}
                `}
              >
                {/* Icon */}
                <div className="text-2xl">{slotData.icon}</div>

                {/* Slot Info */}
                <div className="flex-1 text-left">
                  <div className="text-xs text-gray-400">{slotData.label}</div>
                  <div className={`text-sm font-medium ${slotData.isEmpty ? 'text-gray-500' : 'text-gray-200'}`}>
                    {slotData.name}
                  </div>
                  {/* Stat Roll indicator (for crafted items only) */}
                  {slotData.crafted && slotData.statRoll !== undefined && (
                    <div className="mt-1 scale-75 origin-left">
                      <StatRangeIndicator statRoll={slotData.statRoll} />
                    </div>
                  )}
                </div>

                {/* Change Icon */}
                {!disabled && (
                  <div className="text-gray-500 text-sm">›</div>
                )}

                {/* Tier badge (bottom left corner) */}
                {!slotData.isEmpty && slotData.tier && (
                  <div className={getTierBadgeClassName()}>
                    {tierToRoman(slotData.tier)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
