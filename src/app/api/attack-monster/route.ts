import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { getRandomLoot, getLootItemById } from '@/lib/loot-table';
import { getNextUnlock, formatBiomeTierKey } from '@/lib/biome-config';
import { getMonsterRewards, checkLevelUp, getStreakRewardMultiplier, getTierRewardMultiplier, getTierCoinMultiplier } from '@/utils/playerProgression';
import { calculateTotalEquipmentStats, calculateMonsterDamage, calculateMonsterAttackInterval } from '@/utils/equipmentCalculations';
import { getStreakForZone, resetStreakForZone } from '@/utils/streakHelpers';
import type { EquippedItem } from '@/contexts/EquipmentContext';
import { ObjectId } from 'mongodb';

const MAX_CLICKS_PER_SECOND = 15;

export async function POST(request: NextRequest) {
  try {
    // Get cookies using next/headers
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    // Get request body
    const body = await request.json();
    const { sessionId, clickCount, totalDamage, usedItems, currentShieldHP, damageReductionPercent, actualHealing, invulnerabilityTimeMs, summonDamage, thornsDamage } = body;

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
    const { battleSessionsCollection, monstersCollection, playerStatsCollection, userInventoryCollection } = await connectToMongo();

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

    // Get the monster
    const monster = await monstersCollection.findOne({ _id: session.monsterId });

    if (!monster) {
      return NextResponse.json(
        { error: 'Monster not found' },
        { status: 404 }
      );
    }

    // Calculate time elapsed from server-side actualBattleStartedAt (or startedAt as fallback)
    // actualBattleStartedAt is set when user clicks "Start Battle" button
    // This prevents client-side time manipulation and excludes time spent on start screen
    const currentTime = Date.now();
    const startTime = session.actualBattleStartedAt
      ? new Date(session.actualBattleStartedAt).getTime()
      : new Date(session.startedAt).getTime();
    const timeElapsed = currentTime - startTime;
    const timeInSeconds = timeElapsed / 1000;

    // Calculate click rate (clicks per second)
    const clickRate = clickCount / timeInSeconds;

    console.log(`User ${userId} - Click rate: ${clickRate.toFixed(2)} clicks/second (${clickCount} clicks in ${timeInSeconds.toFixed(2)}s)`);

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
          isEmpowered: equippedWeaponDoc.isEmpowered
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
          isEmpowered: equippedArmorDoc.isEmpowered
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
          isEmpowered: equippedAccessory1Doc.isEmpowered
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
          isEmpowered: equippedAccessory2Doc.isEmpowered
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

    // Step 3: Calculate active attack time (total time - invulnerability time)
    const totalTimeMs = timeInSeconds * 1000;
    const activeAttackTimeMs = totalTimeMs - invulnerabilityMs;

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

    console.log(`Damage calculation:`);
    console.log(`  Time: ${timeInSeconds.toFixed(2)}s total, ${invulnerabilityMs}ms invulnerable, ${(activeAttackTimeMs / 1000).toFixed(2)}s active`);
    console.log(`  Monster: ${damagePerHit} dmg/hit (${equipmentStats.defense} defense → ${actualReductionPercent}% reduction), ${attackInterval}ms interval, ${numberOfAttacks} attacks = ${monsterDamage} damage`);
    console.log(`  Summons: ${reportedSummonDamage} damage (not reduced by armor)`);
    console.log(`  Total base: ${totalBaseDamage} damage`);
    if (reportedThornsDamage > 0) {
      console.log(`  Thorns (reflection): ${reportedThornsDamage} damage dealt to monster`);
    }
    if (damageReduction > 0) {
      console.log(`  → After ${damageReduction}% damage reduction: ${expectedDamage} damage`);
    }
    if (shieldHP > 0) {
      console.log(`  → After ${shieldHP} shield absorption: ${damageAfterShield} damage`);
    }

    // Use damage after all protections for HP calculation
    expectedDamage = damageAfterShield;

    // Use actual healing reported from frontend (includes consumables, spells, lifesteal)
    // Frontend tracks all healing as it happens, which is more accurate than estimating
    const totalHealing = reportedHealing;
    console.log(`Actual healing reported from frontend: ${totalHealing} HP`);

    // Keep usedItems array for battle session tracking (even though we don't estimate healing from it)
    const usedItemsArray = Array.isArray(usedItems) ? usedItems : [];

    // Calculate expected HP after battle (including equipment max HP bonuses)
    const totalMaxHP = playerStats.maxHealth + equipmentStats.maxHpBonus;
    const expectedHP = totalMaxHP - expectedDamage + totalHealing;

    // Apply 20% tolerance to account for state update timing issues
    // Player is considered dead only if expectedHP < -(totalMaxHP * 0.20)
    // This allows minor discrepancies in close fights due to heal state updates
    const hpTolerance = Math.floor(totalMaxHP * 0.20);
    const hpThreshold = -hpTolerance;

    console.log(`HP Verification - Base Max HP: ${playerStats.maxHealth}, Equipment Bonus: +${equipmentStats.maxHpBonus}, Total Max HP: ${totalMaxHP}, Expected Damage: ${expectedDamage}, Healing: ${totalHealing}, Expected HP: ${expectedHP}`);
    console.log(`  → 20% tolerance: ${hpTolerance} HP buffer (threshold: ${hpThreshold} HP)`);
    if (shieldHP > 0 || damageReduction > 0) {
      console.log(`  Buff protection: ${shieldHP} shield HP, ${damageReduction}% damage reduction`);
    }

    // If player should have died (beyond tolerance), they're cheating
    if (expectedHP < hpThreshold) {
      console.warn(`⚠️ HP cheat detected! User ${userId} should have died but claims to have survived.`);
      console.warn(`   Expected HP: ${expectedHP} (below threshold: ${hpThreshold} with 20% tolerance)`);
      console.warn(`   Total Max HP: ${totalMaxHP} (base: ${playerStats.maxHealth} + equipment: ${equipmentStats.maxHpBonus})`);
      console.warn(`   Active time: ${(activeAttackTimeMs / 1000).toFixed(2)}s (${invulnerabilityMs}ms invulnerable)`);
      console.warn(`   Defense: ${equipmentStats.defense} (→ ${actualReductionPercent}% damage reduction)`);
      console.warn(`   Monster damage: ${numberOfAttacks} attacks × ${damagePerHit} dmg/hit = ${monsterDamage}`);
      console.warn(`   Summon damage: ${reportedSummonDamage} (not reduced by defense)`);
      console.warn(`   Total damage: ${expectedDamage} (after ${shieldHP} shield, ${damageReduction}% reduction buff)`);
      console.warn(`   Healing used: ${totalHealing} (includes defensive lifesteal)`);
      if (reportedThornsDamage > 0) {
        console.warn(`   Thorns damage dealt to monster: ${reportedThornsDamage}`);
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

      // Deduct gold as penalty (10% like death)
      const goldLossPercentage = 0.10;
      const goldLost = Math.round(playerStats.coins * goldLossPercentage);
      if (goldLost > 0) {
        await playerStatsCollection.updateOne(
          { userId },
          {
            $set: {
              coins: Math.max(0, playerStats.coins - goldLost)
            }
          }
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

    console.log(`Click Verification - Manual: ${clickCount}, Auto: ${expectedAutoClicks}, Total: ${totalClickPotential}, Max Allowed: ${maxAllowedTotal} (${timeInSeconds.toFixed(2)}s)`);

    if (totalClickPotential > maxAllowedTotal) {
      const manualClickRate = clickCount / timeInSeconds;
      console.warn(`⚠️ Cheat detected! User ${userId} exceeded max click potential: ${totalClickPotential} > ${maxAllowedTotal}`);
      console.warn(`   Manual: ${clickCount} (${manualClickRate.toFixed(2)}/sec), Auto: ${expectedAutoClicks} (${equipmentStats.autoClickRate}/sec), Time: ${timeInSeconds.toFixed(2)}s`);

      // Punish cheater by doubling the required clicks
      const newClicksRequired = monster.clicksRequired * 2;

      await monstersCollection.updateOne(
        { _id: monster._id },
        {
          $set: {
            clicksRequired: newClicksRequired
          }
        }
      );

      // Return cheat detection response
      return NextResponse.json({
        cheatingDetected: true,
        message: 'That was quite fast for a human, are you cheating?',
        newClicksRequired,
        clickRate: (totalClickPotential / timeInSeconds).toFixed(2)
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

    // For bosses, log the damage discrepancy for debugging
    if (isBossMonster && totalDamage < monster.clicksRequired) {
      console.log(`ℹ️ Boss defeated with ${totalDamage}/${monster.clicksRequired} damage (phases may affect this)`);
    }

    // Generate random loot drops (5 items) with streak multiplier
    // Get current streak for this specific zone
    const currentBiome = session.biome;
    const currentTier = session.tier;
    const winStreak = getStreakForZone(playerStats.stats.battlesWonStreaks, currentBiome, currentTier);
    const streakMultiplier = (1.0 + Math.min(winStreak * 0.03, 0.30)).toFixed(2);

    console.log(`🎯 [STREAK DEBUG] Biome: ${currentBiome}, Tier: ${currentTier}, Current Streak: ${winStreak}`);
    console.log(`🎯 [STREAK DEBUG] Streak Multiplier for loot: ${streakMultiplier}x (${winStreak} * 0.03)`);
    console.log(`🎯 [STREAK DEBUG] battlesWonStreaks:`, JSON.stringify(playerStats.stats.battlesWonStreaks));

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
      bossAttackSpeed: 1.0,
      bossSpawnRate: 1.0
    };

    let extraLootCards = 0;
    let challengeXPMultiplier = 1.0;

    // Toggle bonuses
    if (challengeConfig.forceShield) {
      extraLootCards += 1;
      console.log(`⚔️ [CHALLENGE] Force Shield bonus: +1 loot card`);
    }
    if (challengeConfig.forceSpeed) {
      extraLootCards += 1;
      console.log(`⚔️ [CHALLENGE] Force Speed bonus: +1 loot card`);
    }

    // Max slider bonuses (+1 loot card for the 3 hardest settings)
    if (challengeConfig.damageMultiplier === 3.0) {
      extraLootCards += 1;
      console.log(`⚔️ [CHALLENGE] Max Damage bonus: +1 loot card`);
    }
    if (challengeConfig.escapeTimerSpeed === 4.0) {
      extraLootCards += 1;
      console.log(`⚔️ [CHALLENGE] Max Escape Timer bonus: +1 loot card`);
    }
    if (challengeConfig.buffStrength === 5.0) {
      extraLootCards += 1;
      console.log(`⚔️ [CHALLENGE] Max Buff Strength bonus: +1 loot card`);
    }

    // Damage multiplier bonus (+25% per step)
    if (challengeConfig.damageMultiplier > 1.0) {
      const damageSteps = Math.log(challengeConfig.damageMultiplier) / Math.log(1.25);
      challengeXPMultiplier += damageSteps * 0.25;
      console.log(`⚔️ [CHALLENGE] Damage multiplier ${challengeConfig.damageMultiplier}x: +${Math.round(damageSteps * 25)}% rewards`);
    }

    // HP multiplier bonus (+50% per step)
    if (challengeConfig.hpMultiplier > 1.0) {
      const hpSteps = Math.log(challengeConfig.hpMultiplier) / Math.log(1.5);
      challengeXPMultiplier += hpSteps * 0.50;
      console.log(`⚔️ [CHALLENGE] HP multiplier ${challengeConfig.hpMultiplier}x: +${Math.round(hpSteps * 50)}% rewards`);
    }

    // DoT intensity bonus (+30% per step)
    if (challengeConfig.dotIntensity > 1.0) {
      const dotSteps = Math.log(challengeConfig.dotIntensity) / Math.log(1.5);
      challengeXPMultiplier += dotSteps * 0.30;
      console.log(`⚔️ [CHALLENGE] DoT intensity ${challengeConfig.dotIntensity}x: +${Math.round(dotSteps * 30)}% rewards`);
    }

    // Corruption rate bonus (+60% at 100%)
    if (challengeConfig.corruptionRate > 0) {
      challengeXPMultiplier += challengeConfig.corruptionRate * 0.60;
      console.log(`⚔️ [CHALLENGE] Corruption rate ${Math.round(challengeConfig.corruptionRate * 100)}%: +${Math.round(challengeConfig.corruptionRate * 60)}% rewards`);
    }

    // Escape timer speed bonus (+40% per step, minimum 10s enforced)
    if (challengeConfig.escapeTimerSpeed > 1.0) {
      const escapeSteps = Math.log(challengeConfig.escapeTimerSpeed) / Math.log(1.5);
      challengeXPMultiplier += escapeSteps * 0.40;
      console.log(`⚔️ [CHALLENGE] Escape timer ${challengeConfig.escapeTimerSpeed}x: +${Math.round(escapeSteps * 40)}% rewards`);
    }

    // Buff strength bonus (+35% per step)
    if (challengeConfig.buffStrength > 1.0) {
      const buffSteps = Math.log(challengeConfig.buffStrength) / Math.log(1.5);
      challengeXPMultiplier += buffSteps * 0.35;
      console.log(`⚔️ [CHALLENGE] Buff strength ${challengeConfig.buffStrength}x: +${Math.round(buffSteps * 35)}% rewards`);
    }

    // Boss attack speed bonus (+50% per step)
    if (challengeConfig.bossAttackSpeed < 1.0) {
      const bossSteps = Math.log(1.0 / challengeConfig.bossAttackSpeed) / Math.log(1.33);
      challengeXPMultiplier += bossSteps * 0.50;
      console.log(`⚔️ [CHALLENGE] Boss attack ${challengeConfig.bossAttackSpeed}x: +${Math.round(bossSteps * 50)}% rewards`);
    }

    // Boss spawn rate penalty (-3 loot cards)
    if (challengeConfig.bossSpawnRate === 5.0) {
      extraLootCards -= 4;
      console.log(`👹 [CHALLENGE] Boss Spawn Rate 5x: -4 loot cards penalty`);
    }

    const totalLootCards = Math.max(1, 5 + extraLootCards); // Ensure at least 1 loot card
    console.log(`⚔️ [CHALLENGE] Total loot cards: ${totalLootCards} (base 5 + ${extraLootCards} challenge bonus)`);
    console.log(`⚔️ [CHALLENGE] Total XP/Coin multiplier: ${challengeXPMultiplier.toFixed(2)}x`);

    const lootOptions = getRandomLoot(monster.name, totalLootCards, winStreak);
    const lootOptionIds = lootOptions.map(l => l.lootId);

    console.log(`✅ Monster defeated! User ${userId} defeated ${monster.name} with ${clickCount} clicks (${totalDamage} damage) in ${timeInSeconds.toFixed(2)}s`);
    if (reportedThornsDamage > 0) {
      console.log(`   🔱 Thorns damage: ${reportedThornsDamage}`);
    }
    if (reportedHealing > 0) {
      console.log(`   💚 Total healing: ${reportedHealing} (includes defensive lifesteal + consumables + offensive lifesteal)`);
    }
    console.log(`🎁 Loot generated (${winStreak} streak, ${streakMultiplier}x): ${lootOptions.map(l => `${l.name} (${l.rarity})`).join(', ')}`);

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
          usedItems: usedItemsArray // Save the items used during battle
        }
      }
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
          console.log(`🎉 Unlocked ${nextBiomeTierKey} for user ${userId} by defeating epic mini-boss ${monster.name}`);
        } else {
          unlockReason = '10_streak';
          console.log(`🎉 Unlocked ${nextBiomeTierKey} for user ${userId} with 10 win streak`);
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
      console.log(`👹 [CHALLENGE] Boss Spawn Rate 5x: -50% rewards`);
    }

    // XP multiplier (streak * tier * challenge)
    const totalXPMultiplier = rewardStreakMultiplier * tierXPMultiplier * challengeXPMultiplier * bossSpawnXPPenalty;

    // Coin multiplier (streak * nerfed_tier * challenge * boss_penalty)
    const totalCoinMultiplier = rewardStreakMultiplier * tierCoinMultiplier * challengeXPMultiplier * bossSpawnCoinPenalty;

    console.log(`🎯 [REWARD DEBUG] Base Rewards: ${baseRewards.xp} XP, ${baseRewards.coins} coins (${monster.rarity})`);
    console.log(`🎯 [REWARD DEBUG] Streak Multiplier: ${rewardStreakMultiplier}x (streak ${winStreak})`);
    console.log(`🎯 [REWARD DEBUG] Tier XP Multiplier: ${tierXPMultiplier}x (Tier ${currentTier})`);
    console.log(`🎯 [REWARD DEBUG] Tier Coin Multiplier: ${tierCoinMultiplier}x (Tier ${currentTier}) [NERFED]`);
    console.log(`🎯 [REWARD DEBUG] Challenge Multiplier: ${challengeXPMultiplier.toFixed(2)}x`);
    console.log(`🎯 [REWARD DEBUG] Boss Spawn Coin Penalty: ${bossSpawnCoinPenalty}x`);
    console.log(`🎯 [REWARD DEBUG] Boss Spawn XP Penalty: ${bossSpawnXPPenalty}x`);
    console.log(`🎯 [REWARD DEBUG] Total XP Multiplier: ${totalXPMultiplier.toFixed(2)}x`);
    console.log(`🎯 [REWARD DEBUG] Total Coin Multiplier: ${totalCoinMultiplier.toFixed(2)}x`);

    const rewards = {
      xp: Math.ceil(baseRewards.xp * totalXPMultiplier),
      coins: Math.ceil(baseRewards.coins * totalCoinMultiplier)
    };

    console.log(`💰 Rewarding player: +${rewards.xp} XP, +${rewards.coins} coins (${monster.rarity} monster, Tier ${currentTier}, streak ${winStreak})`);

    // Calculate new XP and coins
    const newXP = playerStats.experience + rewards.xp;
    const newCoins = playerStats.coins + rewards.coins;

    // Check for level up
    const levelUpResult = checkLevelUp(playerStats.level, newXP);

    if (levelUpResult.leveledUp) {
      console.log(`🎊 LEVEL UP! ${levelUpResult.previousLevel} → ${levelUpResult.newLevel}`);
      console.log(`   +${levelUpResult.statIncreases.maxHealth} max HP, +${levelUpResult.statIncreases.baseDamage} base damage`);

      // Calculate remaining XP after level up
      const xpForPreviousLevel = newXP;
      const xpForNextLevel = xpForPreviousLevel; // This will be recalculated on next level
      const remainingXP = xpForPreviousLevel; // Keep all XP for now, let checkLevelUp handle it

      // Update player stats with level up
      // Calculate total max HP including equipment bonuses
      const newMaxHealth = playerStats.maxHealth + levelUpResult.statIncreases.maxHealth;
      const totalMaxHP = newMaxHealth + equipmentStats.maxHpBonus;

      console.log(`🎯 [LEVEL UP HEAL] Base Max HP: ${playerStats.maxHealth} + ${levelUpResult.statIncreases.maxHealth} = ${newMaxHealth}`);
      console.log(`🎯 [LEVEL UP HEAL] Equipment Bonus: +${equipmentStats.maxHpBonus}`);
      console.log(`🎯 [LEVEL UP HEAL] Total Max HP (with equipment): ${totalMaxHP}`);
      console.log(`🎯 [LEVEL UP HEAL] Setting currentHealth to: ${totalMaxHP} (full heal with equipment)`);

      await playerStatsCollection.updateOne(
        { userId },
        {
          $set: {
            level: levelUpResult.newLevel,
            experience: 0, // Reset XP for new level
            coins: newCoins,
            maxHealth: newMaxHealth, // Store base max health (without equipment)
            currentHealth: totalMaxHP, // Full heal including equipment bonuses
            baseDamage: playerStats.baseDamage + levelUpResult.statIncreases.baseDamage
          }
        }
      );
    } else {
      // Just add XP and coins (no level up)
      await playerStatsCollection.updateOne(
        { userId },
        {
          $set: {
            experience: newXP,
            coins: newCoins
          }
        }
      );
    }

    return NextResponse.json({
      success: true,
      monster: {
        ...monster,
        _id: monster._id?.toString()
      },
      session: {
        ...session,
        _id: session._id?.toString(),
        monsterId: session.monsterId.toString(),
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
