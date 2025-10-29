import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/equipment/get
 * Fetches the currently equipped items for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Get cookies using next/headers
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    // Connect to MongoDB
    const { playerStatsCollection, userInventoryCollection } = await connectToMongo();

    // Fetch player stats to get equipped item IDs
    const playerStats = await playerStatsCollection.findOne({ userId });

    if (!playerStats) {
      return NextResponse.json({ error: 'Player stats not found' }, { status: 404 });
    }

    // Fetch equipped items from inventory
    const equippedItems: {
      equippedWeapon?: { inventoryId: string; lootTableId: string; tier: number };
      equippedArmor?: { inventoryId: string; lootTableId: string; tier: number };
      equippedAccessory1?: { inventoryId: string; lootTableId: string; tier: number };
      equippedAccessory2?: { inventoryId: string; lootTableId: string; tier: number };
    } = {};

    if (playerStats.equippedWeapon) {
      const item = await userInventoryCollection.findOne({ _id: playerStats.equippedWeapon });
      if (item) {
        equippedItems.equippedWeapon = {
          inventoryId: item._id.toString(),
          lootTableId: item.lootTableId,
          tier: item.tier || 1 // Default to tier 1 for legacy items without tier
        };
      }
    }

    if (playerStats.equippedArmor) {
      const item = await userInventoryCollection.findOne({ _id: playerStats.equippedArmor });
      if (item) {
        equippedItems.equippedArmor = {
          inventoryId: item._id.toString(),
          lootTableId: item.lootTableId,
          tier: item.tier || 1 // Default to tier 1 for legacy items without tier
        };
      }
    }

    if (playerStats.equippedAccessory1) {
      const item = await userInventoryCollection.findOne({ _id: playerStats.equippedAccessory1 });
      if (item) {
        equippedItems.equippedAccessory1 = {
          inventoryId: item._id.toString(),
          lootTableId: item.lootTableId,
          tier: item.tier || 1 // Default to tier 1 for legacy items without tier
        };
      }
    }

    if (playerStats.equippedAccessory2) {
      const item = await userInventoryCollection.findOne({ _id: playerStats.equippedAccessory2 });
      if (item) {
        equippedItems.equippedAccessory2 = {
          inventoryId: item._id.toString(),
          lootTableId: item.lootTableId,
          tier: item.tier || 1 // Default to tier 1 for legacy items without tier
        };
      }
    }

    return NextResponse.json(equippedItems);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
