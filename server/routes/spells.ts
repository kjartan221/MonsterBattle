// Spell scroll router: equip/unequip the spell slot, cast the equipped spell
// (with server-side cooldown anti-cheat), and upgrade a spell scroll's tier
// by consuming duplicates + gold.
// Ported verbatim from src/app/api/spells/{equip,unequip,cast,upgrade}/route.ts.

import { Router, type Request, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { connectToMongo } from '@/lib/mongodb';
import { getLootItemById } from '@/lib/loot-table';
import { requireSession } from '@server/middleware/requireSession';

export const spellsRouter = Router();

// Equips a spell scroll from inventory to the spell slot (Q key).
spellsRouter.post('/equip', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Get request body
    const body = req.body;
    const { inventoryId } = body;

    // Validate input
    if (!inventoryId) {
      res.status(400).json({ error: 'inventoryId is required' });
      return;
    }

    // Convert inventoryId to ObjectId
    let inventoryObjectId: ObjectId;
    try {
      inventoryObjectId = new ObjectId(inventoryId);
    } catch (error) {
      res.status(400).json({ error: 'Invalid inventory ID format' });
      return;
    }

    // Connect to MongoDB
    const { userInventoryCollection, playerStatsCollection } = await connectToMongo();

    // Verify the item exists in user's inventory
    const inventoryItem = await userInventoryCollection.findOne({
      _id: inventoryObjectId,
      userId
    });

    if (!inventoryItem) {
      res.status(404).json({ error: 'Item not found in inventory' });
      return;
    }

    // Verify it's a spell scroll
    const lootItem = getLootItemById(inventoryItem.lootTableId);
    if (!lootItem || lootItem.type !== 'spell_scroll') {
      res.status(400).json({ error: 'Item is not a spell scroll' });
      return;
    }

    // Update playerStats with equipped spell
    const updateResult = await playerStatsCollection.updateOne(
      { userId },
      {
        $set: {
          equippedSpell: inventoryObjectId
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Spell equipped successfully',
      spellName: lootItem.name
    });
    return;

  } catch (error) {
    console.error('Error equipping spell:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Unequips the spell scroll from the spell slot (Q key).
spellsRouter.post('/unequip', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Connect to MongoDB
    const { playerStatsCollection } = await connectToMongo();

    // Update playerStats to remove equipped spell
    const updateResult = await playerStatsCollection.updateOne(
      { userId },
      {
        $set: {
          equippedSpell: 'empty'
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Spell unequipped successfully'
    });
    return;

  } catch (error) {
    console.error('Error unequipping spell:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Casts the equipped spell (damage or healing).
// Tracks spell usage server-side to prevent cooldown bypassing.
spellsRouter.post('/cast', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Connect to MongoDB
    const { playerStatsCollection, userInventoryCollection } = await connectToMongo();

    // Get player stats (includes equippedSpell and spell cooldown tracking)
    const playerStats = await playerStatsCollection.findOne({ userId });

    if (!playerStats) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    // Check if spell is equipped
    const equippedSpellId = playerStats.equippedSpell;
    if (!equippedSpellId || equippedSpellId === 'empty') {
      res.status(400).json({ error: 'No spell equipped' });
      return;
    }

    // Convert to ObjectId
    const inventoryObjectId = typeof equippedSpellId === 'string'
      ? new ObjectId(equippedSpellId)
      : equippedSpellId;

    // Get the spell scroll from inventory
    const inventoryItem = await userInventoryCollection.findOne({
      _id: inventoryObjectId,
      userId
    });

    if (!inventoryItem) {
      res.status(404).json({ error: 'Equipped spell not found in inventory' });
      return;
    }

    // Get spell data from loot table
    const lootItem = getLootItemById(inventoryItem.lootTableId);
    if (!lootItem || lootItem.type !== 'spell_scroll' || !lootItem.spellData) {
      res.status(400).json({ error: 'Invalid spell data' });
      return;
    }

    const spellData = lootItem.spellData;
    const spellTier = inventoryItem.tier || 1;

    // Apply tier scaling to spell stats (from GAME_DESIGN_PROPOSAL.md)
    // Damage/Healing multipliers: [1.0, 1.5, 2.125, 2.875, 3.75]
    // Cooldown reduction: -(tier - 1) * 2 seconds
    const tierMultipliers = [1.0, 1.5, 2.125, 2.875, 3.75];
    const statMultiplier = tierMultipliers[spellTier - 1] || 1.0;
    const cooldownReduction = (spellTier - 1) * 2;
    const actualCooldown = Math.max(5, spellData.cooldown - cooldownReduction); // Min 5s cooldown

    // ANTI-CHEAT: Check cooldown server-side
    // Use server-stored lastSpellCast timestamp (not client-provided)
    const lastSpellCast = playerStats.lastSpellCast || 0;
    const timeSinceLastCast = (Date.now() - lastSpellCast) / 1000; // seconds
    const cooldownRemaining = Math.max(0, actualCooldown - timeSinceLastCast);

    if (cooldownRemaining > 0) {
      res.status(400).json({
        error: 'Spell on cooldown',
        cooldownRemaining: Math.ceil(cooldownRemaining)
      });
      return;
    }

    // Execute spell effect with tier scaling
    let damage = 0;
    let healing = 0;

    if (spellData.damage) {
      // Damage spell - apply tier multiplier
      damage = Math.round(spellData.damage * statMultiplier);
    } else if (spellData.healing) {
      // Healing spell - apply tier multiplier
      // Frontend's healHealth() hook will handle max HP calculation with equipment bonuses
      healing = Math.round(spellData.healing * statMultiplier);

      // Update cooldown timestamp
      await playerStatsCollection.updateOne(
        { userId },
        { $set: { lastSpellCast: Date.now() } }
      );
    }

    // Update lastSpellCast timestamp for damage spells too
    if (damage > 0) {
      await playerStatsCollection.updateOne(
        { userId },
        {
          $set: {
            lastSpellCast: Date.now()
          }
        }
      );
    }

    // Calculate tier-scaled debuff value
    const tierScaledDebuffValue = spellData.debuffValue ? Math.round(spellData.debuffValue * statMultiplier) : undefined;

    // Return spell results including buff/debuff data (tier-scaled)
    res.json({
      success: true,
      spellName: spellData.spellName,
      damage,
      healing,
      effect: spellData.effect,
      // Buff data (for player buffs) - tier-scaled
      buffType: spellData.buffType,
      buffValue: spellData.buffValue ? Math.round(spellData.buffValue * statMultiplier) : undefined,
      duration: spellData.duration,
      // Debuff data (for monster debuffs) - tier-scaled
      debuffType: spellData.debuffType,
      debuffValue: tierScaledDebuffValue,
      debuffDamageType: spellData.debuffDamageType
    });
    return;

  } catch (error) {
    console.error('Error casting spell:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Upgrades a spell scroll by consuming duplicates.
// Requirements:
// - Must have the target spell equipped or in inventory
// - Must have required number of tier 1 duplicates of the same spell
// - Must have required gold
// - Each tier requires more duplicates and gold
spellsRouter.post('/upgrade', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Get request body
    const body = req.body;
    const { inventoryId } = body; // The spell inventory item to upgrade

    if (!inventoryId) {
      res.status(400).json({ error: 'Missing inventoryId' });
      return;
    }

    // Connect to MongoDB
    const { playerStatsCollection, userInventoryCollection } = await connectToMongo();

    // Get player stats
    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    // Get the spell scroll to upgrade
    const targetSpell = await userInventoryCollection.findOne({
      _id: new ObjectId(inventoryId),
      userId
    });

    if (!targetSpell) {
      res.status(404).json({ error: 'Spell not found in inventory' });
      return;
    }

    // Verify it's a spell scroll
    const lootItem = getLootItemById(targetSpell.lootTableId);
    if (!lootItem || lootItem.type !== 'spell_scroll') {
      res.status(400).json({ error: 'Item is not a spell scroll' });
      return;
    }

    // Get current tier (default to 1 if not set)
    const currentTier = targetSpell.tier || 1;
    const nextTier = currentTier + 1;

    // Define upgrade requirements per tier (from GAME_DESIGN_PROPOSAL.md)
    // Tier 1 → 2: 1 duplicate, 500 gold
    // Tier 2 → 3: 2 duplicates, 1000 gold
    // Tier 3 → 4: 3 duplicates, 2000 gold
    // Tier 4 → 5: 5 duplicates, 5000 gold
    const upgradeRequirements: Record<number, { duplicates: number; gold: number }> = {
      1: { duplicates: 1, gold: 500 },
      2: { duplicates: 2, gold: 1000 },
      3: { duplicates: 3, gold: 2000 },
      4: { duplicates: 5, gold: 5000 }
    };

    // Check if max tier reached
    if (currentTier >= 5) {
      res.status(400).json({ error: 'Spell is already at maximum tier' });
      return;
    }

    const requirements = upgradeRequirements[currentTier];

    // Find all tier 1 duplicates of this spell (excluding the target spell itself)
    const duplicates = await userInventoryCollection.find({
      userId,
      lootTableId: targetSpell.lootTableId,
      tier: 1, // Only tier 1 spells count as duplicates
      _id: { $ne: targetSpell._id } // Exclude the spell being upgraded
    }).toArray();

    // Check if player has enough duplicates
    if (duplicates.length < requirements.duplicates) {
      res.status(400).json({
        error: `Need ${requirements.duplicates} tier 1 duplicates, have ${duplicates.length}`,
        required: requirements.duplicates,
        available: duplicates.length
      });
      return;
    }

    // Check if player has enough gold
    if (playerStats.coins < requirements.gold) {
      res.status(400).json({
        error: `Need ${requirements.gold} gold, have ${playerStats.coins}`,
        required: requirements.gold,
        available: playerStats.coins
      });
      return;
    }

    // Consume the duplicates (delete them)
    const duplicatesToConsume = duplicates.slice(0, requirements.duplicates);
    const duplicateIds = duplicatesToConsume.map(d => d._id);

    await userInventoryCollection.deleteMany({
      _id: { $in: duplicateIds }
    });

    // Deduct gold
    await playerStatsCollection.updateOne(
      { userId },
      {
        $set: {
          coins: playerStats.coins - requirements.gold
        }
      }
    );

    // Upgrade the spell to next tier (cast to Tier type)
    await userInventoryCollection.updateOne(
      { _id: targetSpell._id },
      {
        $set: {
          tier: nextTier as 1 | 2 | 3 | 4 | 5
        }
      }
    );

    res.json({
      success: true,
      previousTier: currentTier,
      newTier: nextTier,
      duplicatesConsumed: requirements.duplicates,
      goldSpent: requirements.gold
    });
    return;

  } catch (error) {
    console.error('Error upgrading spell:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});
