import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo } from '@/lib/mongodb';
import { requireSession } from '@/lib/requireSession';
import { getRandomLoot, getLootItemById } from '@/lib/loot-table';
import { getNextUnlock, formatBiomeTierKey } from '@/lib/biome-config';
import { getMonsterRewards, checkLevelUp, getStreakRewardMultiplier, getTierRewardMultiplier, getTierCoinMultiplier } from '@/utils/playerProgression';
import { calculateTotalEquipmentStats, calculateMonsterDamage, calculateMonsterAttackInterval } from '@/utils/equipmentCalculations';
import { getStreakForZone, resetStreakForZone } from '@/utils/streakHelpers';
import type { EquippedItem } from '@/contexts/EquipmentContext';
import { ObjectId } from 'mongodb';
import { buildVictoryStatMutation } from '@/lib/battleOutcome';

const MAX_CLICKS_PER_SECOND = 20;
const MIN_BATTLE_DURATION_MS_FOR_VALIDATION = 1000;
const DMG_CEILING_TOLERANCE = 5; // block totalDamage above maxPlausible×this; generous (maxNoBuff excludes crit/damage buffs)

export async function POST(request: NextRequest) {
  try {
    const authSession = await requireSession();
    if (authSession instanceof NextResponse) return authSession;
    const userId = authSession.userId;

    // Get request body
    const body = await request.json();
    const { sessionId, clickCount, totalDamage, usedItems, currentShieldHP, damageReductionPercent, actualHealing, invulnerabilityTimeMs, summonDamage, thornsDamage, stunTimeMs, skillshotBonusDamage } = body;

    // Validate input
    if (!sessionId || typeof clickCount !== 'number' || typeof totalDamage !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Connect to MongoDB and get collections
    const { battleSessionsCollection, battleHistoryCollection, playerStatsCollection, userInventoryCollection } = await connectToMongo();

    // Get the battle session
    const session = await battleSessionsCollection.findOne({ _id: sessionObjectId, userId });

    if (!session) {
      return NextResponse.json(
        { error: 'Battle session not found' },
        { status: 404 }
      );
    }

    // Check if session is already completed
    if (session.isDefeated || session.completedAt) {
      return NextResponse.json(
        { error: 'Battle session already completed' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Player stats not found' },
        { status: 404 }
      );
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
      return NextResponse.json({
        cheatingDetected: true,
        message: 'That was more damage than possible for this battle.',
        newClicksRequired,
        clickRate: clickRate.toFixed(2)
      }, { status: 200 });
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

      return NextResponse.json({
        hpCheatDetected: true,
        message: 'You should have been defeated by the monster!\n\nYour battle session has been ended.',
        expectedDamage,
        totalHealing,
        expectedHP,
        goldLost,
        streakLost: streakBeforeReset
      }, { status: 200 }); // Return 200 so frontend handles it properly
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
      return NextResponse.json({
        cheatingDetected: true,
        message: 'That was quite fast for a human, are you cheating?',
        newClicksRequired,
        clickRate: (totalClickPotential / timeInSeconds).toFixed(2)
      }, { status: 200 });
    }

    // Extra guard: manual click rate alone (independent of auto-clicks)
    // Use same 20% tolerance as above.
    if (clickRate > MAX_CLICKS_PER_SECOND * 1.2) {
      console.warn(`⚠️ Cheat detected! User ${userId} exceeded max manual click rate: ${clickRate.toFixed(2)} > ${(MAX_CLICKS_PER_SECOND * 1.2).toFixed(2)} clicks/sec`);

      const newClicksRequired = monster.clicksRequired * 2;
      return NextResponse.json({
        cheatingDetected: true,
        message: 'That was quite fast for a human, are you cheating?',
        newClicksRequired,
        clickRate: clickRate.toFixed(2)
      }, { status: 200 });
    }

    // Validate that damage is sufficient to defeat monster
    // NOTE: For bosses with healing/phases, damage may vary from clicksRequired
    // The frontend validates boss defeat via phase system before calling this API
    const isBossMonster = monster.isBoss === true;

    if (!isBossMonster && totalDamage < monster.clicksRequired) {
      return NextResponse.json(
        { error: 'Insufficient damage to defeat monster' },
        { status: 400 }
      );
    }

    // Atomically claim completion so concurrent duplicate submissions can't both reward.
    const completionClaim = await battleSessionsCollection.findOneAndUpdate(
      { _id: sessionObjectId, userId, isDefeated: false, completedAt: { $exists: false }, completionClaimedAt: { $exists: false } },
      { $set: { completionClaimedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!completionClaim) {
      return NextResponse.json({ error: 'Battle session already completed' }, { status: 400 });
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

    return NextResponse.json({
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

  } catch (error) {
    console.error('Attack monster error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
