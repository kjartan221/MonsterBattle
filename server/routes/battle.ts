// Battle-loop router: start/resume battle, battle timer, attack resolution
// (anti-cheat + rewards + loot), end battle (death/escape), and loot selection.
// Ported verbatim from src/app/api/{start-battle,start-battle-timer,attack-monster,end-battle,select-loot}/route.ts.

import { Router, type Request, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { connectToMongo } from '@/lib/mongodb';
import { getRandomMonsterTemplateForBiome, getRandomClicksRequired, getScaledAttackDamage } from '@/lib/monster-table';
import { BiomeId, Tier, formatBiomeTierKey, isBiomeTierAvailable, applyTierSpecialAttackScaling, getNextUnlock } from '@/lib/biome-config';
import { generateMonsterBuffs } from '@/utils/monsterBuffs';
import { getCorruptionRateForStreak, getMonsterRewards, checkLevelUp, getStreakRewardMultiplier, getTierRewardMultiplier, getTierCoinMultiplier } from '@/utils/playerProgression';
import { getStreakForZone, resetStreakForZone } from '@/utils/streakHelpers';
import { MonsterBuffType } from '@/lib/types';
import { getRandomLoot, getLootItemById } from '@/lib/loot-table';
import { calculateTotalEquipmentStats, calculateMonsterDamage, calculateMonsterAttackInterval } from '@/utils/equipmentCalculations';
import type { EquippedItem } from '@/contexts/EquipmentContext';
import { buildVictoryStatMutation, buildDefeatStatMutation } from '@/lib/battleOutcome';
import { publicKeyToGradient } from '@/utils/publicKeyToColor';
import { requireSession } from '@server/middleware/requireSession';

const MAX_CLICKS_PER_SECOND = 20;
const MIN_BATTLE_DURATION_MS_FOR_VALIDATION = 1000;
const DMG_CEILING_TOLERANCE = 5; // block totalDamage above maxPlausible×this; generous (maxNoBuff excludes crit/damage buffs)

export const battleRouter = Router();

// Start a new battle or resume an active session.
battleRouter.post('/start-battle', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Get biome/tier from request body (optional)
    const body = req.body || {};
    let requestedBiome = body.biome as BiomeId | undefined;
    let requestedTier = body.tier as Tier | undefined;

    // Connect to MongoDB and get collections
    const { battleSessionsCollection, playerStatsCollection } = await connectToMongo();

    // Check if user already has an active battle session (in-progress OR pending loot selection)
    const activeSession = await battleSessionsCollection.findOne(
      {
        userId,
        selectedLootId: { $exists: false },
        $or: [
          {
            isDefeated: false,
            completedAt: { $exists: false }
          },
          {
            isDefeated: true,
            completedAt: { $exists: true },
            lootOptions: { $exists: true }
          }
        ]
      },
      {
        sort: { startedAt: -1 }
      }
    );

    if (activeSession) {
      if (!activeSession.expiresAt) {
        const baseTime = activeSession.completedAt ? new Date(activeSession.completedAt).getTime() : new Date(activeSession.startedAt).getTime();
        const expiresAt = new Date(baseTime + 24 * 60 * 60 * 1000);
        await battleSessionsCollection.updateOne(
          { _id: activeSession._id },
          { $set: { expiresAt } }
        );
        (activeSession as any).expiresAt = expiresAt;
      }

      res.json({
        session: {
          ...activeSession,
          _id: activeSession._id?.toString(),
          expiresAt: activeSession.expiresAt
        },
        monster: activeSession.monster ? {
          ...activeSession.monster,
          _id: activeSession._id?.toString()
        } : null,
        isNewSession: false
      });
      return;
    }

    // No active session found - need to create new battle
    // Get player stats to determine biome/tier
    const playerStats = await playerStatsCollection.findOne({ userId });

    if (!playerStats) {
      res.status(404).json({ error: 'Player stats not found. Please refresh the page.' });
      return;
    }

    // Determine which biome/tier to use
    let biome: BiomeId;
    let tier: Tier;

    if (requestedBiome && requestedTier) {
      // Validate requested biome/tier is unlocked
      const biomeTierKey = formatBiomeTierKey(requestedBiome, requestedTier);
      if (!playerStats.unlockedZones.includes(biomeTierKey)) {
        res.status(403).json({ error: `Biome/tier ${biomeTierKey} is not unlocked yet` });
        return;
      }

      // Validate biome/tier is implemented
      if (!isBiomeTierAvailable(requestedBiome, requestedTier)) {
        res.status(400).json({ error: `Biome/tier ${biomeTierKey} is not available yet` });
        return;
      }

      biome = requestedBiome;
      tier = requestedTier;
    } else {
      // Default to first unlocked zone (should be forest-1 for new players)
      const firstUnlocked = playerStats.unlockedZones[0] || 'forest-1';
      const parts = firstUnlocked.split('-');
      biome = parts[0] as BiomeId;
      tier = parseInt(parts[1], 10) as Tier;
    }

    // Load challenge config to check for forced buffs (before monster generation)
    const challengeConfig = playerStats.battleChallengeConfig || {
      forceShield: false,
      forceSpeed: false,
      damageMultiplier: 1.0,
      hpMultiplier: 1.0,
      dotIntensity: 1.0,
      corruptionRate: 0,
      escapeTimerSpeed: 1.0,
      buffStrength: 1.0,
      bossSpawnRate: 1.0
    };

    // Create monster for this biome/tier (pass bossSpawnRate for 5x boss spawns)
    const monsterTemplate = getRandomMonsterTemplateForBiome(biome, tier, challengeConfig.bossSpawnRate);
    const clicksRequired = getRandomClicksRequired(monsterTemplate.baseClicksRange, tier);
    const attackDamage = getScaledAttackDamage(monsterTemplate.baseAttackDamage, tier);

    // Determine which buff types to exclude from random generation
    const excludeBuffTypes: MonsterBuffType[] = [];
    if (challengeConfig.forceSpeed) {
      excludeBuffTypes.push('fast'); // Don't generate random fast buff if challenge forces it
    }

    // Generate random buffs based on tier (Tier 2+, no buffs for bosses except Tier 5)
    const randomBuffs = generateMonsterBuffs(tier, clicksRequired, monsterTemplate.isBoss || false, excludeBuffTypes);

    // Apply initial buffs from template (these stack with random buffs)
    const initialBuffs = monsterTemplate.initialBuffs || [];
    const processedInitialBuffs = initialBuffs.map(buff => {
      if (buff.type === 'shield') {
        // Calculate shield HP as percentage of monster HP
        const shieldHP = Math.floor(clicksRequired * (buff.value / 100));
        return { type: buff.type, value: shieldHP };
      }
      return buff;
    });

    // Combine initial buffs and random buffs (they stack!)
    const buffs = [...processedInitialBuffs, ...randomBuffs];

    // Corruption system: Spawn rate scales with streak (10% base → 30% at streak 100+)
    // Get current streak for this zone
    const currentStreak = getStreakForZone(playerStats.stats.battlesWonStreaks, biome, tier);

    // Calculate corruption rate based on streak (higher streak = more corrupted spawns)
    const corruptionRate = getCorruptionRateForStreak(currentStreak);
    const isCorrupted = Math.random() < corruptionRate;

    // Apply corruption multipliers if corrupted
    let finalClicksRequired = isCorrupted ? Math.round(clicksRequired * 1.5) : clicksRequired; // +50% HP
    let finalAttackDamage = isCorrupted ? Math.round(attackDamage * 1.25) : attackDamage; // +25% damage

    // Apply Challenge Mode multipliers (Phase 3.3)
    // (challengeConfig already loaded above for buff exclusion)

    // Apply HP multiplier
    if (challengeConfig.hpMultiplier > 1.0) {
      const hpBefore = finalClicksRequired;
      finalClicksRequired = Math.round(finalClicksRequired * challengeConfig.hpMultiplier);
    }

    // Apply damage multiplier
    if (challengeConfig.damageMultiplier > 1.0) {
      const dmgBefore = finalAttackDamage;
      finalAttackDamage = Math.round(finalAttackDamage * challengeConfig.damageMultiplier);
    }

    // Apply boss spawn rate bonus (+10% HP/DMG for bosses when enabled)
    if (challengeConfig.bossSpawnRate === 5.0 && monsterTemplate.isBoss) {
      const hpBefore = finalClicksRequired;
      const dmgBefore = finalAttackDamage;
      finalClicksRequired = Math.round(finalClicksRequired * 1.1);
      finalAttackDamage = Math.round(finalAttackDamage * 1.1);
    }

    // Apply forced buffs from challenge config (with buff strength multiplier)
    if (challengeConfig.forceShield) {
      const baseShieldHP = Math.floor(finalClicksRequired * 0.3); // 30% of monster HP
      const shieldHP = Math.floor(baseShieldHP * challengeConfig.buffStrength);
      buffs.push({ type: 'shield', value: shieldHP });
    }

    if (challengeConfig.forceSpeed) {
      const baseTimer = 30; // 30 second base timer (will be modified by escapeTimerSpeed later)
      buffs.push({ type: 'fast', value: baseTimer });
    }

    // Apply buff strength multiplier to existing shield buffs
    if (challengeConfig.buffStrength > 1.0) {
      buffs.forEach(buff => {
        if (buff.type === 'shield') {
          const oldValue = buff.value;
          buff.value = Math.floor(buff.value * challengeConfig.buffStrength);
        }
      });
    }

    // Apply escape timer speed to existing fast buffs (with 10 second minimum)
    if (challengeConfig.escapeTimerSpeed > 1.0) {
      buffs.forEach(buff => {
        if (buff.type === 'fast') {
          const oldValue = buff.value;
          const calculatedTimer = Math.floor(buff.value / challengeConfig.escapeTimerSpeed);
          buff.value = Math.max(10, calculatedTimer); // Minimum 10 seconds
        }
      });
    }

    // Apply DoT intensity multiplier to monster DoT effects
    let modifiedDotEffect = monsterTemplate.dotEffect;
    if (modifiedDotEffect && challengeConfig.dotIntensity > 1.0) {
      modifiedDotEffect = {
        ...modifiedDotEffect,
        damageAmount: modifiedDotEffect.damageAmount * challengeConfig.dotIntensity
      };
    }

    // Override corruption rate if challenge config forces it
    let finalIsCorrupted = isCorrupted;
    let hasEnrageBuff = false;
    if (challengeConfig.corruptionRate > 0) {
      const forcedCorruption = Math.random() < challengeConfig.corruptionRate;
      if (forcedCorruption && !isCorrupted) {
        // Force corruption via challenge mode
        finalIsCorrupted = true;
        finalClicksRequired = Math.round(finalClicksRequired * 1.5); // +50% HP
        finalAttackDamage = Math.round(finalAttackDamage * 1.25); // +25% damage
        // Add enrage buff (+20% damage) for forced corruption
        hasEnrageBuff = true;
        finalAttackDamage = Math.round(finalAttackDamage * 1.2); // +20% enrage
      }
    }

    // Apply tier scaling and boss attack speed multiplier to special attacks
    let modifiedSpecialAttacks = monsterTemplate.specialAttacks?.filter(
      attack => !attack.minTier || tier >= attack.minTier
    );
    if (modifiedSpecialAttacks) {
      modifiedSpecialAttacks = modifiedSpecialAttacks.map(attack => {
        const scaledAttack = { ...attack };

        // Apply lenient tier scaling to damage (1x, 1.5x, 2x, 3x, 4x - less aggressive than regular damage)
        if (scaledAttack.damage !== undefined) {
          const baseDamage = scaledAttack.damage;
          scaledAttack.damage = applyTierSpecialAttackScaling(baseDamage, tier);
        }

        // Apply lenient tier scaling to healing (same as special attack damage scaling)
        if (scaledAttack.healing !== undefined) {
          const baseHealing = scaledAttack.healing;
          scaledAttack.healing = applyTierSpecialAttackScaling(baseHealing, tier);
        }

        // NOTE: Summon attack damage is NOT scaled here - it's scaled in useSummonedCreatures.ts on the frontend

        return scaledAttack;
      });

    }

    // Apply tier scaling to boss phase special attacks
    let modifiedBossPhases = monsterTemplate.bossPhases;
    if (modifiedBossPhases) {
      modifiedBossPhases = modifiedBossPhases.map(phase => {
        const scaledPhase = { ...phase };

        if (scaledPhase.specialAttacks) {
          scaledPhase.specialAttacks = scaledPhase.specialAttacks.map(attack => {
            const scaledAttack = { ...attack };

            // Apply lenient tier scaling to damage (1x, 1.5x, 2x, 3x, 4x)
            if (scaledAttack.damage !== undefined) {
              const baseDamage = scaledAttack.damage;
              scaledAttack.damage = applyTierSpecialAttackScaling(baseDamage, tier);
            }

            // Apply lenient tier scaling to healing
            if (scaledAttack.healing !== undefined) {
              const baseHealing = scaledAttack.healing;
              scaledAttack.healing = applyTierSpecialAttackScaling(baseHealing, tier);
            }

            // NOTE: Summon attack damage is NOT scaled here - it's scaled in useSummonedCreatures.ts on the frontend

            return scaledAttack;
          });
        }

        return scaledPhase;
      });
    }

    const newMonster = {
      templateName: monsterTemplate.name,
      name: monsterTemplate.name,
      imageUrl: monsterTemplate.imageUrl,
      clicksRequired: finalClicksRequired,
      attackDamage: finalAttackDamage,
      rarity: monsterTemplate.rarity,
      biome,
      tier,
      moveInterval: monsterTemplate.moveInterval, // Monster movement speed (700-3000ms)
      isBoss: monsterTemplate.isBoss, // Mark boss monsters (enables phase system)
      isCorrupted: finalIsCorrupted, // Mark corrupted monsters (drops empowered items) - includes forced corruption
      dotEffect: modifiedDotEffect, // Pass DoT effect to frontend (with challenge intensity applied)
      buffs, // Add monster buffs (initial + random, they stack!)
      specialAttacks: modifiedSpecialAttacks, // Boss special attacks (with tier scaling and challenge cooldown applied)
      bossPhases: modifiedBossPhases, // Boss phase system (with tier-scaled special attacks)
      createdAt: new Date()
    };

    // Create new battle session with biome/tier tracking
    const now = new Date();
    const newSession = {
      userId,
      biome,
      tier,
      monsterTemplateName: monsterTemplate.name,
      monster: newMonster,
      clickCount: 0,
      isDefeated: false,
      usedItems: {},
      startedAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
    };

    const sessionResult = await battleSessionsCollection.insertOne(newSession);

    res.json({
      session: {
        ...newSession,
        _id: sessionResult.insertedId.toString(),
        expiresAt: newSession.expiresAt
      },
      monster: {
        ...newMonster,
        _id: sessionResult.insertedId.toString()
      },
      isNewSession: true
    });
    return;

  } catch (error) {
    console.error('Start battle error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Records the actualBattleStartedAt timestamp when the user clicks "Start Battle"
// (used for accurate HP verification, excludes time spent looking at the start screen).
battleRouter.post('/start-battle-timer', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Parse request body
    const body = req.body;
    const { sessionId } = body;

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    // Convert sessionId to ObjectId
    let sessionObjectId: ObjectId;
    try {
      sessionObjectId = new ObjectId(sessionId);
    } catch {
      res.status(400).json({ error: 'Invalid sessionId format' });
      return;
    }

    // Connect to MongoDB
    const { battleSessionsCollection } = await connectToMongo();

    // Find the session and verify it belongs to this user
    const session = await battleSessionsCollection.findOne({
      _id: sessionObjectId,
      userId
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Update the actualBattleStartedAt timestamp
    const actualBattleStartedAt = new Date();
    await battleSessionsCollection.updateOne(
      { _id: sessionObjectId },
      { $set: { actualBattleStartedAt } }
    );

    res.json({ success: true, actualBattleStartedAt });
    return;
  } catch (error) {
    console.error('Error starting battle timer:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Submit battle completion: anti-cheat verification (click rate, HP, damage ceiling),
// XP/coin/loot rewards, biome unlock progression.
battleRouter.post('/attack-monster', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Get request body
    const body = req.body;
    const { sessionId, clickCount, totalDamage, usedItems, currentShieldHP, damageReductionPercent, actualHealing, invulnerabilityTimeMs, summonDamage, thornsDamage, stunTimeMs, skillshotBonusDamage } = body;

    // Validate input
    if (!sessionId || typeof clickCount !== 'number' || typeof totalDamage !== 'number') {
      res.status(400).json({ error: 'Invalid request data' });
      return;
    }

    // Extract buff protection values (defaults to 0 if not provided)
    const shieldHP = typeof currentShieldHP === 'number' ? currentShieldHP : 0;
    const damageReduction = typeof damageReductionPercent === 'number' ? damageReductionPercent : 0;
    const reportedHealing = typeof actualHealing === 'number' ? actualHealing : 0;
    const invulnerabilityMs = typeof invulnerabilityTimeMs === 'number' ? invulnerabilityTimeMs : 0;
    const reportedSummonDamage = typeof summonDamage === 'number' ? summonDamage : 0;
    const reportedThornsDamage = typeof thornsDamage === 'number' ? thornsDamage : 0;

    // Convert sessionId string to ObjectId
    let sessionObjectId: ObjectId;
    try {
      sessionObjectId = new ObjectId(sessionId);
    } catch (error) {
      res.status(400).json({ error: 'Invalid session ID format' });
      return;
    }

    // Connect to MongoDB and get collections
    const { battleSessionsCollection, battleHistoryCollection, playerStatsCollection, userInventoryCollection } = await connectToMongo();

    // Get the battle session
    const session = await battleSessionsCollection.findOne({ _id: sessionObjectId, userId });

    if (!session) {
      res.status(404).json({ error: 'Battle session not found' });
      return;
    }

    // Check if session is already completed
    if (session.isDefeated || session.completedAt) {
      res.status(400).json({ error: 'Battle session already completed' });
      return;
    }

    const monster = session.monster;

    // Ensure we have a battle start timestamp that excludes time spent on the start screen.
    // If missing (older sessions or consecutive "Next Monster" fights), fall back to the
    // session's creation time so anti-cheat/HP verification doesn't falsely count long idle time.
    let actualBattleStartedAt: Date;
    if (session.actualBattleStartedAt) {
      actualBattleStartedAt = new Date(session.actualBattleStartedAt);
    } else {
      // Battle timer wasn't recorded (e.g. consecutive "Next Monster" fights skip the Start Battle
      // screen). Fall back to the session's creation time — NOT now, which made every such fight
      // measure as ~0s and floor to the 1s minimum, skewing all time-based anti-cheat.
      actualBattleStartedAt = session.startedAt ? new Date(session.startedAt) : new Date();
    }

    // Calculate time elapsed from server-side actualBattleStartedAt (or startedAt as fallback)
    // actualBattleStartedAt is set when user clicks "Start Battle" button
    // This prevents client-side time manipulation and excludes time spent on start screen
    const currentTime = Date.now();
    const startTime = actualBattleStartedAt.getTime();
    const timeElapsedRaw = currentTime - startTime;
    const timeElapsedMs = Math.max(MIN_BATTLE_DURATION_MS_FOR_VALIDATION, timeElapsedRaw);
    const timeInSeconds = timeElapsedMs / 1000;

    // Calculate manual click rate (manual clicks per second)
    const clickRate = clickCount / timeInSeconds;

    // HP VERIFICATION: Check if player should have survived
    // Get player stats to check max HP
    const playerStats = await playerStatsCollection.findOne({ userId });

    if (!playerStats) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    // Fetch equipped items to calculate equipment bonuses (use new equippedItems format)
    const equippedWeaponDoc = playerStats.equippedItems?.weapon
      ? await userInventoryCollection.findOne({ _id: new ObjectId(playerStats.equippedItems.weapon) })
      : null;
    const equippedArmorDoc = playerStats.equippedItems?.armor
      ? await userInventoryCollection.findOne({ _id: new ObjectId(playerStats.equippedItems.armor) })
      : null;
    const equippedAccessory1Doc = playerStats.equippedItems?.accessory1
      ? await userInventoryCollection.findOne({ _id: new ObjectId(playerStats.equippedItems.accessory1) })
      : null;
    const equippedAccessory2Doc = playerStats.equippedItems?.accessory2
      ? await userInventoryCollection.findOne({ _id: new ObjectId(playerStats.equippedItems.accessory2) })
      : null;

    // Convert to EquippedItem format for calculateTotalEquipmentStats
    const equippedWeapon: EquippedItem | null = equippedWeaponDoc
      ? {
          inventoryId: equippedWeaponDoc._id.toString(),
          lootTableId: equippedWeaponDoc.lootTableId,
          tier: equippedWeaponDoc.tier || 1,
          slot: 'weapon',
          lootItem: getLootItemById(equippedWeaponDoc.lootTableId)!,
          crafted: equippedWeaponDoc.crafted,
          statRoll: equippedWeaponDoc.statRoll,
          isEmpowered: equippedWeaponDoc.isEmpowered,
          prefix: equippedWeaponDoc.prefix,
          suffix: equippedWeaponDoc.suffix
        }
      : null;

    const equippedArmor: EquippedItem | null = equippedArmorDoc
      ? {
          inventoryId: equippedArmorDoc._id.toString(),
          lootTableId: equippedArmorDoc.lootTableId,
          tier: equippedArmorDoc.tier || 1,
          slot: 'armor',
          lootItem: getLootItemById(equippedArmorDoc.lootTableId)!,
          crafted: equippedArmorDoc.crafted,
          statRoll: equippedArmorDoc.statRoll,
          isEmpowered: equippedArmorDoc.isEmpowered,
          prefix: equippedArmorDoc.prefix,
          suffix: equippedArmorDoc.suffix
        }
      : null;

    const equippedAccessory1: EquippedItem | null = equippedAccessory1Doc
      ? {
          inventoryId: equippedAccessory1Doc._id.toString(),
          lootTableId: equippedAccessory1Doc.lootTableId,
          tier: equippedAccessory1Doc.tier || 1,
          slot: 'accessory1',
          lootItem: getLootItemById(equippedAccessory1Doc.lootTableId)!,
          crafted: equippedAccessory1Doc.crafted,
          statRoll: equippedAccessory1Doc.statRoll,
          isEmpowered: equippedAccessory1Doc.isEmpowered,
          prefix: equippedAccessory1Doc.prefix,
          suffix: equippedAccessory1Doc.suffix
        }
      : null;

    const equippedAccessory2: EquippedItem | null = equippedAccessory2Doc
      ? {
          inventoryId: equippedAccessory2Doc._id.toString(),
          lootTableId: equippedAccessory2Doc.lootTableId,
          tier: equippedAccessory2Doc.tier || 1,
          slot: 'accessory2',
          lootItem: getLootItemById(equippedAccessory2Doc.lootTableId)!,
          crafted: equippedAccessory2Doc.crafted,
          statRoll: equippedAccessory2Doc.statRoll,
          isEmpowered: equippedAccessory2Doc.isEmpowered,
          prefix: equippedAccessory2Doc.prefix,
          suffix: equippedAccessory2Doc.suffix
        }
      : null;

    // Calculate total equipment stats including maxHpBonus
    const equipmentStats = calculateTotalEquipmentStats(
      equippedWeapon,
      equippedArmor,
      equippedAccessory1,
      equippedAccessory2
    );

    // Calculate expected damage from monster (accounting for armor, attack speed, buffs, invulnerability, summons)
    // Step 1: Calculate reduced damage per hit from armor (for MONSTER damage only)
    const damagePerHit = calculateMonsterDamage(monster.attackDamage, equipmentStats.defense);

    // Step 2: Calculate attack interval with speed bonuses (slower = less attacks per second)
    const attackInterval = calculateMonsterAttackInterval(1000, equipmentStats.attackSpeed);

    // Step 3: Calculate active attack time (total time - invulnerability time - stun time)
    const totalTimeMs = timeInSeconds * 1000;
    const reportedStunTimeMs = stunTimeMs || 0;
    const activeAttackTimeMs = Math.max(0, totalTimeMs - invulnerabilityMs - reportedStunTimeMs);

    // Step 4: Calculate number of attacks that would have occurred (during active time only)
    const numberOfAttacks = Math.floor(activeAttackTimeMs / attackInterval);

    // Step 5: Calculate monster damage (reduced by armor)
    let monsterDamage = numberOfAttacks * damagePerHit;

    // Step 6: Add summon damage (NOT reduced by armor)
    let totalBaseDamage = monsterDamage + reportedSummonDamage;

    // Step 7: Apply damage reduction buff (if active)
    let expectedDamage = totalBaseDamage;
    if (damageReduction > 0) {
      const reductionMultiplier = 1 - Math.min(100, damageReduction) / 100;
      expectedDamage = Math.floor(expectedDamage * reductionMultiplier);
    }

    // Step 8: Apply shield absorption
    const damageAfterShield = Math.max(0, expectedDamage - shieldHP);

    // Calculate actual reduction percentage for logging (using same formula as calculateMonsterDamage)
    const K = 67;
    const MAX_REDUCTION = 80;
    const actualReductionPercent = Math.round((equipmentStats.defense / (equipmentStats.defense + K)) * MAX_REDUCTION * 10) / 10;

    // Use damage after all protections for HP calculation
    expectedDamage = damageAfterShield;

    // Use actual healing reported from frontend (includes consumables, spells, lifesteal)
    // Frontend tracks all healing as it happens, which is more accurate than estimating
    const totalHealing = reportedHealing;

    const usedItemsCounts: Record<string, number> = (usedItems && typeof usedItems === 'object' && !Array.isArray(usedItems)) ? usedItems : {};

    // Calculate expected HP after battle (including equipment max HP bonuses)
    const totalMaxHP = playerStats.maxHealth + equipmentStats.maxHpBonus;
    const expectedHP = totalMaxHP - expectedDamage + totalHealing;

    // [HIGH-1 OBSERVE] Observe-only. Survival is enforced by the HP check below; this ratio isn't
    // used for blocking since the server can't model DoT/boss-specials/corruption client-side.
    const rawWindowAttacks = Math.floor(totalTimeMs / attackInterval);
    const rawDamageNoMitigation = rawWindowAttacks * damagePerHit;
    const rawDamageRatio = totalMaxHP > 0 ? rawDamageNoMitigation / totalMaxHP : 0;
    console.log(
      `[HIGH-1 OBSERVE] user=${userId} monster="${monster.name}" rarity=${monster.rarity} boss=${monster.isBoss === true} ` +
      `biome=${session.biome} tier=${session.tier} time=${timeInSeconds.toFixed(2)}s ` +
      `rawDamage=${rawDamageNoMitigation} maxHP=${totalMaxHP} ratio=${rawDamageRatio.toFixed(2)} | ` +
      `claimed: healing=${totalHealing} invulnMs=${invulnerabilityMs} stunMs=${reportedStunTimeMs} ` +
      `reductionPct=${damageReduction} shieldHP=${shieldHP} summonDmg=${reportedSummonDamage}`
    );

    // [HIGH-1 DMG-ENFORCE] Enforced upper bound on damage output: rate-capped clicks (manual + auto)
    // × all-crit per-click max (no consumable/spell buffs), ×DMG_CEILING_TOLERANCE to allow for those
    // buffs. Blocks impossible damage claims.
    const dmgTotalCritChanceNoBuff = 5 + equipmentStats.critChance; // 5 = client baseCritChance
    const dmgCritMultiplierNoBuff = 2.0 + Math.max(0, dmgTotalCritChanceNoBuff - 100) / 100;
    const dmgMaxPerClickNoBuff = Math.floor((playerStats.baseDamage + equipmentStats.damageBonus) * dmgCritMultiplierNoBuff);
    const dmgMaxManualClicks = Math.ceil(timeInSeconds * MAX_CLICKS_PER_SECOND * 1.2); // same tolerance as the click-rate check
    const dmgExpectedAutoHits = Math.floor(timeInSeconds * (equipmentStats.autoClickRate || 0));
    const dmgReportedSkillshot = typeof skillshotBonusDamage === 'number' ? skillshotBonusDamage : 0;
    const dmgMaxPlausibleNoBuff = (dmgMaxManualClicks + dmgExpectedAutoHits) * dmgMaxPerClickNoBuff;
    const dmgRatio = dmgMaxPlausibleNoBuff > 0 ? totalDamage / dmgMaxPlausibleNoBuff : 0;
    console.log(
      `[HIGH-1 DMG-ENFORCE] user=${userId} monster="${monster.name}" rarity=${monster.rarity} boss=${monster.isBoss === true} ` +
      `time=${timeInSeconds.toFixed(2)}s totalDamage=${totalDamage} maxNoBuff=${dmgMaxPlausibleNoBuff} ratio=${dmgRatio.toFixed(2)} | ` +
      `perClickNoBuffMax=${dmgMaxPerClickNoBuff} maxManualClicks=${dmgMaxManualClicks} autoHits=${dmgExpectedAutoHits} skillshotBonus=${dmgReportedSkillshot}`
    );

    if (dmgMaxPlausibleNoBuff > 0 && totalDamage > dmgMaxPlausibleNoBuff * DMG_CEILING_TOLERANCE) {
      console.warn(`⚠️ Damage cheat: user ${userId} totalDamage=${totalDamage} exceeds ceiling ${dmgMaxPlausibleNoBuff}×${DMG_CEILING_TOLERANCE}`);
      const newClicksRequired = monster.clicksRequired * 2;
      res.status(200).json({
        cheatingDetected: true,
        message: 'That was more damage than possible for this battle.',
        newClicksRequired,
        clickRate: clickRate.toFixed(2)
      });
      return;
    }

    // Apply 20% tolerance to account for state update timing issues
    // Player is considered dead only if expectedHP < -(totalMaxHP * 0.20)
    // This allows minor discrepancies in close fights due to heal state updates
    const hpTolerance = Math.floor(totalMaxHP * 0.20);
    const hpThreshold = -hpTolerance;

    // If player should have died (beyond tolerance), they're cheating
    if (expectedHP < hpThreshold) {
      console.warn(`⚠️ HP cheat detected! User ${userId} should have died but claims to have survived.`);
      console.warn(`   Expected HP: ${expectedHP} (below threshold: ${hpThreshold} with 20% tolerance)`);
      console.warn(`   Total Max HP: ${totalMaxHP} (base: ${playerStats.maxHealth} + equipment: ${equipmentStats.maxHpBonus})`);
      console.warn(`   Total time: ${(totalTimeMs / 1000).toFixed(2)}s`);
      console.warn(`   Invulnerable: ${invulnerabilityMs}ms, Stunned monster: ${reportedStunTimeMs}ms`);
      console.warn(`   Active time: ${(activeAttackTimeMs / 1000).toFixed(2)}s (after subtracting inactive periods)`);
      console.warn(`   Defense: ${equipmentStats.defense} (→ ${actualReductionPercent}% damage reduction)`);
      console.warn(`   Monster damage: ${numberOfAttacks} attacks × ${damagePerHit} dmg/hit = ${monsterDamage}`);
      console.warn(`   Summon damage: ${reportedSummonDamage} (not reduced by defense)`);
      console.warn(`   Total damage: ${expectedDamage} (after ${shieldHP} shield, ${damageReduction}% reduction buff)`);
      console.warn(`   Healing used: ${totalHealing} (includes defensive lifesteal)`);
      if (reportedThornsDamage > 0) {
        console.warn(`   Thorns damage dealt to monster: ${reportedThornsDamage}`);
      }
      if (skillshotBonusDamage > 0) {
        console.warn(`   Skillshot bonus damage: ${skillshotBonusDamage} (extra player damage, doesn't affect HP calc)`);
      }

      // End the battle session (mark as defeated, no loot)
      const now = new Date();
      await battleSessionsCollection.updateOne(
        { _id: sessionObjectId },
        {
          $set: {
            isDefeated: true,
            completedAt: now
            // No lootOptions - cheater gets nothing
          }
        }
      );

      await battleHistoryCollection.updateOne(
        { sessionId: sessionObjectId },
        {
          $setOnInsert: {
            userId,
            sessionId: sessionObjectId,
            monsterTemplateName: session.monsterTemplateName,
            createdAt: now
          },
          $set: {
            completedAt: now
          }
        },
        { upsert: true }
      );

      // Deduct gold as penalty (10% like death)
      const goldLossPercentage = 0.10;
      const goldLost = Math.round(playerStats.coins * goldLossPercentage);
      if (goldLost > 0) {
        await playerStatsCollection.updateOne(
          { userId },
          { $inc: { coins: -Math.min(goldLost, playerStats.coins) } }
        );
      }

      // Reset win streak for this zone
      const currentBiome = session.biome;
      const currentTier = session.tier;
      const streakBeforeReset = getStreakForZone(playerStats.stats.battlesWonStreaks, currentBiome, currentTier);

      // Reset the specific zone's streak
      const updatedStreaks = resetStreakForZone(playerStats.stats.battlesWonStreaks, currentBiome, currentTier);

      await playerStatsCollection.updateOne(
        { userId },
        {
          $set: {
            'stats.battlesWonStreak': 0, // Keep legacy field synced
            'stats.battlesWonStreaks': updatedStreaks
          }
        }
      );

      res.status(200).json({
        hpCheatDetected: true,
        message: 'You should have been defeated by the monster!\n\nYour battle session has been ended.',
        expectedDamage,
        totalHealing,
        expectedHP,
        goldLost,
        streakLost: streakBeforeReset
      });
      return; // Return 200 so frontend handles it properly
    }

    // Phase 2.5: Calculate expected auto-clicks
    // Frontend doesn't increment clickCount for auto-hits, so clickCount = manual clicks only
    const expectedAutoClicks = Math.floor(timeInSeconds * equipmentStats.autoClickRate);

    // CHEAT DETECTION: Check total click potential (manual + auto) with 20% tolerance
    // Max allowed manual clicks in this time
    const maxManualClicks = Math.ceil(timeInSeconds * MAX_CLICKS_PER_SECOND * 1.2); // 20% tolerance
    // Total click potential = manual clicks + expected auto-clicks
    const totalClickPotential = clickCount + expectedAutoClicks;
    // Max allowed total = max manual + expected auto (both with tolerance baked in)
    const maxAllowedTotal = maxManualClicks + expectedAutoClicks;

    if (totalClickPotential > maxAllowedTotal) {
      const manualClickRate = clickCount / timeInSeconds;
      console.warn(`⚠️ Cheat detected! User ${userId} exceeded max click potential: ${totalClickPotential} > ${maxAllowedTotal}`);
      console.warn(`   Manual: ${clickCount} (${manualClickRate.toFixed(2)}/sec), Auto: ${expectedAutoClicks} (${equipmentStats.autoClickRate}/sec), Time: ${timeInSeconds.toFixed(2)}s`);

      const newClicksRequired = monster.clicksRequired * 2;

      // Return cheat detection response
      res.status(200).json({
        cheatingDetected: true,
        message: 'That was quite fast for a human, are you cheating?',
        newClicksRequired,
        clickRate: (totalClickPotential / timeInSeconds).toFixed(2)
      });
      return;
    }

    // Extra guard: manual click rate alone (independent of auto-clicks)
    // Use same 20% tolerance as above.
    if (clickRate > MAX_CLICKS_PER_SECOND * 1.2) {
      console.warn(`⚠️ Cheat detected! User ${userId} exceeded max manual click rate: ${clickRate.toFixed(2)} > ${(MAX_CLICKS_PER_SECOND * 1.2).toFixed(2)} clicks/sec`);

      const newClicksRequired = monster.clicksRequired * 2;
      res.status(200).json({
        cheatingDetected: true,
        message: 'That was quite fast for a human, are you cheating?',
        newClicksRequired,
        clickRate: clickRate.toFixed(2)
      });
      return;
    }

    // Validate that damage is sufficient to defeat monster
    // NOTE: For bosses with healing/phases, damage may vary from clicksRequired
    // The frontend validates boss defeat via phase system before calling this API
    const isBossMonster = monster.isBoss === true;

    if (!isBossMonster && totalDamage < monster.clicksRequired) {
      res.status(400).json({ error: 'Insufficient damage to defeat monster' });
      return;
    }

    // Atomically claim completion so concurrent duplicate submissions can't both reward.
    const completionClaim = await battleSessionsCollection.findOneAndUpdate(
      { _id: sessionObjectId, userId, isDefeated: false, completedAt: { $exists: false }, completionClaimedAt: { $exists: false } },
      { $set: { completionClaimedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!completionClaim) {
      res.status(400).json({ error: 'Battle session already completed' });
      return;
    }

    // Generate random loot drops (5 items) with streak multiplier
    // Get current streak for this specific zone
    const currentBiome = session.biome;
    const currentTier = session.tier;
    const winStreak = getStreakForZone(playerStats.stats.battlesWonStreaks, currentBiome, currentTier);
    const streakMultiplier = (1.0 + Math.min(winStreak * 0.03, 0.30)).toFixed(2);

    // Calculate Challenge Mode reward bonuses (Phase 3.3)
    const challengeConfig = playerStats.battleChallengeConfig || {
      forceShield: false,
      forceSpeed: false,
      damageMultiplier: 1.0,
      hpMultiplier: 1.0,
      dotIntensity: 1.0,
      corruptionRate: 0,
      escapeTimerSpeed: 1.0,
      buffStrength: 1.0,
      bossSpawnRate: 1.0
    };

    let extraLootCards = 0;
    let challengeXPMultiplier = 1.0;

    // Toggle bonuses
    if (challengeConfig.forceShield) {
      extraLootCards += 1;
    }
    if (challengeConfig.forceSpeed) {
      extraLootCards += 1;
    }

    // Max slider bonuses (+1 loot card for the 3 hardest settings)
    if (challengeConfig.damageMultiplier === 3.0) {
      extraLootCards += 1;
    }
    if (challengeConfig.escapeTimerSpeed === 4.0) {
      extraLootCards += 1;
    }
    if (challengeConfig.buffStrength === 5.0) {
      extraLootCards += 1;
    }

    // Damage multiplier bonus (+25% per step)
    if (challengeConfig.damageMultiplier > 1.0) {
      const damageSteps = Math.log(challengeConfig.damageMultiplier) / Math.log(1.25);
      challengeXPMultiplier += damageSteps * 0.25;
    }

    // HP multiplier bonus (+50% per step)
    if (challengeConfig.hpMultiplier > 1.0) {
      const hpSteps = Math.log(challengeConfig.hpMultiplier) / Math.log(1.5);
      challengeXPMultiplier += hpSteps * 0.50;
    }

    // DoT intensity bonus (+30% per step)
    if (challengeConfig.dotIntensity > 1.0) {
      const dotSteps = Math.log(challengeConfig.dotIntensity) / Math.log(1.5);
      challengeXPMultiplier += dotSteps * 0.30;
    }

    // Corruption rate bonus (+60% at 100%)
    if (challengeConfig.corruptionRate > 0) {
      challengeXPMultiplier += challengeConfig.corruptionRate * 0.60;
    }

    // Escape timer speed bonus (+40% per step, minimum 10s enforced)
    if (challengeConfig.escapeTimerSpeed > 1.0) {
      const escapeSteps = Math.log(challengeConfig.escapeTimerSpeed) / Math.log(1.5);
      challengeXPMultiplier += escapeSteps * 0.40;
    }

    // Buff strength bonus (+35% per step)
    if (challengeConfig.buffStrength > 1.0) {
      const buffSteps = Math.log(challengeConfig.buffStrength) / Math.log(1.5);
      challengeXPMultiplier += buffSteps * 0.35;
    }

    // Boss spawn rate penalty (-3 loot cards)
    if (challengeConfig.bossSpawnRate === 5.0) {
      extraLootCards -= 4;
    }

    const totalLootCards = Math.max(1, 5 + extraLootCards); // Ensure at least 1 loot card

    const lootOptions = getRandomLoot(monster.name, totalLootCards, winStreak);
    const lootOptionIds = lootOptions.map(l => l.lootId);

    // Mark session as completed and save loot options (user hasn't selected yet)
    const now = new Date();
    await battleSessionsCollection.updateOne(
      { _id: sessionObjectId },
      {
        $set: {
          clickCount,
          isDefeated: true,
          completedAt: now,
          lootOptions: lootOptionIds, // Save the loot option IDs
          usedItems: usedItemsCounts // Save the items used during battle
        }
      }
    );

    await battleHistoryCollection.updateOne(
      { sessionId: sessionObjectId },
      {
        $setOnInsert: {
          userId,
          sessionId: sessionObjectId,
          monsterTemplateName: session.monsterTemplateName,
          createdAt: now
        },
        $set: {
          completedAt: now
        }
      },
      { upsert: true }
    );

    // BIOME UNLOCK PROGRESSION: Unlock next biome/tier after victory
    // Requires EITHER:
    // - 10 win streak in current zone/tier, OR
    // - Killing an epic mini-boss (rarity === 'epic' && isBoss === true)
    const nextUnlock = getNextUnlock(currentBiome, currentTier);
    let unlockReason: string | null = null;

    // Check unlock conditions
    const has10WinStreak = winStreak >= 9; // Will be 10 after this victory
    const killedEpicBoss = monster.rarity === 'epic' && monster.isBoss === true;
    const canUnlock = has10WinStreak || killedEpicBoss;

    if (nextUnlock && canUnlock) {
      const nextBiomeTierKey = formatBiomeTierKey(nextUnlock.biome, nextUnlock.tier);

      // Check if player already has this biome/tier unlocked
      if (!playerStats.unlockedZones.includes(nextBiomeTierKey)) {
        // Unlock it!
        await playerStatsCollection.updateOne(
          { userId },
          {
            $addToSet: {
              unlockedZones: nextBiomeTierKey // $addToSet prevents duplicates
            }
          }
        );

        // Set unlock reason for UI feedback
        if (killedEpicBoss) {
          unlockReason = 'epic_boss';
        } else {
          unlockReason = '10_streak';
        }
      }
    }

    // REWARD PLAYER: Award XP and coins based on monster rarity
    const baseRewards = getMonsterRewards(monster.rarity);

    // Apply streak multiplier to rewards (higher streaks = more rewards)
    // Use the per-zone streak we already calculated above
    const rewardStreakMultiplier = getStreakRewardMultiplier(winStreak);

    // Apply tier multiplier to rewards (higher tiers = MUCH more rewards)
    const tierXPMultiplier = getTierRewardMultiplier(currentTier); // Full multiplier for XP
    const tierCoinMultiplier = getTierCoinMultiplier(currentTier); // Nerfed multiplier for coins

    // Boss spawn rate penalty to coins (5x bosses = 50% coin reduction)
    let bossSpawnCoinPenalty = 1.0;
    let bossSpawnXPPenalty = 1.0;
    if (challengeConfig.bossSpawnRate === 5.0) {
      bossSpawnCoinPenalty = 0.5; // 50% reduction
      bossSpawnXPPenalty = 0.5; // 50% reduction
    }

    // XP multiplier (streak * tier * challenge)
    const totalXPMultiplier = rewardStreakMultiplier * tierXPMultiplier * challengeXPMultiplier * bossSpawnXPPenalty;

    // Coin multiplier (streak * nerfed_tier * challenge * boss_penalty)
    const totalCoinMultiplier = rewardStreakMultiplier * tierCoinMultiplier * challengeXPMultiplier * bossSpawnCoinPenalty;

    const rewards = {
      xp: Math.ceil(baseRewards.xp * totalXPMultiplier),
      coins: Math.ceil(baseRewards.coins * totalCoinMultiplier)
    };

    // Calculate new XP (used for level-up check)
    const newXP = playerStats.experience + rewards.xp;

    // Check for level up
    const levelUpResult = checkLevelUp(playerStats.level, newXP);

    if (levelUpResult.leveledUp) {

      const newMaxHealth = playerStats.maxHealth + levelUpResult.statIncreases.maxHealth;
      const totalMaxHP = newMaxHealth + equipmentStats.maxHpBonus;

    }

    const victoryUpdate = buildVictoryStatMutation({
      playerStats,
      rewards,
      levelUp: {
        leveledUp: levelUpResult.leveledUp,
        newLevel: levelUpResult.newLevel,
        statIncreases: levelUpResult.statIncreases,
      },
      equipmentMaxHpBonus: equipmentStats.maxHpBonus,
      biome: currentBiome,
      tier: currentTier,
    });
    await playerStatsCollection.updateOne({ userId }, victoryUpdate);

    res.json({
      success: true,
      monster: {
        ...monster,
        _id: session._id?.toString()
      },
      session: {
        ...session,
        _id: session._id?.toString(),
        clickCount,
        isDefeated: true,
        completedAt: now
      },
      lootOptions, // Send the 5 full loot items for user to choose from
      rewards: {
        xp: rewards.xp,
        coins: rewards.coins
      },
      levelUp: levelUpResult.leveledUp ? {
        newLevel: levelUpResult.newLevel,
        previousLevel: levelUpResult.previousLevel,
        statIncreases: levelUpResult.statIncreases
      } : null,
      unlockReason, // 'epic_boss', '10_streak', or null
      stats: {
        timeElapsed: timeInSeconds.toFixed(2),
        clickRate: clickRate.toFixed(2)
      }
    });
    return;

  } catch (error) {
    console.error('Attack monster error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// End battle on player death or monster escape: server-authoritative penalty
// (10% gold loss) + per-zone streak reset, applied atomically.
//
// `outcome` is optional and defaults to 'defeated' so the existing client
// (which posts only { sessionId }) keeps working; both outcomes apply the same
// penalty and differ only in the recorded battle-history label.
battleRouter.post('/end-battle', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    const { sessionId, outcome = 'defeated' } = req.body;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }
    if (outcome !== 'defeated' && outcome !== 'escaped') {
      res.status(400).json({ error: "outcome, if provided, must be 'defeated' or 'escaped'" });
      return;
    }

    let sessionObjectId: ObjectId;
    try {
      sessionObjectId = new ObjectId(sessionId);
    } catch {
      res.status(400).json({ error: 'Invalid sessionId format' });
      return;
    }

    const { battleSessionsCollection, battleHistoryCollection, playerStatsCollection } = await connectToMongo();
    const now = new Date();

    // Atomic claim: idempotent close, no double penalty on retry.
    // mongodb@6 returns the matched doc directly (no `{ value }` wrapper).
    const session = await battleSessionsCollection.findOneAndUpdate(
      { _id: sessionObjectId, userId, isDefeated: false, completedAt: { $exists: false }, completionClaimedAt: { $exists: false } },
      { $set: { isDefeated: true, completedAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) } },
      { returnDocument: 'before' }
    );

    if (!session) {
      // Null = already closed (retry) or not ours: 404 only if it truly doesn't exist.
      const existing = await battleSessionsCollection.findOne({ _id: sessionObjectId, userId });
      if (!existing) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json({ success: true, goldLost: 0, streakLost: 0, alreadyClosed: true });
      return;
    }

    await battleHistoryCollection.updateOne(
      { sessionId: sessionObjectId },
      {
        $setOnInsert: {
          userId,
          sessionId: sessionObjectId,
          monsterTemplateName: session.monsterTemplateName,
          createdAt: session.startedAt ? new Date(session.startedAt) : now,
        },
        $set: {
          completedAt: now,
          selectedLootId: outcome === 'escaped' ? 'ESCAPED' : 'DEFEATED',
        },
      },
      { upsert: true }
    );

    const playerStats = await playerStatsCollection.findOne({ userId });
    if (!playerStats) {
      res.status(404).json({ error: 'Player stats not found' });
      return;
    }

    const streakLost = getStreakForZone(playerStats.stats.battlesWonStreaks, session.biome, session.tier);
    const { goldLost, update } = buildDefeatStatMutation({
      coins: playerStats.coins,
      stats: { battlesWonStreaks: playerStats.stats.battlesWonStreaks },
      biome: session.biome,
      tier: session.tier,
    });

    await playerStatsCollection.updateOne({ userId }, update);

    res.json({ success: true, goldLost, streakLost });
    return;
  } catch (error) {
    console.error('End battle error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// User selects one of the 5 loot options after victory; adds it to the user's
// inventory WITHOUT creating an NFT yet (minting is a separate, user-initiated step).
battleRouter.post('/select-loot', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;

    // Get request body
    const body = req.body;
    const { sessionId, lootId } = body;

    // Validate input
    if (!sessionId) {
      res.status(400).json({ error: 'Invalid request data' });
      return;
    }

    // Check if user is skipping loot selection
    const isSkipping = lootId === 'SKIPPED' || lootId === null;

    if (!lootId && !isSkipping) {
      res.status(400).json({ error: 'Invalid request data' });
      return;
    }

    // Convert sessionId string to ObjectId
    let sessionObjectId: ObjectId;
    try {
      sessionObjectId = new ObjectId(sessionId);
    } catch (error) {
      res.status(400).json({ error: 'Invalid session ID format' });
      return;
    }

    // Connect to MongoDB and get collections
    const { battleSessionsCollection, battleHistoryCollection, userInventoryCollection } = await connectToMongo();

    // Get the battle session
    const session = await battleSessionsCollection.findOne({ _id: sessionObjectId, userId });

    if (!session) {
      res.status(404).json({ error: 'Battle session not found' });
      return;
    }

    // Validate session is defeated
    if (!session.isDefeated) {
      res.status(400).json({ error: 'Battle not yet completed' });
      return;
    }

    // Check if loot already selected
    if (session.selectedLootId) {
      res.status(400).json({ error: 'Loot already selected for this session' });
      return;
    }

    // Handle skip case
    if (isSkipping) {
      // Just mark the session as skipped, don't add to inventory
      await battleSessionsCollection.updateOne(
        { _id: sessionObjectId },
        {
          $set: {
            selectedLootId: 'SKIPPED'
          }
        }
      );

      await battleHistoryCollection.updateOne(
        { sessionId: sessionObjectId },
        {
          $setOnInsert: {
            userId,
            sessionId: sessionObjectId,
            monsterTemplateName: session.monsterTemplateName,
            createdAt: session.completedAt ? new Date(session.completedAt) : new Date()
          },
          $set: {
            selectedLootId: 'SKIPPED'
          }
        },
        { upsert: true }
      );

      res.json({
        success: true,
        selectedLootId: 'SKIPPED',
        skipped: true
      });
      return;
    }

    // Validate lootId is in the available options
    if (!session.lootOptions?.includes(lootId)) {
      res.status(400).json({ error: 'Invalid loot selection' });
      return;
    }

    // Get the loot item details from loot-table
    const lootItem = getLootItemById(lootId);
    if (!lootItem) {
      res.status(404).json({ error: 'Loot item not found in loot table' });
      return;
    }

    // Atomically claim the loot selection; only the first request proceeds to insert.
    const claim = await battleSessionsCollection.findOneAndUpdate(
      { _id: sessionObjectId, userId, isDefeated: true, selectedLootId: { $exists: false } },
      { $set: { selectedLootId: lootId } },
      { returnDocument: 'after' }
    );
    if (!claim) {
      res.status(409).json({ error: 'Loot already selected for this battle' });
      return;
    }

    await battleHistoryCollection.updateOne(
      { sessionId: sessionObjectId },
      {
        $setOnInsert: {
          userId,
          sessionId: sessionObjectId,
          monsterTemplateName: session.monsterTemplateName,
          createdAt: session.completedAt ? new Date(session.completedAt) : new Date()
        },
        $set: {
          selectedLootId: lootId
        }
      },
      { upsert: true }
    );

    const isEmpowered = session.monster?.isCorrupted === true;

    // Generate unique gradient colors from user's public key (userId)
    // The userId IS the public key in BSV
    const { color1, color2 } = publicKeyToGradient(userId);

    // Determine item tier based on type
    // ONLY spell scrolls are locked to Tier 1 (must be upgraded with duplicates)
    // All other items (equipment, materials, consumables) scale with zone tier
    const itemTier = lootItem.type === 'spell_scroll' ? 1 : session.tier;

    // Add item to user's inventory WITHOUT creating NFT yet
    // User will decide later if they want to mint it as an NFT (and pay for it)
    const inventoryResult = await userInventoryCollection.insertOne({
      userId,
      lootTableId: lootItem.lootId, // Reference to loot-table template
      itemType: lootItem.type,
      nftLootId: undefined, // Will be set when user mints the NFT
      tier: itemTier, // Spell scrolls always Tier 1, everything else scales with zone tier
      borderGradient: { color1, color2 }, // Store gradient here
      acquiredAt: new Date(),
      fromSessionId: sessionObjectId,
      isEmpowered, // Mark item as empowered if dropped by corrupted monster (+20% stats)
    });

    const tierInfo = lootItem.type === 'spell_scroll'
      ? ' (Tier 1 - requires upgrade)'
      : itemTier > 1
        ? ` (Tier ${itemTier})`
        : '';

    res.json({
      success: true,
      selectedLootId: lootId,
      inventoryItemId: inventoryResult.insertedId.toString()
    });
    return;

  } catch (error) {
    console.error('Select loot error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});
