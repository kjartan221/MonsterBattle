import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';

/**
 * GET /api/consumables/get
 * Fetches the user's inventory of consumables
 */
export async function GET(request: NextRequest) {
    try {
        // Get cookies from next/headers
        const cookieStore = await cookies();
        const token = cookieStore.get('verified')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify JWT
        const payload = await verifyJWT(token);
        const userId = payload.userId;

        // Fetch all items from the inventory
        const { userInventoryCollection } = await connectToMongo();
        const inventoryItems = await userInventoryCollection.find({ userId: userId }).toArray();

        // Import loot table to check item types
        const { getLootItemById } = await import('@/lib/loot-table');

        // Filter for consumables only
        const consumables = inventoryItems
            .map(item => {
                const lootItem = getLootItemById(item.lootTableId);
                if (lootItem && lootItem.type === 'consumable') {
                    return {
                        _id: item._id.toString(),
                        lootTableId: item.lootTableId,
                        name: lootItem.name,
                        icon: lootItem.icon,
                        description: lootItem.description,
                        rarity: lootItem.rarity,
                        type: lootItem.type
                    };
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        return NextResponse.json({ consumables });
    } catch (error) {
        console.error('Error fetching consumables:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}