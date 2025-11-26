import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { getLootItemById, LootItem } from '@/lib/loot-table';

interface SpellSlot {
  spellId: string | null;           // Spell ID (e.g., 'minor_heal', 'fireball')
  lootTableId: string | null;       // Loot table ID (e.g., 'spell_scroll_heal')
  inventoryId: string | null;       // ID in userInventory collection
  name: string;                     // Spell scroll name
  icon: string;                     // Emoji icon
  cooldown: number;                 // Cooldown in seconds
  lastUsed: number | null;          // Timestamp of last cast
  spellData: SpellData | null;      // Full spell data
}

interface SpellData {
  spellId: string;
  spellName: string;
  cooldown: number;
  damage?: number;
  healing?: number;
  effect?: string;
}

interface UsePlayerSpellResult {
  spellSlot: SpellSlot;
  loadEquippedSpell: () => Promise<void>;
  castSpell: () => Promise<{ success: boolean; damage?: number; healing?: number }>;
  equipSpell: (inventoryId: string) => Promise<boolean>;
  unequipSpell: () => Promise<boolean>;
}

/**
 * Manages player spell hotbar slot (loaded from playerStats.equippedSpell)
 *
 * Features:
 * - Loads 1 spell slot from playerStats.equippedSpell
 * - Tracks cooldown with timestamp
 * - Handles equip/unequip via API
 * - Casts spell with damage/healing effects
 */
export function usePlayerSpell(): UsePlayerSpellResult {
  const [spellSlot, setSpellSlot] = useState<SpellSlot>({
    spellId: null,
    lootTableId: null,
    inventoryId: null,
    name: '',
    icon: '',
    cooldown: 0,
    lastUsed: null,
    spellData: null
  });

  // Ref to track lastUsed timestamp without causing re-renders
  const lastUsedRef = useRef<number | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    lastUsedRef.current = spellSlot.lastUsed;
  }, [spellSlot.lastUsed]);

  // Load equipped spell from playerStats
  const loadEquippedSpell = useCallback(async () => {
    try {
      // Fetch player stats (which includes equippedSpell field)
      const response = await fetch('/api/player-stats');
      if (!response.ok) {
        throw new Error('Failed to load player stats');
      }

      const data = await response.json();
      const equippedSpellId = data.playerStats?.equippedSpell;

      // If no spell equipped or 'empty', set empty slot
      if (!equippedSpellId || equippedSpellId === 'empty') {
        setSpellSlot({
          spellId: null,
          lootTableId: null,
          inventoryId: null,
          name: '',
          icon: '',
          cooldown: 0,
          lastUsed: null,
          spellData: null
        });
        return;
      }

      // Normalize inventoryId to string
      const inventoryIdStr = typeof equippedSpellId === 'string' ? equippedSpellId : equippedSpellId.toString();

      // Fetch the inventory item to get lootTableId
      const inventoryResponse = await fetch('/api/inventory/get');
      if (!inventoryResponse.ok) {
        throw new Error('Failed to load inventory');
      }

      const inventoryData = await inventoryResponse.json();
      const equippedItem = inventoryData.inventory?.find((item: any) => item.inventoryId === inventoryIdStr);

      if (!equippedItem) {
        // Item no longer exists, clear slot
        setSpellSlot({
          spellId: null,
          lootTableId: null,
          inventoryId: null,
          name: '',
          icon: '',
          cooldown: 0,
          lastUsed: null,
          spellData: null
        });
        return;
      }

      const lootTableId = equippedItem.lootId;
      const lootItem = getLootItemById(lootTableId);

      if (!lootItem || lootItem.type !== 'spell_scroll' || !lootItem.spellData) {
        // Not a spell scroll, clear slot
        setSpellSlot({
          spellId: null,
          lootTableId: null,
          inventoryId: null,
          name: '',
          icon: '',
          cooldown: 0,
          lastUsed: null,
          spellData: null
        });
        return;
      }

      // Preserve existing lastUsed from ref
      const lastUsed = lastUsedRef.current;

      // Apply tier scaling to cooldown (from GAME_DESIGN_PROPOSAL.md)
      // Cooldown reduction: -(tier - 1) * 2 seconds, minimum 5s
      const spellTier = equippedItem.tier || 1;
      const cooldownReduction = (spellTier - 1) * 2;
      const actualCooldown = Math.max(5, lootItem.spellData.cooldown - cooldownReduction);

      setSpellSlot({
        spellId: lootItem.spellData.spellId,
        lootTableId: lootTableId,
        inventoryId: inventoryIdStr,
        name: lootItem.name,
        icon: lootItem.icon,
        cooldown: actualCooldown, // Use tier-scaled cooldown
        lastUsed,
        spellData: lootItem.spellData
      });

      // Update ref
      lastUsedRef.current = lastUsed;
    } catch (error) {
      console.error('Failed to load equipped spell:', error);
      toast.error('Failed to load spell');
    }
  }, []);

  // Cast spell
  const castSpell = useCallback(async (): Promise<{ success: boolean; damage?: number; healing?: number; spellName?: string; effect?: string }> => {
    if (!spellSlot.spellId || !spellSlot.spellData) {
      return { success: false };
    }

    try {
      // Call API to cast spell
      const response = await fetch('/api/spells/cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cast spell');
      }

      const data = await response.json();
      const { damage, healing, spellName, effect } = data;

      // Update lastUsed timestamp
      const now = Date.now();
      setSpellSlot(prev => ({
        ...prev,
        lastUsed: now
      }));
      lastUsedRef.current = now;

      // Show success toast
      if (healing) {
        toast.success(`${spellSlot.spellData.spellName} healed ${healing} HP!`, { duration: 3000 });
      } else if (damage) {
        toast.success(`${spellSlot.spellData.spellName} dealt ${damage} damage!`, { duration: 3000 });
      }

      return { success: true, damage, healing, spellName, effect };
    } catch (error) {
      console.error('Failed to cast spell:', error);
      toast.error('Failed to cast spell');
      return { success: false };
    }
  }, [spellSlot.spellId, spellSlot.spellData]);

  // Equip spell to slot
  const equipSpell = useCallback(async (inventoryId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/spells/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId })
      });

      if (!response.ok) {
        throw new Error('Failed to equip spell');
      }

      // Reload equipped spell
      await loadEquippedSpell();
      toast.success('Spell equipped!', { duration: 2000 });
      return true;
    } catch (error) {
      console.error('Failed to equip spell:', error);
      toast.error('Failed to equip spell');
      return false;
    }
  }, [loadEquippedSpell]);

  // Unequip spell from slot
  const unequipSpell = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/spells/unequip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error('Failed to unequip spell');
      }

      // Clear slot and reload
      await loadEquippedSpell();
      toast.success('Spell unequipped!', { duration: 2000 });
      return true;
    } catch (error) {
      console.error('Failed to unequip spell:', error);
      toast.error('Failed to unequip spell');
      return false;
    }
  }, [loadEquippedSpell]);

  // Load equipped spell on mount
  useEffect(() => {
    loadEquippedSpell();
  }, [loadEquippedSpell]);

  return {
    spellSlot,
    loadEquippedSpell,
    castSpell,
    equipSpell,
    unequipSpell
  };
}
