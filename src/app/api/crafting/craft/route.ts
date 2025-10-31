import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo } from '@/lib/mongodb';
import { getRecipeById } from '@/lib/recipe-table';
import { getLootItemById } from '@/lib/loot-table';
import { publicKeyToGradient } from '@/utils/publicKeyToColor';

/**
 * POST /api/crafting/craft
 * Crafts an item from a recipe
 * Body: { recipeId: string }
 *
 * Process:
 * 1. Validate recipe exists
 * 2. Check player has required materials
 * 3. Remove materials from inventory (MongoDB transaction)
 * 4. Add crafted item to inventory
 * 5. Return success
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
    const { recipeId } = body;

    if (!recipeId) {
      return NextResponse.json({ error: 'Recipe ID required' }, { status: 400 });
    }

    // Get recipe
    const recipe = getRecipeById(recipeId);
    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    const { client, userInventoryCollection, playerStatsCollection } = await connectToMongo();

    // Start MongoDB transaction
    const session = client.startSession();

    try {
      let result;

      await session.withTransaction(async () => {
        // Check player level requirement
        const playerStats = await playerStatsCollection.findOne({ userId }, { session });
        if (!playerStats) {
          throw new Error('Player stats not found');
        }

        if (recipe.unlocksAtLevel && playerStats.level < recipe.unlocksAtLevel) {
          throw new Error(`Requires level ${recipe.unlocksAtLevel}`);
        }

        // Get player's materials (only type: 'material' items)
        const allInventoryItems = await userInventoryCollection
          .find({ userId }, { session })
          .toArray();

        // Count materials by lootTableId
        const materialCounts = new Map<string, any[]>();
        allInventoryItems.forEach(item => {
          const lootItem = getLootItemById(item.lootTableId);
          if (lootItem && lootItem.type === 'material') {
            if (!materialCounts.has(item.lootTableId)) {
              materialCounts.set(item.lootTableId, []);
            }
            materialCounts.get(item.lootTableId)!.push(item);
          }
        });

        // Check if player has enough materials
        for (const requirement of recipe.requiredMaterials) {
          const playerItems = materialCounts.get(requirement.lootTableId) || [];
          if (playerItems.length < requirement.quantity) {
            const materialItem = getLootItemById(requirement.lootTableId);
            throw new Error(
              `Not enough ${materialItem?.name || requirement.lootTableId}. Need ${requirement.quantity}, have ${playerItems.length}`
            );
          }
        }

        // Remove required materials from inventory and track tiers
        const materialTiersUsed: number[] = [];

        for (const requirement of recipe.requiredMaterials) {
          const playerItems = materialCounts.get(requirement.lootTableId)!;
          // Sort by tier ascending to use lowest tier materials first
          const sortedItems = playerItems.sort((a, b) => (a.tier || 1) - (b.tier || 1));
          const itemsToRemove = sortedItems.slice(0, requirement.quantity);

          for (const item of itemsToRemove) {
            // Track the tier of each material used (default to 1 for legacy items)
            materialTiersUsed.push(item.tier || 1);
            await userInventoryCollection.deleteOne({ _id: item._id }, { session });
          }
        }

        // Add crafted item(s) to inventory
        const outputLootItem = getLootItemById(recipe.output.lootTableId);
        if (!outputLootItem) {
          throw new Error('Output item not found in loot table');
        }

        // Determine crafted item tier: use the LOWEST tier material used
        // This ensures tier consistency (can't craft T5 item from T1 materials)
        const lowestMaterialTier = Math.min(...materialTiersUsed);
        const tier = lowestMaterialTier as 1 | 2 | 3 | 4 | 5;

        const borderGradient = publicKeyToGradient(userId);

        // Generate stat roll for crafted items (±20% variation)
        // Only applies to equipment and artifacts, not consumables or materials
        const shouldHaveStatRoll = outputLootItem.type === 'weapon' ||
                                   outputLootItem.type === 'armor' ||
                                   outputLootItem.type === 'artifact';
        const statRoll = shouldHaveStatRoll ? 0.8 + Math.random() * 0.4 : undefined; // 0.8 to 1.2

        // Apply stat roll to equipment stats if applicable
        let rolledStats = undefined;
        if (statRoll && outputLootItem.equipmentStats) {
          rolledStats = {
            damageBonus: outputLootItem.equipmentStats.damageBonus !== undefined
              ? Math.round(outputLootItem.equipmentStats.damageBonus * statRoll)
              : undefined,
            critChance: outputLootItem.equipmentStats.critChance !== undefined
              ? Math.round(outputLootItem.equipmentStats.critChance * statRoll)
              : undefined,
            hpReduction: outputLootItem.equipmentStats.hpReduction !== undefined
              ? Math.round(outputLootItem.equipmentStats.hpReduction * statRoll)
              : undefined,
            maxHpBonus: outputLootItem.equipmentStats.maxHpBonus !== undefined
              ? Math.round(outputLootItem.equipmentStats.maxHpBonus * statRoll)
              : undefined,
            attackSpeed: outputLootItem.equipmentStats.attackSpeed !== undefined
              ? Math.round(outputLootItem.equipmentStats.attackSpeed * statRoll)
              : undefined,
            coinBonus: outputLootItem.equipmentStats.coinBonus !== undefined
              ? Math.round(outputLootItem.equipmentStats.coinBonus * statRoll)
              : undefined
          };
        }

        // Create the specified quantity of output items
        for (let i = 0; i < recipe.output.quantity; i++) {
          const inventoryDoc: any = {
            userId,
            lootTableId: recipe.output.lootTableId,
            itemType: outputLootItem.type,
            tier,
            borderGradient,
            acquiredAt: new Date(),
            crafted: true,
            statRoll: statRoll,
            rolledStats: rolledStats
            // Note: fromMonsterId and fromSessionId are undefined for crafted items
          };

          await userInventoryCollection.insertOne(inventoryDoc, { session });
        }

        result = {
          success: true,
          recipe: {
            recipeId: recipe.recipeId,
            name: recipe.name
          },
          output: {
            itemName: outputLootItem.name,
            quantity: recipe.output.quantity
          },
          statRoll: statRoll,
          rolledStats: rolledStats
        };
      });

      return NextResponse.json(result);
    } catch (error: any) {
      console.error('Error crafting item:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to craft item' },
        { status: 500 }
      );
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Error in crafting route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
