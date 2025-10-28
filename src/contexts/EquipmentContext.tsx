'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getLootItemById, LootItem } from '@/lib/loot-table';

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory1' | 'accessory2';

export interface EquippedItem {
  inventoryId: string; // UserInventory._id
  lootTableId: string;
  slot: EquipmentSlot;
  lootItem: LootItem; // Full item data from loot-table
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
   */
  const refreshEquipment = async () => {
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
            slot: 'weapon',
            lootItem
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
            slot: 'armor',
            lootItem
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
            slot: 'accessory1',
            lootItem
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
            slot: 'accessory2',
            lootItem
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
  };

  /**
   * Equip an item to a specific slot
   */
  const equipItem = async (inventoryId: string, lootTableId: string, slot: EquipmentSlot) => {
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

      // Refresh to confirm from server
      await refreshEquipment();
    } catch (error) {
      console.error('Failed to equip item:', error);
      throw error;
    }
  };

  /**
   * Unequip an item from a specific slot
   */
  const unequipItem = async (slot: EquipmentSlot) => {
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

      // Refresh to confirm from server
      await refreshEquipment();
    } catch (error) {
      console.error('Failed to unequip item:', error);
      throw error;
    }
  };

  // Load equipment on mount
  useEffect(() => {
    refreshEquipment();
  }, []);

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
