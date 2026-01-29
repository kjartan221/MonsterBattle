import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo, getClient } from '@/lib/mongodb';
import { getLootItemById } from '@/lib/loot-table';

/**
 * POST /api/crafting/refine
 * Rerolls stat quality on crafted equipment using a Refine Stone
 * Body: { targetItemId: string, refineStoneId: string }
 *
 * Process:
 * 1. Validate both items exist and belong to user
 * 2. Validate target is crafted equipment with statRoll
 * 3. Validate refine stone is actually a refine_stone
 * 4. Generate new stat roll (0.8-1.2)
 * 5. Recalculate rolledStats
 * 6. Delete refine stone
 * 7. Update target item
 * 8. Return new stats
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    // Get request body
    const body = await request.json();
    const { targetItemId, refineStoneId } = body;

    if (!targetItemId || !refineStoneId) {
      return NextResponse.json({ error: 'Target item ID and refine stone ID required' }, { status: 400 });
    }

    // Convert string IDs to ObjectIds
    let targetObjectId: ObjectId;
    let refineStoneObjectId: ObjectId;
    try {
      targetObjectId = new ObjectId(targetItemId);
      refineStoneObjectId = new ObjectId(refineStoneId);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid item IDs' }, { status: 400 });
    }

    const { userInventoryCollection } = await connectToMongo();

    // Start MongoDB transaction
    const client = await getClient();
    const session = client.startSession();

    try {
      let result;

      await session.withTransaction(async () => {
        // Fetch both items from inventory
        const [targetItem, refineStone] = await Promise.all([
          userInventoryCollection.findOne({ _id: targetObjectId, userId }, { session }),
          userInventoryCollection.findOne({ _id: refineStoneObjectId, userId }, { session })
        ]);

        // Validate target item exists
        if (!targetItem) {
          throw new Error('Target item not found or does not belong to you');
        }

        // Validate refine stone exists
        if (!refineStone) {
          throw new Error('Refine stone not found or does not belong to you');
        }

        // Validate refine stone is actually a refine_stone
        if (refineStone.lootTableId !== 'refine_stone') {
          throw new Error('Selected item is not a Refine Stone');
        }

        // Validate target is crafted equipment
        if (!targetItem.crafted) {
          throw new Error('Target item is not crafted equipment');
        }

        if (targetItem.statRoll === undefined) {
          throw new Error('Target item does not have a stat roll to refine');
        }

        // Get loot item template for target
        const targetLootItem = getLootItemById(targetItem.lootTableId);
        if (!targetLootItem || !targetLootItem.equipmentStats) {
          throw new Error('Target item has no equipment stats');
        }

        // Generate new stat roll (0.8 to 1.2)
        const rolledStatRoll = 0.8 + Math.random() * 0.4;
        const oldStatRoll = targetItem.statRoll;

        // If new roll is higher, use it. Otherwise, add +0.01 to current roll
        // This ensures guaranteed progress even with bad luck
        let finalStatRoll: number;
        let wasUpgraded: boolean;

        if (rolledStatRoll > oldStatRoll) {
          // Good roll - use the new higher value
          finalStatRoll = Math.min(1.2, rolledStatRoll); // Cap at max 1.2
          wasUpgraded = true;
        } else {
          // Bad roll - add +0.01 instead
          finalStatRoll = Math.min(1.2, oldStatRoll + 0.01); // Cap at max 1.2
          wasUpgraded = finalStatRoll > oldStatRoll; // Only true if not already at cap
        }

        // Recalculate rolledStats with final stat roll
        const finalRolledStats = {
          damageBonus: targetLootItem.equipmentStats.damageBonus !== undefined
            ? Math.round(targetLootItem.equipmentStats.damageBonus * finalStatRoll)
            : undefined,
          critChance: targetLootItem.equipmentStats.critChance !== undefined
            ? Math.round(targetLootItem.equipmentStats.critChance * finalStatRoll)
            : undefined,
          defense: targetLootItem.equipmentStats.defense !== undefined
            ? Math.round(targetLootItem.equipmentStats.defense * finalStatRoll)
            : undefined,
          maxHpBonus: targetLootItem.equipmentStats.maxHpBonus !== undefined
            ? Math.round(targetLootItem.equipmentStats.maxHpBonus * finalStatRoll)
            : undefined,
          attackSpeed: targetLootItem.equipmentStats.attackSpeed !== undefined
            ? Math.round(targetLootItem.equipmentStats.attackSpeed * finalStatRoll)
            : undefined,
          coinBonus: targetLootItem.equipmentStats.coinBonus !== undefined
            ? Math.round(targetLootItem.equipmentStats.coinBonus * finalStatRoll)
            : undefined,
          healBonus: targetLootItem.equipmentStats.healBonus !== undefined
            ? Math.round(targetLootItem.equipmentStats.healBonus * finalStatRoll)
            : undefined,
          lifesteal: targetLootItem.equipmentStats.lifesteal !== undefined
            ? Math.round(targetLootItem.equipmentStats.lifesteal * finalStatRoll)
            : undefined,
          defensiveLifesteal: targetLootItem.equipmentStats.defensiveLifesteal !== undefined
            ? Math.round(targetLootItem.equipmentStats.defensiveLifesteal * finalStatRoll)
            : undefined,
          thorns: targetLootItem.equipmentStats.thorns !== undefined
            ? Math.round(targetLootItem.equipmentStats.thorns * finalStatRoll)
            : undefined,
          autoClickRate: targetLootItem.equipmentStats.autoClickRate !== undefined
            ? Math.round(targetLootItem.equipmentStats.autoClickRate * finalStatRoll * 100) / 100 // Preserve decimals
            : undefined,
          fireResistance: targetLootItem.equipmentStats.fireResistance !== undefined
            ? Math.round(targetLootItem.equipmentStats.fireResistance * finalStatRoll)
            : undefined,
          poisonResistance: targetLootItem.equipmentStats.poisonResistance !== undefined
            ? Math.round(targetLootItem.equipmentStats.poisonResistance * finalStatRoll)
            : undefined,
          bleedResistance: targetLootItem.equipmentStats.bleedResistance !== undefined
            ? Math.round(targetLootItem.equipmentStats.bleedResistance * finalStatRoll)
            : undefined
        };

        // Delete refine stone from inventory
        await userInventoryCollection.deleteOne(
          { _id: refineStoneObjectId },
          { session }
        );

        // Update target item with final statRoll and rolledStats (only if upgraded)
        if (wasUpgraded) {
          await userInventoryCollection.updateOne(
            { _id: targetObjectId },
            {
              $set: {
                statRoll: finalStatRoll,
                rolledStats: finalRolledStats
              }
            },
            { session }
          );
        }

        result = {
          success: true,
          targetItem: {
            _id: targetItemId,
            name: targetLootItem.name
          },
          oldStatRoll: oldStatRoll,
          rolledStatRoll: rolledStatRoll,
          finalStatRoll: finalStatRoll,
          wasUpgraded: wasUpgraded,
          newRolledStats: wasUpgraded ? finalRolledStats : targetItem.rolledStats
        };
      });

      return NextResponse.json(result);
    } catch (error: any) {
      console.error('Error refining item:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to refine item' },
        { status: 500 }
      );
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Error in refining route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
