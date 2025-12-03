import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo } from '@/lib/mongodb';
import { getLootItemById } from '@/lib/loot-table';
import { Filter } from 'mongodb';
import { MarketplaceItem } from '@/lib/types';

/**
 * GET /api/marketplace/items
 * Fetch marketplace items with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract filter parameters
    const search = searchParams.get('search') || '';
    const itemType = searchParams.get('itemType') || '';
    const rarity = searchParams.get('rarity') || '';
    const tier = searchParams.get('tier') || '';
    const minPrice = searchParams.get('minPrice') || '';
    const maxPrice = searchParams.get('maxPrice') || '';

    const { marketplaceItemsCollection } = await connectToMongo();

    // Build query
    const query: Filter<MarketplaceItem> = { status: 'active' };

    // Regex search on item name (case-insensitive)
    if (search) {
      query.itemName = { $regex: search, $options: 'i' } as any;
    }

    // Filter by item type
    if (itemType) {
      query.itemType = itemType as any;
    }

    // Filter by rarity
    if (rarity) {
      query.rarity = rarity as any;
    }

    // Filter by tier
    if (tier) {
      const tierNum = parseInt(tier, 10);
      if (!isNaN(tierNum)) {
        query.tier = tierNum;
      }
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      const priceFilter: { $gte?: number; $lte?: number } = {};
      if (minPrice) {
        const minPriceNum = parseInt(minPrice, 10);
        if (!isNaN(minPriceNum)) {
          priceFilter.$gte = minPriceNum;
        }
      }
      if (maxPrice) {
        const maxPriceNum = parseInt(maxPrice, 10);
        if (!isNaN(maxPriceNum)) {
          priceFilter.$lte = maxPriceNum;
        }
      }
      query.price = priceFilter as any;
    }

    console.log('[MARKETPLACE GET] Query:', query);

    // Fetch marketplace items (sorted by newest first)
    const items = await marketplaceItemsCollection
      .find(query)
      .sort({ listedAt: -1 })
      .limit(100) // Limit to 100 items for performance
      .toArray();

    console.log('[MARKETPLACE GET] Found items:', items.length);

    // Format items for frontend
    const formattedItems = items.map(item => ({
      _id: item._id?.toString(),
      sellerId: item.sellerId,
      sellerUsername: item.sellerUsername,
      lootTableId: item.lootTableId,
      itemName: item.itemName,
      itemIcon: item.itemIcon,
      itemType: item.itemType,
      rarity: item.rarity,
      tier: item.tier,
      tokenId: item.tokenId,
      transactionId: item.transactionId,
      quantity: item.quantity,
      price: item.price,
      listedAt: item.listedAt,
      equipmentStats: item.equipmentStats,  // Base stats from loot table
      crafted: item.crafted,                 // Crafted status
      statRoll: item.statRoll,               // Frontend calculates: stats * statRoll
      isEmpowered: item.isEmpowered,         // Corrupted monster bonus
      prefix: item.prefix,
      suffix: item.suffix,
    }));

    return NextResponse.json({
      success: true,
      items: formattedItems,
      count: formattedItems.length,
    });

  } catch (error) {
    console.error('Error fetching marketplace items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketplace items' },
      { status: 500 }
    );
  }
}
