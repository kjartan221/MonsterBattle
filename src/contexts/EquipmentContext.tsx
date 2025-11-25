'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getLootItemById, LootItem } from '@/lib/loot-table';

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory1' | 'accessory2';

export interface EquippedItem {
  inventoryId: string; // UserInventory._id
  lootTableId: string;
  tier: number; // Which tier this item is (1-5)
  slot: EquipmentSlot;
  lootItem: LootItem; // Full item data from loot-table
  crafted?: boolean; // Whether the item was crafted
  statRoll?: number; // Stat roll multiplier (0.8 to 1.2) for crafted items
  isEmpowered?: boolean; // Dropped from corrupted monster (+20% to all stats)
}

interface EquipmentContextType {
  equippedWeapon: EquippedItem | null;
  equippedArmor: EquippedItem | null;
  equippedAccessory1: EquippedItem | null;
  equippedAccessory2: EquippedItem | null;
  equipItem: (inventoryId: string, lootTableId: string, slot: EquipmentSlot) => Promise<void>;
  unequipItem: (slot: EquipmentSlot) => Promise<void>;
  refreshEquipment: () => Promise<void>;
  isLoading: boolean;
}

const EquipmentContext = createContext<EquipmentContextType | undefined>(undefined);

export function EquipmentProvider({ children }: { children: ReactNode }) {
  const [equippedWeapon, setEquippedWeapon] = useState<EquippedItem | null>(null);
  const [equippedArmor, setEquippedArmor] = useState<EquippedItem | null>(null);
  const [equippedAccessory1, setEquippedAccessory1] = useState<EquippedItem | null>(null);
  const [equippedAccessory2, setEquippedAccessory2] = useState<EquippedItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetch equipped items from the server
   * Memoized with useCallback to prevent infinite loops in hooks that depend on this function
   */
  const refreshEquipment = useCallback(async () => {
    try {
      const response = await fetch('/api/equipment/get');
      if (!response.ok) {
        throw new Error('Failed to fetch equipment');
      }

      const data = await response.json();

      // Parse equipped items and fetch loot data from loot-table
      if (data.equippedWeapon) {
        const lootItem = getLootItemById(data.equippedWeapon.lootTableId);
        if (lootItem) {
          setEquippedWeapon({
            inventoryId: data.equippedWeapon.inventoryId,
            lootTableId: data.equippedWeapon.lootTableId,
            tier: data.equippedWeapon.tier,
            slot: 'weapon',
            lootItem,
            crafted: data.equippedWeapon.crafted,
            statRoll: data.equippedWeapon.statRoll,
            isEmpowered: data.equippedWeapon.isEmpowered
          });
        }
      } else {
        setEquippedWeapon(null);
      }

      if (data.equippedArmor) {
        const lootItem = getLootItemById(data.equippedArmor.lootTableId);
        if (lootItem) {
          setEquippedArmor({
            inventoryId: data.equippedArmor.inventoryId,
            lootTableId: data.equippedArmor.lootTableId,
            tier: data.equippedArmor.tier,
            slot: 'armor',
            lootItem,
            crafted: data.equippedArmor.crafted,
            statRoll: data.equippedArmor.statRoll,
            isEmpowered: data.equippedArmor.isEmpowered
          });
        }
      } else {
        setEquippedArmor(null);
      }

      if (data.equippedAccessory1) {
        const lootItem = getLootItemById(data.equippedAccessory1.lootTableId);
        if (lootItem) {
          setEquippedAccessory1({
            inventoryId: data.equippedAccessory1.inventoryId,
            lootTableId: data.equippedAccessory1.lootTableId,
            tier: data.equippedAccessory1.tier,
            slot: 'accessory1',
            lootItem,
            crafted: data.equippedAccessory1.crafted,
            statRoll: data.equippedAccessory1.statRoll,
            isEmpowered: data.equippedAccessory1.isEmpowered
          });
        }
      } else {
        setEquippedAccessory1(null);
      }

      if (data.equippedAccessory2) {
        const lootItem = getLootItemById(data.equippedAccessory2.lootTableId);
        if (lootItem) {
          setEquippedAccessory2({
            inventoryId: data.equippedAccessory2.inventoryId,
            lootTableId: data.equippedAccessory2.lootTableId,
            tier: data.equippedAccessory2.tier,
            slot: 'accessory2',
            lootItem,
            crafted: data.equippedAccessory2.crafted,
            statRoll: data.equippedAccessory2.statRoll,
            isEmpowered: data.equippedAccessory2.isEmpowered
          });
        }
      } else {
        setEquippedAccessory2(null);
      }

    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty deps - uses setState directly, no external dependencies

  /**
   * Equip an item to a specific slot
   * Memoized with useCallback to prevent infinite loops
   */
  const equipItem = useCallback(async (inventoryId: string, lootTableId: string, slot: EquipmentSlot) => {
    try {
      const response = await fetch('/api/equipment/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId, slot })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to equip item');
      }

      // Optimistically update the UI
      const lootItem = getLootItemById(lootTableId);
      if (lootItem) {
        const equippedItem: EquippedItem = {
          inventoryId,
          lootTableId,
          tier: 1, // Placeholder - will be updated by refreshEquipment()
          slot,
          lootItem
        };

        switch (slot) {
          case 'weapon':
            setEquippedWeapon(equippedItem);
            break;
          case 'armor':
            setEquippedArmor(equippedItem);
            break;
          case 'accessory1':
            setEquippedAccessory1(equippedItem);
            break;
          case 'accessory2':
            setEquippedAccessory2(equippedItem);
            break;
        }
      }

      // Refresh to confirm from server (blocking - equipment affects battle)
      await refreshEquipment();
    } catch (error) {
      console.error('Failed to equip item:', error);
      throw error;
    }
  }, [refreshEquipment]); // Depends on refreshEquipment (which is memoized)

  /**
   * Unequip an item from a specific slot
   * Memoized with useCallback to prevent infinite loops
   */
  const unequipItem = useCallback(async (slot: EquipmentSlot) => {
    try {
      const response = await fetch('/api/equipment/unequip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unequip item');
      }

      // Optimistically update the UI
      switch (slot) {
        case 'weapon':
          setEquippedWeapon(null);
          break;
        case 'armor':
          setEquippedArmor(null);
          break;
        case 'accessory1':
          setEquippedAccessory1(null);
          break;
        case 'accessory2':
          setEquippedAccessory2(null);
          break;
      }

      // Refresh to confirm from server (blocking - equipment affects battle)
      await refreshEquipment();
    } catch (error) {
      console.error('Failed to unequip item:', error);
      throw error;
    }
  }, [refreshEquipment]); // Depends on refreshEquipment (which is memoized)

  // Load equipment on mount
  useEffect(() => {
    refreshEquipment();
  }, [refreshEquipment]); // Include refreshEquipment in deps (it's memoized, so won't cause re-runs)

  return (
    <EquipmentContext.Provider
      value={{
        equippedWeapon,
        equippedArmor,
        equippedAccessory1,
        equippedAccessory2,
        equipItem,
        unequipItem,
        refreshEquipment,
        isLoading
      }}
    >
      {children}
    </EquipmentContext.Provider>
  );
}

export function useEquipment() {
  const context = useContext(EquipmentContext);
  if (context === undefined) {
    throw new Error('useEquipment must be used within an EquipmentProvider');
  }
  return context;
}
