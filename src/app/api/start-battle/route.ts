import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { getRandomMonsterTemplate, getRandomClicksRequired } from '@/lib/monster-table';
import { ObjectId } from 'mongodb';

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

    // Connect to MongoDB and get collections
    const { battleSessionsCollection, monstersCollection } = await connectToMongo();

    // Check if user already has an active battle session
    const activeSession = await battleSessionsCollection.findOne({
      userId,
      isDefeated: false,
      completedAt: { $exists: false }
    });

    if (activeSession) {
      // Return existing active session with monster details
      const monster = await monstersCollection.findOne({
        _id: activeSession.monsterId
      });

      return NextResponse.json({
        session: {
          ...activeSession,
          _id: activeSession._id?.toString(),
          monsterId: activeSession.monsterId.toString()
        },
        monster: monster ? {
          ...monster,
          _id: monster._id?.toString()
        } : null,
        isNewSession: false
      });
    }

    // No active session found, create new monster and battle session
    const monsterTemplate = getRandomMonsterTemplate();
    const clicksRequired = getRandomClicksRequired(monsterTemplate.clicksRange);

    const newMonster = {
      name: monsterTemplate.name,
      imageUrl: monsterTemplate.imageUrl,
      clicksRequired,
      attackDamage: monsterTemplate.attackDamage,
      rarity: monsterTemplate.rarity,
      createdAt: new Date()
    };

    const monsterResult = await monstersCollection.insertOne(newMonster);
    const monsterId = monsterResult.insertedId;

    // Create new battle session
    const newSession = {
      userId,
      monsterId,
      clickCount: 0,
      isDefeated: false,
      usedItems: [], // Initialize empty array for tracking used items
      startedAt: new Date()
    };

    const sessionResult = await battleSessionsCollection.insertOne(newSession);

    console.log(`New battle session created for user ${userId}: ${sessionResult.insertedId.toString()}`);

    return NextResponse.json({
      session: {
        ...newSession,
        _id: sessionResult.insertedId.toString(),
        monsterId: monsterId.toString()
      },
      monster: {
        ...newMonster,
        _id: monsterId.toString()
      },
      isNewSession: true
    });

  } catch (error) {
    console.error('Start battle error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
