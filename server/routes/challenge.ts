// Challenge-mode config router: get/update the player's battle challenge settings.
// Ported verbatim from src/app/api/challenge/{get,update}/route.ts.
// GET uses requireSession (matches its source); POST uses requireAuthProof('challenge')
// (matches its source, which reads body.proof — the client already sends it, see
// src/contexts/ChallengeContext.tsx).

import { Router, type Request, type Response } from 'express';
import { connectToMongo } from '@server/lib/mongodb';
import { requireSession } from '@server/middleware/requireSession';
import { requireAuthProof } from '@server/middleware/requireAuthProof';

export const challengeRouter = Router();

// Get player's current challenge mode configuration
challengeRouter.get('/get', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Connect to MongoDB
    const { playerStatsCollection } = await connectToMongo();

    // Fetch player stats
    const playerStats = await playerStatsCollection.findOne({ userId });

    if (!playerStats) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    // Default config values
    const defaultConfig = {
      forceShield: false,
      forceSpeed: false,
      damageMultiplier: 1.0,
      hpMultiplier: 1.0,
      dotIntensity: 1.0,
      corruptionRate: 0,
      escapeTimerSpeed: 1.0,
      buffStrength: 1.0,
      bossSpawnRate: 1.0,
      skillshotCircles: 0,
      skillshotSpeed: 1.0
    };

    // Merge stored config with defaults (handles legacy configs missing new fields)
    const config = {
      ...defaultConfig,
      ...(playerStats.battleChallengeConfig || {})
    };

    res.json({ config });
    return;
  } catch (error) {
    console.error('Error fetching challenge config:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Update player's challenge mode configuration
// Body: { config: { forceShield, forceSpeed, damageMultiplier, hpMultiplier, ... }, proof }
challengeRouter.post('/update', requireAuthProof('challenge'), async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    const body = req.body;
    const { config } = body;

    if (!config) {
      res.status(400).json({ error: 'Config required' });
      return;
    }

    // Validate config structure
    if (
      typeof config.forceShield !== 'boolean' ||
      typeof config.forceSpeed !== 'boolean' ||
      typeof config.damageMultiplier !== 'number' ||
      typeof config.hpMultiplier !== 'number' ||
      typeof config.dotIntensity !== 'number' ||
      typeof config.corruptionRate !== 'number' ||
      typeof config.escapeTimerSpeed !== 'number' ||
      typeof config.buffStrength !== 'number'
    ) {
      res.status(400).json({ error: 'Invalid config format' });
      return;
    }

    // Validate multiplier values
    const validDamageMultipliers = [1.0, 1.25, 1.5, 2.0, 3.0];
    const validHpMultipliers = [1.0, 1.5, 2.0, 3.0, 5.0];
    const validDotIntensity = [1.0, 1.5, 2.0, 3.0, 5.0];
    const validCorruptionRate = [0, 0.25, 0.5, 0.75, 1.0];
    const validEscapeTimerSpeed = [1.0, 1.5, 2.0, 3.0, 4.0];
    const validBuffStrength = [1.0, 1.5, 2.0, 3.0, 5.0];

    if (!validDamageMultipliers.includes(config.damageMultiplier)) {
      res.status(400).json({ error: 'Invalid damage multiplier' });
      return;
    }

    if (!validHpMultipliers.includes(config.hpMultiplier)) {
      res.status(400).json({ error: 'Invalid HP multiplier' });
      return;
    }

    if (!validDotIntensity.includes(config.dotIntensity)) {
      res.status(400).json({ error: 'Invalid DoT intensity' });
      return;
    }

    if (!validCorruptionRate.includes(config.corruptionRate)) {
      res.status(400).json({ error: 'Invalid corruption rate' });
      return;
    }

    if (!validEscapeTimerSpeed.includes(config.escapeTimerSpeed)) {
      res.status(400).json({ error: 'Invalid escape timer speed' });
      return;
    }

    if (!validBuffStrength.includes(config.buffStrength)) {
      res.status(400).json({ error: 'Invalid buff strength' });
      return;
    }

    // Connect to MongoDB
    const { playerStatsCollection } = await connectToMongo();

    // Update player's challenge config
    const result = await playerStatsCollection.updateOne(
      { userId },
      { $set: { battleChallengeConfig: config } }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    res.json({ success: true, config });
    return;
  } catch (error) {
    console.error('Error updating challenge config:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});
