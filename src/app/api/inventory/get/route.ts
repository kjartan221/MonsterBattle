import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    // Get cookies using next/headers
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId as string;
    
    // Validate that userId exists in the payload
    if (!userId) {
      console.error('JWT payload missing userId:', payload);
      return NextResponse.json({ error: 'Invalid token: missing userId' }, { status: 401 });
    }

    // Ensure MongoDB is connected and get collections
    const { userInventoryCollection, nftLootCollection } = await connectToMongo();

    // Fetch all inventory items for this user
    const inventoryItems = await userInventoryCollection
      .find({ userId })
      .sort({ acquiredAt: -1 }) // Most recent first
      .toArray();

    // Extract NFTLoot IDs
    const nftLootIds = inventoryItems.map(item => item.lootId);

    // Fetch all NFTLoot documents
    const nftLootItems = await nftLootCollection
      .find({ _id: { $in: nftLootIds } })
      .toArray();

    // Create a map for quick lookup
    const nftLootMap = new Map(
      nftLootItems.map(item => [item._id!.toString(), item])
    );

    // Build inventory by combining userInventory and NFTLoot data
    const inventory = inventoryItems.map((inventoryItem) => {
      const nftLoot = nftLootMap.get(inventoryItem.lootId.toString());
      if (!nftLoot) return null;

      return {
        lootId: nftLoot.lootTableId,  // The original loot-table reference
        name: nftLoot.name,
        icon: nftLoot.icon,
        description: nftLoot.description,
        rarity: nftLoot.rarity,
        type: nftLoot.type,
        acquiredAt: inventoryItem.acquiredAt,
        sessionId: inventoryItem.fromSessionId.toString(),
        inventoryId: inventoryItem._id?.toString(),
        nftLootId: nftLoot._id?.toString(),
        mintTransactionId: nftLoot.mintTransactionId,
        borderGradient: nftLoot.attributes?.borderGradient // User-specific gradient colors
      };
    }).filter(item => item !== null); // Filter out any items not found

    return NextResponse.json({
      success: true,
      inventory,
      totalItems: inventory.length
    });

  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}
