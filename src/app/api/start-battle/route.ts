import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { ObjectId } from 'mongodb';

// Monster templates
const MONSTER_TEMPLATES = [
  { name: 'Goblin', imageUrl: '👺', rarity: 'common' as const, clicksRange: [5, 10] as [number, number] },
  { name: 'Orc', imageUrl: '👹', rarity: 'common' as const, clicksRange: [8, 12] as [number, number] },
  { name: 'Troll', imageUrl: '🧟', rarity: 'rare' as const, clicksRange: [15, 20] as [number, number] },
  { name: 'Dragon', imageUrl: '🐉', rarity: 'epic' as const, clicksRange: [25, 35] as [number, number] },
  { name: 'Demon', imageUrl: '😈', rarity: 'legendary' as const, clicksRange: [40, 50] as [number, number] },
  { name: 'Ghost', imageUrl: '👻', rarity: 'rare' as const, clicksRange: [12, 18] as [number, number] },
  { name: 'Vampire', imageUrl: '🧛', rarity: 'epic' as const, clicksRange: [20, 30] as [number, number] },
  { name: 'Zombie', imageUrl: '🧟‍♂️', rarity: 'common' as const, clicksRange: [6, 11] as [number, number] },
];

// Rarity weights for random selection
const RARITY_WEIGHTS = {
  common: 60,    // 60% chance
  rare: 25,      // 25% chance
  epic: 12,      // 12% chance
  legendary: 3   // 3% chance
};

function getRandomMonsterTemplate() {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  let selectedRarity: keyof typeof RARITY_WEIGHTS = 'common';
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      selectedRarity = rarity as keyof typeof RARITY_WEIGHTS;
      break;
    }
  }

  // Filter monsters by selected rarity
  const monstersOfRarity = MONSTER_TEMPLATES.filter(m => m.rarity === selectedRarity);
  return monstersOfRarity[Math.floor(Math.random() * monstersOfRarity.length)];
}

function getRandomClicksRequired(range: [number, number]): number {
  return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
}

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
