import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { getLootItemById } from '@/lib/loot-table';

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

    // Build inventory by getting loot data from loot-table
    const inventory = inventoryItems.map((inventoryItem) => {
      // Get base item data from loot-table
      const lootTemplate = getLootItemById(inventoryItem.lootTableId);
      if (!lootTemplate) return null;

      return {
        lootId: inventoryItem.lootTableId,
        name: lootTemplate.name,
        icon: lootTemplate.icon,
        description: lootTemplate.description,
        rarity: lootTemplate.rarity,
        type: lootTemplate.type,
        tier: inventoryItem.tier, // Which tier this item dropped from (1-5)
        acquiredAt: inventoryItem.acquiredAt,
        sessionId: inventoryItem.fromSessionId.toString(),
        inventoryId: inventoryItem._id?.toString(),
        nftLootId: inventoryItem.nftLootId?.toString(), // Will be undefined if not minted yet
        borderGradient: inventoryItem.borderGradient, // User-specific gradient colors
        isMinted: !!inventoryItem.nftLootId // True if NFT has been created
      };
    }).filter(item => item !== null); // Filter out any items not found

    // For minted items, fetch the NFT details to get mint transaction ID
    const mintedItemIds = inventoryItems
      .filter(item => item.nftLootId)
      .map(item => item.nftLootId!);

    if (mintedItemIds.length > 0) {
      const nftLootItems = await nftLootCollection
        .find({ _id: { $in: mintedItemIds } })
        .toArray();

      const nftLootMap = new Map(
        nftLootItems.map(item => [item._id!.toString(), item])
      );

      // Add mint transaction ID to minted items
      inventory.forEach((item: any) => {
        if (item.nftLootId) {
          const nftLoot = nftLootMap.get(item.nftLootId);
          if (nftLoot) {
            item.mintTransactionId = nftLoot.mintTransactionId;
          }
        }
      });
    }

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
