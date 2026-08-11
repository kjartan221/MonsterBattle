// Player-stats router: get-or-create player stats (with legacy migrations),
// and PATCH currentHealth (only client-writable field).
// Logic unchanged from the original API handler.

import { Router, type Request, type Response } from 'express';
import { connectToMongo } from '@server/lib/mongodb';
import { sanitizePlayerStatsUpdate } from '@server/lib/playerStatsSanitize';
import { requireSession } from '@server/middleware/requireSession';

export const playerRouter = Router();

// Get or initialize player stats; creates default stats if player doesn't have them yet.
playerRouter.get('/player-stats', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Connect to MongoDB
    const { playerStatsCollection } = await connectToMongo();

    // Try to find existing stats
    let playerStats = await playerStatsCollection.findOne({ userId });

    // Migrate legacy data: ensure equippedConsumables is always ['empty', 'empty', 'empty', 'empty'] format
    if (playerStats && (!playerStats.equippedConsumables || !Array.isArray(playerStats.equippedConsumables) || playerStats.equippedConsumables.length !== 4)) {
      await playerStatsCollection.updateOne(
        { userId },
        { $set: { equippedConsumables: ['empty', 'empty', 'empty', 'empty'] as ['empty', 'empty', 'empty', 'empty'] } }
      );
      playerStats.equippedConsumables = ['empty', 'empty', 'empty', 'empty'] as ['empty', 'empty', 'empty', 'empty'];
    }

    // Migrate legacy equipment: convert old separate fields to new equippedItems object
    const hasLegacyFields = playerStats && (
      playerStats.equippedWeapon !== undefined ||
      playerStats.equippedArmor !== undefined ||
      playerStats.equippedAccessory1 !== undefined ||
      playerStats.equippedAccessory2 !== undefined
    );

    if (hasLegacyFields && playerStats) {
      // Build new equippedItems object if it doesn't exist
      if (!playerStats.equippedItems) {
        const equippedItems: any = {};
        if (playerStats.equippedWeapon) equippedItems.weapon = playerStats.equippedWeapon;
        if (playerStats.equippedArmor) equippedItems.armor = playerStats.equippedArmor;
        if (playerStats.equippedAccessory1) equippedItems.accessory1 = playerStats.equippedAccessory1;
        if (playerStats.equippedAccessory2) equippedItems.accessory2 = playerStats.equippedAccessory2;

        await playerStatsCollection.updateOne(
          { userId },
          { $set: { equippedItems } }
        );
      }

      // Always remove legacy fields if they exist
      await playerStatsCollection.updateOne(
        { userId },
        { $unset: { equippedWeapon: 1, equippedArmor: 1, equippedAccessory1: 1, equippedAccessory2: 1 } }
      );

      // Refetch to get the updated document without old fields
      playerStats = await playerStatsCollection.findOne({ userId });

      if (!playerStats) {
        res.status(500).json({ error: 'Failed to refetch player stats after migration' });
        return;
      }
    }

    // If no stats exist, create default stats
    if (!playerStats) {
      const defaultStats = {
        userId,
        level: 1,
        experience: 0,
        coins: 0,
        maxHealth: 100,
        currentHealth: 100,

        // Equipment slots (empty initially)
        equippedItems: {},
        equippedConsumables: ['empty', 'empty', 'empty', 'empty'] as ['empty', 'empty', 'empty', 'empty'],

        // Battle stats
        baseDamage: 1,
        critChance: 5,
        attackSpeed: 1.0,

        // Progress
        currentZone: 0, // 0 = Forest (Tier 1)
        currentTier: 1,
        unlockedZones: ['forest-1'], // Start with Forest Tier 1 unlocked

        // Statistics
        stats: {
          battlesWon: 0,
          battlesWonStreak: 0,
          monstersDefeated: 0,
          bossesDefeated: 0,
          totalDamageDealt: 0,
          itemsCollected: 0,
          legendariesFound: 0,
        },

        createdAt: new Date(),
      };

      const result = await playerStatsCollection.insertOne(defaultStats);

      // Fetch the newly created stats
      playerStats = await playerStatsCollection.findOne({ _id: result.insertedId });
    }

    // Safety check (should never happen)
    if (!playerStats) {
      res.status(500).json({ error: 'Failed to create or retrieve player stats' });
      return;
    }

    // Convert ObjectId to string for frontend
    const { equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2, ...cleanedStats } = playerStats;

    const statsForFrontend = {
      ...cleanedStats,
      _id: playerStats._id?.toString(),
      equippedItems: playerStats.equippedItems ? {
        weapon: playerStats.equippedItems.weapon?.toString(),
        armor: playerStats.equippedItems.armor?.toString(),
        accessory1: playerStats.equippedItems.accessory1?.toString(),
        accessory2: playerStats.equippedItems.accessory2?.toString(),
      } : {},
      equippedConsumables: (playerStats.equippedConsumables && playerStats.equippedConsumables.length === 4)
        ? playerStats.equippedConsumables.map(id => id === 'empty' ? 'empty' : id.toString())
        : ['empty', 'empty', 'empty', 'empty'],
    };

    res.json({
      success: true,
      playerStats: statsForFrontend,
    });
    return;

  } catch (error) {
    console.error('Get player stats error:', error);
    res.status(500).json({ error: 'Failed to get player stats' });
    return;
  }
});

// Update player stats (HP, XP, coins, etc.) — only currentHealth is client-writable.
playerRouter.patch('/player-stats', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Get update data from request
    const body = req.body;
    const safeUpdates = sanitizePlayerStatsUpdate(body);

    if (!safeUpdates) {
      res.status(400).json({ error: 'No permitted fields to update (only currentHealth is client-writable)' });
      return;
    }

    // Connect to MongoDB
    const { playerStatsCollection } = await connectToMongo();

    // Update player stats
    const result = await playerStatsCollection.updateOne(
      { userId },
      { $set: safeUpdates }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    // Fetch updated stats
    const updatedStats = await playerStatsCollection.findOne({ userId });

    res.json({
      success: true,
      playerStats: {
        ...updatedStats,
        _id: updatedStats?._id?.toString(),
      },
    });
    return;

  } catch (error) {
    console.error('Update player stats error:', error);
    res.status(500).json({ error: 'Failed to update player stats' });
    return;
  }
});
