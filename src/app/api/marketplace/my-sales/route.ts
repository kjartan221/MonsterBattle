import { NextRequest, NextResponse } from 'next/server';
import { connectToMongo } from '@/lib/mongodb';
import { requireSession } from '@/lib/requireSession';

/**
 * GET /api/marketplace/my-sales
 * Fetch the requester's sold listings that have a claimable payout outpoint.
 * Used by the sold-items inbox so sellers can internalize (claim) their proceeds.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireSession();
    if (session instanceof NextResponse) return session;
    const userId = session.userId;

    const { marketplaceItemsCollection } = await connectToMongo();

    const sales = await marketplaceItemsCollection
      .find({
        sellerId: userId,
        status: 'sold',
        payoutOutpoint: { $exists: true },
      })
      .sort({ soldAt: -1 })
      .toArray();

    const formattedSales = sales.map(doc => ({
      _id: doc._id?.toString(),
      itemName: doc.itemName,
      itemIcon: doc.itemIcon,
      rarity: doc.rarity,
      price: doc.price,
      payoutOutpoint: doc.payoutOutpoint,
      listingNonce: doc.listingNonce,
      payoutClaimed: !!doc.payoutClaimed,
      soldAt: doc.soldAt,
    }));

    return NextResponse.json({
      success: true,
      sales: formattedSales,
      count: formattedSales.length,
    });

  } catch (error) {
    console.error('Error fetching my-sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    );
  }
}
