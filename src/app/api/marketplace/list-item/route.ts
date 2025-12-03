import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getLootItemById, LootItem, EquipmentStats } from '@/lib/loot-table';

/**
 * POST /api/marketplace/list-item
 * List an item (NFT or material token) for sale on the marketplace
 */
export async function POST(request: NextRequest) {
  try {
    // Get cookies using next/headers
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId as string;

    const body = await request.json();
    const { inventoryItemId, materialTokenId, price } = body;

    // Validate price
    if (!price || isNaN(price) || price <= 0) {
      return NextResponse.json({ error: 'Valid price is required' }, { status: 400 });
    }

    // Must provide either inventoryItemId or materialTokenId (not both)
    if ((!inventoryItemId && !materialTokenId) || (inventoryItemId && materialTokenId)) {
      return NextResponse.json(
        { error: 'Must provide either inventoryItemId or materialTokenId' },
        { status: 400 }
      );
    }

    const {
      usersCollection,
      userInventoryCollection,
      materialTokensCollection,
      marketplaceItemsCollection
    } = await connectToMongo();

    // Get user info
    const user = await usersCollection.findOne({ userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    interface ItemData {
      inventoryItemId?: string;
      materialTokenId?: string;
      lootTableId: string;
      itemName: string;
      itemIcon: string;
      itemType: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact' | 'inscription_scroll' | 'spell_scroll';
      rarity: 'common' | 'rare' | 'epic' | 'legendary';
      tier: number;
      tokenId?: string;
      transactionId?: string;
      quantity?: number;
      equipmentStats?: EquipmentStats;
      crafted?: boolean;
      statRoll?: number;
      isEmpowered?: boolean;
      prefix?: any;
      suffix?: any;
    }

    let itemData: ItemData | null = null;
    let lootItem: LootItem | undefined;

    if (inventoryItemId) {
      // Listing an NFT item from inventory
      const item = await userInventoryCollection.findOne({
        _id: new ObjectId(inventoryItemId),
        userId
      });

      if (!item) {
        return NextResponse.json({ error: 'Item not found in inventory' }, { status: 404 });
      }

      // Item must be minted (have nftLootId)
      if (!item.nftLootId) {
        return NextResponse.json(
          { error: 'Item must be minted as NFT before listing' },
          { status: 400 }
        );
      }

      // Check if already listed
      const existingListing = await marketplaceItemsCollection.findOne({
        inventoryItemId: inventoryItemId,
        status: 'active'
      });

      if (existingListing) {
        return NextResponse.json(
          { error: 'Item is already listed on marketplace' },
          { status: 400 }
        );
      }

      lootItem = getLootItemById(item.lootTableId);
      if (!lootItem) {
        return NextResponse.json({ error: 'Item data not found' }, { status: 404 });
      }

      // Always use base stats from loot table
      // Frontend will calculate final values using: stats * statRoll (if crafted)
      itemData = {
        inventoryItemId: inventoryItemId,
        lootTableId: item.lootTableId,
        itemName: lootItem.name,
        itemIcon: lootItem.icon,
        itemType: lootItem.type,
        rarity: lootItem.rarity,
        tier: item.tier,
        equipmentStats: lootItem.equipmentStats, // Base stats only
        crafted: item.crafted,         // Crafted status
        statRoll: item.statRoll,       // Frontend calculates: stats * statRoll
        isEmpowered: item.isEmpowered, // Corrupted monster bonus
        prefix: item.prefix,
        suffix: item.suffix,
      };

    } else if (materialTokenId) {
      // Listing a material token
      const token = await materialTokensCollection.findOne({
        _id: new ObjectId(materialTokenId),
        userId
      });

      if (!token) {
        return NextResponse.json({ error: 'Material token not found' }, { status: 404 });
      }

      // Token must not be consumed
      if (token.consumed) {
        return NextResponse.json(
          { error: 'Material token has been consumed' },
          { status: 400 }
        );
      }

      // Check if already listed
      const existingListing = await marketplaceItemsCollection.findOne({
        materialTokenId: materialTokenId,
        status: 'active'
      });

      if (existingListing) {
        return NextResponse.json(
          { error: 'Material is already listed on marketplace' },
          { status: 400 }
        );
      }

      lootItem = getLootItemById(token.lootTableId);
      if (!lootItem) {
        return NextResponse.json({ error: 'Material data not found' }, { status: 404 });
      }

      // Extract tier from metadata
      const tokenMetadata = token.metadata as { tier?: number } | undefined;
      const tier = tokenMetadata?.tier || 1;

      itemData = {
        materialTokenId: materialTokenId,
        lootTableId: token.lootTableId,
        itemName: lootItem.name,
        itemIcon: lootItem.icon,
        itemType: lootItem.type,
        rarity: lootItem.rarity,
        tier: tier,
        tokenId: token.tokenId,
        transactionId: token.transactionId,
        quantity: token.quantity,
      };
    }

    // Ensure itemData was set
    if (!itemData) {
      return NextResponse.json(
        { error: 'Failed to prepare item data' },
        { status: 500 }
      );
    }

    // Create marketplace listing
    const marketplaceItem = {
      sellerId: userId,
      sellerUsername: user.username,
      ...itemData,
      price: parseInt(price, 10),
      status: 'active' as const,
      listedAt: new Date(),
    };

    const result = await marketplaceItemsCollection.insertOne(marketplaceItem);

    console.log('[MARKETPLACE LIST] Item listed:', {
      listingId: result.insertedId,
      itemName: itemData.itemName,
      price: price,
    });

    return NextResponse.json({
      success: true,
      listingId: result.insertedId.toString(),
      message: `${itemData.itemName} listed for ${price} satoshis`,
    });

  } catch (error) {
    console.error('Error listing item on marketplace:', error);
    return NextResponse.json(
      { error: 'Failed to list item' },
      { status: 500 }
    );
  }
}
