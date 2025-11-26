import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { getRandomLoot, getLootItemById } from '@/lib/loot-table';
import { getNextUnlock, formatBiomeTierKey } from '@/lib/biome-config';
import { getMonsterRewards, checkLevelUp, getStreakRewardMultiplier } from '@/utils/playerProgression';
import { calculateTotalEquipmentStats } from '@/utils/equipmentCalculations';
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
    const { sessionId, clickCount, totalDamage, usedItems } = body;

    // Validate input
    if (!sessionId || typeof clickCount !== 'number' || typeof totalDamage !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

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

    // Fetch equipped items to calculate equipment bonuses
    const equippedWeaponDoc = playerStats.equippedWeapon
      ? await userInventoryCollection.findOne({ _id: new ObjectId(playerStats.equippedWeapon) })
      : null;
    const equippedArmorDoc = playerStats.equippedArmor
      ? await userInventoryCollection.findOne({ _id: new ObjectId(playerStats.equippedArmor) })
      : null;
    const equippedAccessory1Doc = playerStats.equippedAccessory1
      ? await userInventoryCollection.findOne({ _id: new ObjectId(playerStats.equippedAccessory1) })
      : null;
    const equippedAccessory2Doc = playerStats.equippedAccessory2
      ? await userInventoryCollection.findOne({ _id: new ObjectId(playerStats.equippedAccessory2) })
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

    // Calculate expected damage from monster
    const expectedDamage = Math.floor(timeInSeconds * monster.attackDamage);

    // Calculate healing from used items
    let totalHealing = 0;
    const usedItemsArray = Array.isArray(usedItems) ? usedItems : [];

    for (const usedItem of usedItemsArray) {
      const item = getLootItemById(usedItem.lootTableId);
      if (item && item.type === 'consumable') {
        // TODO: Add healing amount to item definitions
        // For now, assume health potions heal 50 HP
        if (item.name.toLowerCase().includes('potion') || item.name.toLowerCase().includes('elixir')) {
          totalHealing += 50;
        }
      }
    }

    // Phase 2.5: Calculate lifesteal healing
    // Lifesteal heals for % of damage dealt to monster
    if (equipmentStats.lifesteal > 0 && totalDamage > 0) {
      const lifestealHealing = Math.ceil(totalDamage * (equipmentStats.lifesteal / 100));
      totalHealing += lifestealHealing;
      console.log(`Lifesteal healing: ${lifestealHealing} HP (${equipmentStats.lifesteal}% of ${totalDamage} damage)`);
    }

    // Phase 2.6: Calculate spell healing (for healing spells)
    // Calculate max possible spell casts based on time and cooldown
    if (playerStats.equippedSpell && playerStats.equippedSpell !== 'empty') {
      const equippedSpellDoc = await userInventoryCollection.findOne({
        _id: new ObjectId(playerStats.equippedSpell),
        userId
      });

      if (equippedSpellDoc) {
        const spellItem = getLootItemById(equippedSpellDoc.lootTableId);
        if (spellItem && spellItem.type === 'spell_scroll' && spellItem.spellData) {
          const { healing: spellHealing, cooldown: spellCooldown } = spellItem.spellData;

          if (spellHealing && spellHealing > 0 && spellCooldown > 0) {
            // Calculate max possible spell casts (first cast at 0s, then every cooldown seconds)
            const maxSpellCasts = Math.floor(timeInSeconds / spellCooldown) + 1; // +1 for initial cast
            const maxSpellHealing = maxSpellCasts * spellHealing;
            totalHealing += maxSpellHealing;
            console.log(`Spell healing: ${maxSpellHealing} HP (${maxSpellCasts} casts × ${spellHealing} HP, ${spellCooldown}s cooldown)`);
          }
        }
      }
    }

    // Calculate expected HP after battle
    const expectedHP = playerStats.maxHealth - expectedDamage + totalHealing;

    console.log(`HP Verification - Max HP: ${playerStats.maxHealth}, Expected Damage: ${expectedDamage}, Healing: ${totalHealing}, Expected HP: ${expectedHP}`);

    // If player should have died, they're cheating
    if (expectedHP <= 0) {
      console.warn(`⚠️ HP cheat detected! User ${userId} should have died but claims to have survived.`);
      console.warn(`   Max HP: ${playerStats.maxHealth}, Damage taken: ${expectedDamage}, Healing used: ${totalHealing}`);

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
    const lootOptions = getRandomLoot(monster.name, 5, winStreak);
    const lootOptionIds = lootOptions.map(l => l.lootId);

    console.log(`✅ Monster defeated! User ${userId} defeated ${monster.name} with ${clickCount} clicks (${totalDamage} damage) in ${timeInSeconds.toFixed(2)}s`);
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
    const nextUnlock = getNextUnlock(currentBiome, currentTier);

    if (nextUnlock) {
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
        console.log(`🎉 Unlocked ${nextBiomeTierKey} for user ${userId}`);
      }
    }

    // REWARD PLAYER: Award XP and coins based on monster rarity
    const baseRewards = getMonsterRewards(monster.rarity);

    // Apply streak multiplier to rewards (higher streaks = more rewards)
    // Use the per-zone streak we already calculated above
    const rewardMultiplier = getStreakRewardMultiplier(winStreak);

    const rewards = {
      xp: Math.ceil(baseRewards.xp * rewardMultiplier),
      coins: Math.ceil(baseRewards.coins * rewardMultiplier)
    };

    console.log(`💰 Rewarding player: +${rewards.xp} XP, +${rewards.coins} coins (${monster.rarity} monster, ${rewardMultiplier}x streak bonus)`);

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
