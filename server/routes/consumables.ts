// Consumables router: list owned consumables, equip/unequip to a 4-slot hotbar,
// use an equipped consumable (transactional), and enhance a consumable to infinite-use.
// Logic unchanged from the original API handlers.

import { Router, type Request, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { connectToMongo, getClient } from '@server/lib/mongodb';
import { getLootItemById } from '@shared/loot-table';
import { requireSession } from '@server/middleware/requireSession';

export const consumablesRouter = Router();

// Fetches the user's inventory of consumables.
consumablesRouter.get('/get', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Fetch all items from the inventory
    const { userInventoryCollection } = await connectToMongo();
    const inventoryItems = await userInventoryCollection.find({ userId: userId }).toArray();

    // Filter for consumables only
    const consumables = inventoryItems
      .map(item => {
        const lootItem = getLootItemById(item.lootTableId);
        if (lootItem && lootItem.type === 'consumable') {
          return {
            _id: item._id.toString(),
            lootTableId: item.lootTableId,
            name: lootItem.name,
            icon: lootItem.icon,
            description: lootItem.description,
            rarity: lootItem.rarity,
            type: lootItem.type,
            enhanced: item.enhanced || false // Phase 3.5: Enhanced consumables
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    res.json({ consumables });
    return;
  } catch (error) {
    console.error('Error fetching consumables:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Equips a consumable item to a hotbar slot. Body: { inventoryId, slotIndex (0-3) }.
consumablesRouter.post('/equip', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    const body = req.body;
    const { inventoryId, slotIndex } = body;

    // Validate input
    if (!inventoryId || typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex > 3) {
      res.status(400).json({ error: 'Invalid request data' });
      return;
    }

    const { userInventoryCollection, playerStatsCollection } = await connectToMongo();

    // Verify user owns the item
    const inventoryItem = await userInventoryCollection.findOne({
      _id: new ObjectId(inventoryId),
      userId
    });

    if (!inventoryItem) {
      res.status(404).json({ error: 'Item not found in inventory' });
      return;
    }

    // Verify item is a consumable
    const lootItem = getLootItemById(inventoryItem.lootTableId);
    if (!lootItem || lootItem.type !== 'consumable') {
      res.status(400).json({ error: 'Item is not a consumable' });
      return;
    }

    // Get player stats
    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    // Initialize equippedConsumables if it doesn't exist
    const equippedConsumables = playerStats.equippedConsumables || ['empty', 'empty', 'empty', 'empty'] as ['empty', 'empty', 'empty', 'empty'];

    // Check if this item is already equipped in any slot (prevent duplicates)
    const inventoryIdObj = new ObjectId(inventoryId);
    const alreadyEquippedIndex = equippedConsumables.findIndex(
      (id: any) => id !== 'empty' && id.toString() === inventoryIdObj.toString()
    );

    if (alreadyEquippedIndex !== -1) {
      // If already equipped in the same slot, do nothing
      if (alreadyEquippedIndex === slotIndex) {
        res.json({
          success: true,
          slotIndex,
          message: 'Item already equipped in this slot'
        });
        return;
      }

      // If equipped in a different slot, unequip from old slot first
      equippedConsumables[alreadyEquippedIndex] = 'empty';
    }

    // Equip to slot
    equippedConsumables[slotIndex] = inventoryIdObj;

    // Update player stats
    await playerStatsCollection.updateOne(
      { userId },
      { $set: { equippedConsumables } }
    );

    res.json({ success: true, slotIndex });
    return;
  } catch (error) {
    console.error('Error equipping consumable:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Unequips a consumable from a hotbar slot. Body: { slotIndex (0-3) }.
consumablesRouter.post('/unequip', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    const body = req.body;
    const { slotIndex } = body;

    // Validate input
    if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex > 3) {
      res.status(400).json({ error: 'Invalid slot index' });
      return;
    }

    const { playerStatsCollection } = await connectToMongo();

    // Get player stats
    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    // Initialize equippedConsumables if it doesn't exist
    const equippedConsumables = playerStats.equippedConsumables || ['empty', 'empty', 'empty', 'empty'] as ['empty', 'empty', 'empty', 'empty'];

    // Unequip from slot
    equippedConsumables[slotIndex] = 'empty';

    // Update player stats
    await playerStatsCollection.updateOne(
      { userId },
      { $set: { equippedConsumables } }
    );

    res.json({ success: true, slotIndex });
    return;
  } catch (error) {
    console.error('Error unequipping consumable:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Uses the consumable equipped in a hotbar slot. Body: { slotIndex (0-3) }.
// Transactional (MongoDB session) to prevent race conditions on concurrent uses.
consumablesRouter.post('/use', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Get the request body
    const body = req.body;
    const { slotIndex } = body;

    // Validate input
    if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex > 3) {
      res.status(400).json({ error: 'Invalid slot index' });
      return;
    }

    const { userInventoryCollection, playerStatsCollection } = await connectToMongo();

    // Start a MongoDB session for transaction support
    const client = await getClient();
    const session = client.startSession();

    try {
      let result: any;

      // Run all operations in a transaction to prevent race conditions
      await session.withTransaction(async () => {
        // Get player stats to find equipped consumable
        const playerStats = await playerStatsCollection.findOne(
          { userId },
          { session }
        );

        if (!playerStats) {
          throw new Error('Player stats not found');
        }

        const equippedConsumables = playerStats.equippedConsumables || ['empty', 'empty', 'empty', 'empty'] as ['empty', 'empty', 'empty', 'empty'];
        const equippedItemId = equippedConsumables[slotIndex];

        if (!equippedItemId || equippedItemId === 'empty') {
          throw new Error('No item equipped in slot');
        }

        // Check if item exists in inventory (within transaction)
        const inventoryItem = await userInventoryCollection.findOne(
          { _id: equippedItemId, userId },
          { session }
        );

        if (!inventoryItem) {
          // Item doesn't exist, unequip it
          equippedConsumables[slotIndex] = 'empty';
          await playerStatsCollection.updateOne(
            { userId },
            { $set: { equippedConsumables } },
            { session }
          );
          result = {
            success: false,
            remainingQuantity: 0,
            shouldUnequip: true,
            error: 'Item not found in inventory'
          };
          return;
        }

        const lootTableId = inventoryItem.lootTableId;

        // Phase 3.5: Enhanced consumables have infinite uses
        if (inventoryItem.enhanced) {
          // Don't delete the item, just set cooldown
          // Count all instances of this consumable (for display)
          const totalCount = await userInventoryCollection.countDocuments(
            { userId, lootTableId },
            { session }
          );

          result = {
            success: true,
            remainingQuantity: totalCount, // Keep showing quantity
            shouldUnequip: false, // Never unequip enhanced items
            lootTableId,
            isEnhanced: true
          };
          return;
        }

        // Regular consumable: Delete one instance of the item (within transaction)
        await userInventoryCollection.deleteOne(
          { _id: equippedItemId, userId },
          { session }
        );

        // Count remaining items of same type (within transaction)
        const remainingCount = await userInventoryCollection.countDocuments(
          { userId, lootTableId },
          { session }
        );

        // If no more items, unequip from slot
        let shouldUnequip = false;
        if (remainingCount === 0) {
          equippedConsumables[slotIndex] = 'empty';
          await playerStatsCollection.updateOne(
            { userId },
            { $set: { equippedConsumables } },
            { session }
          );
          shouldUnequip = true;
        } else {
          // Update equipped item to next available instance (within transaction)
          const nextItem = await userInventoryCollection.findOne(
            { userId, lootTableId },
            { session }
          );
          if (nextItem) {
            equippedConsumables[slotIndex] = nextItem._id;
            await playerStatsCollection.updateOne(
              { userId },
              { $set: { equippedConsumables } },
              { session }
            );
          }
        }

        result = {
          success: true,
          remainingQuantity: remainingCount,
          shouldUnequip,
          lootTableId
        };
      });

      res.json(result);
      return;
    } catch (error: any) {
      console.error('Error using consumable:', error);
      res.status(500).json({ error: error.message || 'Failed to use consumable' });
      return;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Error using consumable:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Enhances a consumable to infinite-use (Phase 3.5): consumes gold + 4 duplicates.
// Body: { targetItemId: string }.
consumablesRouter.post('/enhance', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Parse request body
    const body = req.body;
    const { targetItemId } = body;

    if (!targetItemId || typeof targetItemId !== 'string') {
      res.status(400).json({ error: 'Target item ID is required' });
      return;
    }

    // Validate ObjectId
    let targetObjectId: ObjectId;
    try {
      targetObjectId = new ObjectId(targetItemId);
    } catch (error) {
      res.status(400).json({ error: 'Invalid item ID format' });
      return;
    }

    // Connect to MongoDB
    const { userInventoryCollection, playerStatsCollection } = await connectToMongo();

    // Fetch the target item
    const targetItem = await userInventoryCollection.findOne({
      _id: targetObjectId,
      userId
    });

    if (!targetItem) {
      res.status(404).json({ error: 'Item not found in your inventory' });
      return;
    }

    // Verify it's a consumable
    if (targetItem.itemType !== 'consumable') {
      res.status(400).json({ error: 'Only consumables can be enhanced' });
      return;
    }

    // Check if already enhanced
    if (targetItem.enhanced) {
      res.status(400).json({ error: 'This consumable is already enhanced' });
      return;
    }

    // Get the loot template to check rarity
    const lootTemplate = getLootItemById(targetItem.lootTableId);
    if (!lootTemplate) {
      res.status(404).json({ error: 'Item template not found' });
      return;
    }

    // Calculate gold cost based on rarity
    const goldCosts: Record<string, number> = {
      common: 500,
      rare: 2000,
      epic: 5000,
      legendary: 10000
    };
    const goldCost = goldCosts[lootTemplate.rarity] || 500;

    // Fetch player stats to check gold
    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    // Check if player has enough gold
    if (playerStats.coins < goldCost) {
      res.status(400).json({
        error: `Insufficient gold. Need ${goldCost} gold to enhance this consumable.`,
        goldCost,
        currentGold: playerStats.coins
      });
      return;
    }

    // Count duplicates of the same consumable (same lootTableId only)
    // Note: We ignore tier and empowered status because consumables don't have equipment stats
    // Any tier/empowered combination of the same consumable counts as a duplicate
    const duplicates = await userInventoryCollection.find({
      userId,
      lootTableId: targetItem.lootTableId,
      itemType: 'consumable',
      enhanced: { $ne: true } // Don't count already enhanced items
    }).toArray();

    const REQUIRED_DUPLICATES = 5; // Total required (will keep 1, consume 4 others)

    if (duplicates.length < REQUIRED_DUPLICATES) {
      res.status(400).json({
        error: `Need ${REQUIRED_DUPLICATES} copies of this consumable. You have ${duplicates.length}.`,
        required: REQUIRED_DUPLICATES,
        current: duplicates.length
      });
      return;
    }

    // Delete 4 duplicates (keep the target item, delete others)
    const itemsToDelete = duplicates
      .filter(item => item._id.toString() !== targetItemId)
      .slice(0, REQUIRED_DUPLICATES - 1) // Take 4 items
      .map(item => item._id);

    if (itemsToDelete.length < REQUIRED_DUPLICATES - 1) {
      res.status(400).json({
        error: `Could not find enough duplicates to consume. Need ${REQUIRED_DUPLICATES - 1} others besides the target.`,
        required: REQUIRED_DUPLICATES - 1,
        found: itemsToDelete.length
      });
      return;
    }

    // Perform the enhancement (transaction-like operations)
    // 1. Delete duplicate items
    await userInventoryCollection.deleteMany({
      _id: { $in: itemsToDelete }
    });

    // 2. Deduct gold cost
    await playerStatsCollection.updateOne(
      { userId },
      { $inc: { coins: -goldCost } }
    );

    // 3. Set enhanced flag on target item
    await userInventoryCollection.updateOne(
      { _id: targetObjectId },
      { $set: { enhanced: true } }
    );

    res.json({
      success: true,
      itemName: lootTemplate.name,
      itemIcon: lootTemplate.icon,
      rarity: lootTemplate.rarity,
      goldCost,
      duplicatesConsumed: itemsToDelete.length,
      remainingGold: playerStats.coins - goldCost
    });
    return;
  } catch (error) {
    console.error('Error enhancing consumable:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});
