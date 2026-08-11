
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { getLootItemById } from '@shared/loot-table';
import type { EquipmentSlot, EquippedItem } from '@shared/types';
import { useAuthContext } from './WalletContext';
import { apiFetchStepUp } from '@/lib/apiFetchStepUp';

export type { EquipmentSlot, EquippedItem };

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
  const { isAuthenticated, userWallet, hasSession } = useAuthContext();

  /**
   * Fetch equipped items from the server
   * Memoized with useCallback to prevent infinite loops in hooks that depend on this function
   */
  const refreshEquipment = useCallback(async () => {
    if (hasSession !== true) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiFetch('/api/equipment/get');
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
            isEmpowered: data.equippedWeapon.isEmpowered,
            prefix: data.equippedWeapon.prefix,
            suffix: data.equippedWeapon.suffix
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
            isEmpowered: data.equippedArmor.isEmpowered,
            prefix: data.equippedArmor.prefix,
            suffix: data.equippedArmor.suffix
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
            isEmpowered: data.equippedAccessory1.isEmpowered,
            prefix: data.equippedAccessory1.prefix,
            suffix: data.equippedAccessory1.suffix
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
            isEmpowered: data.equippedAccessory2.isEmpowered,
            prefix: data.equippedAccessory2.prefix,
            suffix: data.equippedAccessory2.suffix
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
  }, [hasSession]);

  /**
   * Equip an item to a specific slot
   * Memoized with useCallback to prevent infinite loops
   */
  const equipItem = useCallback(async (inventoryId: string, lootTableId: string, slot: EquipmentSlot) => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }
    if (!userWallet) {
      throw new Error('Wallet not connected');
    }

    try {
      const response = await apiFetchStepUp('/api/equipment/equip', {
        wallet: userWallet,
        context: 'equip',
        body: { inventoryId, slot },
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
  }, [isAuthenticated, userWallet, refreshEquipment]); // Depends on refreshEquipment (which is memoized)

  /**
   * Unequip an item from a specific slot
   * Memoized with useCallback to prevent infinite loops
   */
  const unequipItem = useCallback(async (slot: EquipmentSlot) => {
    if (isAuthenticated !== true) {
      throw new Error('Not authenticated');
    }
    if (!userWallet) {
      throw new Error('Wallet not connected');
    }

    try {
      const response = await apiFetchStepUp('/api/equipment/unequip', {
        wallet: userWallet,
        context: 'unequip',
        body: { slot },
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
  }, [isAuthenticated, userWallet, refreshEquipment]); // Depends on refreshEquipment (which is memoized)

  // Load equipment when an app session exists (mount-with-cookie or post-login)
  useEffect(() => {
    if (hasSession === true) {
      refreshEquipment();
      return;
    }

    // Handle both false (no session) and null (session check pending)
    if (!hasSession) {
      setEquippedWeapon(null);
      setEquippedArmor(null);
      setEquippedAccessory1(null);
      setEquippedAccessory2(null);
      setIsLoading(false);
    }
  }, [hasSession, refreshEquipment]); // Include refreshEquipment in deps (it's memoized, so won't cause re-runs)

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
