import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { getRandomLoot, getLootItemById } from '@/lib/loot-table';
import { getNextUnlock, formatBiomeTierKey } from '@/lib/biome-config';
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
    const { sessionId, clickCount, usedItems } = body;

    // Validate input
    if (!sessionId || typeof clickCount !== 'number') {
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
    const { battleSessionsCollection, monstersCollection, playerStatsCollection } = await connectToMongo();

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

      // Reset win streak
      await playerStatsCollection.updateOne(
        { userId },
        {
          $set: {
            'stats.battlesWonStreak': 0
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
        streakLost: playerStats.stats.battlesWonStreak
      }, { status: 200 }); // Return 200 so frontend handles it properly
    }

    // CHEAT DETECTION: If clicking too fast
    if (clickRate > MAX_CLICKS_PER_SECOND) {
      console.warn(`⚠️ Cheat detected! User ${userId} exceeded max click rate: ${clickRate.toFixed(2)} clicks/second`);

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
        clickRate: clickRate.toFixed(2)
      }, { status: 200 });
    }

    // Validate that clicks are sufficient to defeat monster
    if (clickCount < monster.clicksRequired) {
      return NextResponse.json(
        { error: 'Insufficient clicks to defeat monster' },
        { status: 400 }
      );
    }

    // Generate random loot drops (5 items) with streak multiplier
    const winStreak = playerStats.stats.battlesWonStreak || 0;
    const streakMultiplier = (1.0 + Math.min(winStreak * 0.03, 0.30)).toFixed(2);
    const lootOptions = getRandomLoot(monster.name, 5, winStreak);
    const lootOptionIds = lootOptions.map(l => l.lootId);

    console.log(`✅ Monster defeated! User ${userId} defeated ${monster.name} with ${clickCount} clicks in ${timeInSeconds.toFixed(2)}s`);
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
    const currentBiome = session.biome;
    const currentTier = session.tier;
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
