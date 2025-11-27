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

    if (!playerStats.equippedItems) {
      return NextResponse.json({});
    }

    // Collect all equipped item IDs
    const equippedItemIds = Object.values(playerStats.equippedItems).filter(Boolean);

    if (equippedItemIds.length === 0) {
      return NextResponse.json({});
    }

    // Fetch all equipped items in a single query
    const items = await userInventoryCollection.find({
      _id: { $in: equippedItemIds },
      userId
    }).toArray();

    // Build response object with slot mapping
    const equippedItems: {
      equippedWeapon?: { inventoryId: string; lootTableId: string; tier: number; isEmpowered?: boolean; crafted?: boolean; statRoll?: number; prefix?: any; suffix?: any };
      equippedArmor?: { inventoryId: string; lootTableId: string; tier: number; isEmpowered?: boolean; crafted?: boolean; statRoll?: number; prefix?: any; suffix?: any };
      equippedAccessory1?: { inventoryId: string; lootTableId: string; tier: number; isEmpowered?: boolean; crafted?: boolean; statRoll?: number; prefix?: any; suffix?: any };
      equippedAccessory2?: { inventoryId: string; lootTableId: string; tier: number; isEmpowered?: boolean; crafted?: boolean; statRoll?: number; prefix?: any; suffix?: any };
    } = {};

    // Map items back to their slots
    items.forEach(item => {
      const itemData = {
        inventoryId: item._id.toString(),
        lootTableId: item.lootTableId,
        tier: item.tier || 1,
        isEmpowered: item.isEmpowered || false,
        crafted: item.crafted,
        statRoll: item.statRoll,
        prefix: item.prefix, // Phase 3.4: Prefix inscription
        suffix: item.suffix  // Phase 3.4: Suffix inscription
      };

      if (playerStats.equippedItems!.weapon?.equals(item._id)) {
        equippedItems.equippedWeapon = itemData;
      } else if (playerStats.equippedItems!.armor?.equals(item._id)) {
        equippedItems.equippedArmor = itemData;
      } else if (playerStats.equippedItems!.accessory1?.equals(item._id)) {
        equippedItems.equippedAccessory1 = itemData;
      } else if (playerStats.equippedItems!.accessory2?.equals(item._id)) {
        equippedItems.equippedAccessory2 = itemData;
      }
    });

    return NextResponse.json(equippedItems);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
