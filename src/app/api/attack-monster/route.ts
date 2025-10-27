import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { getRandomLoot, getLootItemById } from '@/lib/loot-table';
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

    // Calculate time elapsed from server-side session.startedAt
    // This prevents client-side time manipulation
    const currentTime = Date.now();
    const startTime = new Date(session.startedAt).getTime();
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

      return NextResponse.json({
        hpCheatDetected: true,
        message: 'You should have been defeated by the monster! Are you manipulating your HP?',
        expectedDamage,
        totalHealing,
        expectedHP
      }, { status: 400 });
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

    // Generate random loot drops (5 items)
    const lootOptions = getRandomLoot(monster.name, 5);
    const lootOptionIds = lootOptions.map(l => l.lootId);

    console.log(`✅ Monster defeated! User ${userId} defeated ${monster.name} with ${clickCount} clicks in ${timeInSeconds.toFixed(2)}s`);
    console.log(`🎁 Loot generated: ${lootOptions.map(l => l.name).join(', ')}`);

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
      lootOptions, // Send the 5 loot items for user to choose from
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
