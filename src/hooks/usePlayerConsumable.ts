import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { getLootItemById } from '@/lib/loot-table';

interface ConsumableSlot {
  itemId: string | null;
  inventoryId: string | null; // ID in userInventory collection
  name: string;
  icon: string;
  quantity: number;
  cooldown: number; // Cooldown in seconds
  lastUsed: number | null; // Timestamp of last use
}

interface UseConsumableResult {
  consumableSlots: ConsumableSlot[];
  loadEquippedConsumables: () => Promise<void>;
  useConsumable: (slotIndex: number) => Promise<boolean>;
  equipConsumable: (slotIndex: number, inventoryId: string) => Promise<boolean>;
  unequipConsumable: (slotIndex: number) => Promise<boolean>;
}

/**
 * Manages player consumable hotbar slots (loaded from playerStats.equippedConsumables)
 *
 * Features:
 * - Loads 4 consumable slots from playerStats (expanded from 3 for complex loadout strategies)
 * - Tracks quantity of each equipped consumable type
 * - Handles equip/unequip via API
 * - Auto-unequips when quantity reaches 0
 */
export function usePlayerConsumable(): UseConsumableResult {
  const [consumableSlots, setConsumableSlots] = useState<ConsumableSlot[]>([
    { itemId: null, inventoryId: null, name: '', icon: '', quantity: 0, cooldown: 0, lastUsed: null },
    { itemId: null, inventoryId: null, name: '', icon: '', quantity: 0, cooldown: 0, lastUsed: null },
    { itemId: null, inventoryId: null, name: '', icon: '', quantity: 0, cooldown: 0, lastUsed: null },
    { itemId: null, inventoryId: null, name: '', icon: '', quantity: 0, cooldown: 0, lastUsed: null }
  ]);

  // Ref to track lastUsed timestamps without causing re-renders or dependency issues
  // This persists across re-renders but doesn't trigger them when updated
  const lastUsedRef = useRef<(number | null)[]>([null, null, null, null]);

  // Load equipped consumables from playerStats
  const loadEquippedConsumables = useCallback(async () => {
    try {
      // Fetch player stats (which includes equippedConsumables array)
      const response = await fetch('/api/player-stats');
      if (!response.ok) {
        throw new Error('Failed to load player stats');
      }

      const data = await response.json();
      // Ensure we always have exactly 4 slots, handle empty arrays and falsy values
      let equippedConsumables = data.playerStats?.equippedConsumables;
      if (!equippedConsumables || !Array.isArray(equippedConsumables) || equippedConsumables.length !== 4) {
        equippedConsumables = ['empty', 'empty', 'empty', 'empty'];
      }

      // Fetch all inventory items to count quantities
      const inventoryResponse = await fetch('/api/consumables/get');
      if (!inventoryResponse.ok) {
        throw new Error('Failed to load inventory');
      }

      const inventoryData = await inventoryResponse.json();
      const allConsumables = inventoryData.consumables || [];

      // Count quantities by lootTableId
      const quantityMap = new Map<string, number>();
      allConsumables.forEach((item: any) => {
        const count = quantityMap.get(item.lootTableId) || 0;
        quantityMap.set(item.lootTableId, count + 1);
      });

      // Build consumable slots from equipped items
      const newSlots: ConsumableSlot[] = await Promise.all(
        equippedConsumables.map(async (inventoryId: any, index: number) => {
          if (!inventoryId || inventoryId === 'empty') {
            return { itemId: null, inventoryId: null, name: '', icon: '', quantity: 0, cooldown: 0, lastUsed: null };
          }

          // Normalize inventoryId to string for comparison (handle both ObjectId and string types)
          const inventoryIdStr = typeof inventoryId === 'string' ? inventoryId : inventoryId.toString();

          // Find this specific item in inventory
          const equippedItem = allConsumables.find((item: any) => item._id === inventoryIdStr);
          if (!equippedItem) {
            // Item no longer exists, return empty slot
            return { itemId: null, inventoryId: null, name: '', icon: '', quantity: 0, cooldown: 0, lastUsed: null };
          }

          const lootTableId = equippedItem.lootTableId;
          const lootItem = getLootItemById(lootTableId);

          if (!lootItem) {
            return { itemId: null, inventoryId: null, name: '', icon: '', quantity: 0, cooldown: 0, lastUsed: null };
          }

          const quantity = quantityMap.get(lootTableId) || 0;

          // Preserve existing lastUsed from ref (doesn't depend on state, avoids stale closure)
          // Only preserve if the same item type is still in the slot
          const lastUsed = lastUsedRef.current[index];

          const slot = {
            itemId: lootTableId,
            inventoryId: inventoryIdStr,
            name: lootItem.name,
            icon: lootItem.icon,
            quantity,
            cooldown: lootItem.cooldown || 5,
            lastUsed
          };

          // Update ref with current lastUsed value
          lastUsedRef.current[index] = lastUsed;

          return slot;
        })
      );

      setConsumableSlots(newSlots);
    } catch (error) {
      console.error('Failed to load equipped consumables:', error);
      toast.error('Failed to load consumables');
    }
  }, []);

  // Use consumable from slot
  const useConsumable = useCallback(async (slotIndex: number): Promise<boolean> => {
    const slot = consumableSlots[slotIndex];

    if (!slot.itemId || slot.quantity === 0) {
      return false;
    }

    try {
      // Call API to use consumable
      const response = await fetch('/api/consumables/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to use consumable');
      }

      const data = await response.json();
      const { remainingQuantity, shouldUnequip } = data;

      // Update local state
      setConsumableSlots(prev => {
        const updated = [...prev];
        if (shouldUnequip) {
          // Clear slot and ref
          updated[slotIndex] = {
            itemId: null,
            inventoryId: null,
            name: '',
            icon: '',
            quantity: 0,
            cooldown: 0,
            lastUsed: null
          };
          lastUsedRef.current[slotIndex] = null;
        } else {
          // Decrease quantity and set lastUsed timestamp
          const now = Date.now();
          updated[slotIndex] = {
            ...updated[slotIndex],
            quantity: remainingQuantity,
            lastUsed: now
          };
          // Update ref to keep in sync
          lastUsedRef.current[slotIndex] = now;
        }
        return updated;
      });

      return true;
    } catch (error) {
      console.error('Failed to use consumable:', error);
      toast.error('Failed to use item');
      return false;
    }
  }, [consumableSlots]);

  // Equip consumable to slot
  const equipConsumable = useCallback(async (slotIndex: number, inventoryId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/consumables/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex, inventoryId })
      });

      if (!response.ok) {
        throw new Error('Failed to equip consumable');
      }

      // Reload equipped consumables
      await loadEquippedConsumables();
      toast.success('Consumable equipped!', { duration: 2000 });
      return true;
    } catch (error) {
      console.error('Failed to equip consumable:', error);
      toast.error('Failed to equip item');
      return false;
    }
  }, [loadEquippedConsumables]);

  // Unequip consumable from slot
  const unequipConsumable = useCallback(async (slotIndex: number): Promise<boolean> => {
    try {
      const response = await fetch('/api/consumables/unequip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex })
      });

      if (!response.ok) {
        throw new Error('Failed to unequip consumable');
      }

      // Reload equipped consumables from server
      await loadEquippedConsumables();
      toast.success('Consumable unequipped!', { duration: 2000 });
      return true;
    } catch (error) {
      console.error('Failed to unequip consumable:', error);
      toast.error('Failed to unequip item');
      return false;
    }
  }, [loadEquippedConsumables]);

  // Load equipped consumables on mount
  useEffect(() => {
    loadEquippedConsumables();
  }, [loadEquippedConsumables]);

  return {
    consumableSlots,
    loadEquippedConsumables,
    useConsumable,
    equipConsumable,
    unequipConsumable
  };
}
