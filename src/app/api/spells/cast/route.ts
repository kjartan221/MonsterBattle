import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { getLootItemById } from '@/lib/loot-table';
import { ObjectId } from 'mongodb';

/**
 * POST /api/spells/cast
 * Casts the equipped spell (damage or healing)
 * Tracks spell usage server-side to prevent cooldown bypassing
 */
export async function POST(request: NextRequest) {
  try {
    // Get cookies
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

    // Connect to MongoDB
    const { playerStatsCollection, userInventoryCollection } = await connectToMongo();

    // Get player stats (includes equippedSpell and spell cooldown tracking)
    const playerStats = await playerStatsCollection.findOne({ userId });

    if (!playerStats) {
      return NextResponse.json(
        { error: 'Player stats not found' },
        { status: 404 }
      );
    }

    // Check if spell is equipped
    const equippedSpellId = playerStats.equippedSpell;
    if (!equippedSpellId || equippedSpellId === 'empty') {
      return NextResponse.json(
        { error: 'No spell equipped' },
        { status: 400 }
      );
    }

    // Convert to ObjectId
    const inventoryObjectId = typeof equippedSpellId === 'string'
      ? new ObjectId(equippedSpellId)
      : equippedSpellId;

    // Get the spell scroll from inventory
    const inventoryItem = await userInventoryCollection.findOne({
      _id: inventoryObjectId,
      userId
    });

    if (!inventoryItem) {
      return NextResponse.json(
        { error: 'Equipped spell not found in inventory' },
        { status: 404 }
      );
    }

    // Get spell data from loot table
    const lootItem = getLootItemById(inventoryItem.lootTableId);
    if (!lootItem || lootItem.type !== 'spell_scroll' || !lootItem.spellData) {
      return NextResponse.json(
        { error: 'Invalid spell data' },
        { status: 400 }
      );
    }

    const spellData = lootItem.spellData;

    // ANTI-CHEAT: Check cooldown server-side
    // Use server-stored lastSpellCast timestamp (not client-provided)
    const lastSpellCast = playerStats.lastSpellCast || 0;
    const timeSinceLastCast = (Date.now() - lastSpellCast) / 1000; // seconds
    const cooldownRemaining = Math.max(0, spellData.cooldown - timeSinceLastCast);

    if (cooldownRemaining > 0) {
      return NextResponse.json(
        {
          error: 'Spell on cooldown',
          cooldownRemaining: Math.ceil(cooldownRemaining)
        },
        { status: 400 }
      );
    }

    // Execute spell effect
    let damage = 0;
    let healing = 0;

    if (spellData.damage) {
      // Damage spell - return damage value for frontend to apply
      damage = spellData.damage;
    } else if (spellData.healing) {
      // Healing spell - return healing amount for frontend to apply
      // Frontend's healHealth() hook will handle max HP calculation with equipment bonuses
      healing = spellData.healing;

      // Update cooldown timestamp
      await playerStatsCollection.updateOne(
        { userId },
        { $set: { lastSpellCast: Date.now() } }
      );
    }

    // Update lastSpellCast timestamp for damage spells too
    if (damage > 0) {
      await playerStatsCollection.updateOne(
        { userId },
        {
          $set: {
            lastSpellCast: Date.now()
          }
        }
      );
    }

    return NextResponse.json({
      success: true,
      spellName: spellData.spellName,
      damage,
      healing,
      effect: spellData.effect
    });

  } catch (error) {
    console.error('Error casting spell:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
