import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { verifyJWT } from '@/utils/jwt';
import { connectToMongo, getClient } from '@/lib/mongodb';
import { getRecipeById } from '@/lib/recipe-table';
import { getLootItemById } from '@/lib/loot-table';
import { publicKeyToGradient } from '@/utils/publicKeyToColor';

/**
 * POST /api/crafting/craft
 * Crafts an item from a recipe
 * Body: { recipeId: string, selectedMaterialIds: string[] }
 *
 * Process:
 * 1. Validate recipe exists
 * 2. Validate selected materials (ownership, match requirements)
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
    const { recipeId, selectedMaterialIds } = body;

    if (!recipeId) {
      return NextResponse.json({ error: 'Recipe ID required' }, { status: 400 });
    }

    if (!selectedMaterialIds || !Array.isArray(selectedMaterialIds) || selectedMaterialIds.length === 0) {
      return NextResponse.json({ error: 'Selected materials required' }, { status: 400 });
    }

    // Convert string IDs to ObjectIds
    let materialObjectIds: ObjectId[];
    try {
      materialObjectIds = selectedMaterialIds.map(id => new ObjectId(id));
    } catch (error) {
      return NextResponse.json({ error: 'Invalid material IDs' }, { status: 400 });
    }

    // Get recipe
    const recipe = getRecipeById(recipeId);
    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    const { userInventoryCollection, playerStatsCollection } = await connectToMongo();

    // Start MongoDB transaction
    const client = await getClient();
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

        // Fetch selected materials from inventory
        const selectedMaterials = await userInventoryCollection
          .find({ _id: { $in: materialObjectIds }, userId }, { session })
          .toArray();

        // Verify all materials exist and belong to user
        if (selectedMaterials.length !== materialObjectIds.length) {
          throw new Error('Some selected materials do not exist or do not belong to you');
        }

        // Verify selected materials match recipe requirements
        const materialCounts = new Map<string, number>();
        selectedMaterials.forEach(item => {
          const count = materialCounts.get(item.lootTableId) || 0;
          materialCounts.set(item.lootTableId, count + 1);
        });

        // Check each requirement
        for (const requirement of recipe.requiredMaterials) {
          const count = materialCounts.get(requirement.lootTableId) || 0;
          if (count !== requirement.quantity) {
            const materialItem = getLootItemById(requirement.lootTableId);
            throw new Error(
              `Invalid materials selected. Need exactly ${requirement.quantity}x ${materialItem?.name || requirement.lootTableId}`
            );
          }
        }

        // Track tiers and empowerment of selected materials
        const materialTiersUsed: number[] = [];
        const materialsEmpowered: boolean[] = [];

        for (const material of selectedMaterials) {
          materialTiersUsed.push(material.tier || 1);
          materialsEmpowered.push(material.isEmpowered === true);
        }

        // Delete selected materials from inventory
        await userInventoryCollection.deleteMany(
          { _id: { $in: materialObjectIds } },
          { session }
        );

        // Add crafted item(s) to inventory
        const outputLootItem = getLootItemById(recipe.output.lootTableId);
        if (!outputLootItem) {
          throw new Error('Output item not found in loot table');
        }

        // Determine crafted item tier: use the LOWEST tier material used
        // This ensures tier consistency (can't craft T5 item from T1 materials)
        const lowestMaterialTier = Math.min(...materialTiersUsed);
        const tier = lowestMaterialTier as 1 | 2 | 3 | 4 | 5;

        // Check if ALL materials used were empowered
        // If true, the crafted item inherits empowered status (+20% stats)
        const allMaterialsEmpowered = materialsEmpowered.length > 0 && materialsEmpowered.every(e => e === true);

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
            defense: outputLootItem.equipmentStats.defense !== undefined
              ? Math.round(outputLootItem.equipmentStats.defense * statRoll)
              : undefined,
            maxHpBonus: outputLootItem.equipmentStats.maxHpBonus !== undefined
              ? Math.round(outputLootItem.equipmentStats.maxHpBonus * statRoll)
              : undefined,
            attackSpeed: outputLootItem.equipmentStats.attackSpeed !== undefined
              ? Math.round(outputLootItem.equipmentStats.attackSpeed * statRoll)
              : undefined,
            coinBonus: outputLootItem.equipmentStats.coinBonus !== undefined
              ? Math.round(outputLootItem.equipmentStats.coinBonus * statRoll)
              : undefined,
            healBonus: outputLootItem.equipmentStats.healBonus !== undefined
              ? Math.round(outputLootItem.equipmentStats.healBonus * statRoll)
              : undefined,
            lifesteal: outputLootItem.equipmentStats.lifesteal !== undefined
              ? Math.round(outputLootItem.equipmentStats.lifesteal * statRoll)
              : undefined,
            defensiveLifesteal: outputLootItem.equipmentStats.defensiveLifesteal !== undefined
              ? Math.round(outputLootItem.equipmentStats.defensiveLifesteal * statRoll)
              : undefined,
            thorns: outputLootItem.equipmentStats.thorns !== undefined
              ? Math.round(outputLootItem.equipmentStats.thorns * statRoll)
              : undefined,
            autoClickRate: outputLootItem.equipmentStats.autoClickRate !== undefined
              ? Math.round(outputLootItem.equipmentStats.autoClickRate * statRoll * 100) / 100 // Preserve decimals for autoClickRate
              : undefined,
            fireResistance: outputLootItem.equipmentStats.fireResistance !== undefined
              ? Math.round(outputLootItem.equipmentStats.fireResistance * statRoll)
              : undefined,
            poisonResistance: outputLootItem.equipmentStats.poisonResistance !== undefined
              ? Math.round(outputLootItem.equipmentStats.poisonResistance * statRoll)
              : undefined,
            bleedResistance: outputLootItem.equipmentStats.bleedResistance !== undefined
              ? Math.round(outputLootItem.equipmentStats.bleedResistance * statRoll)
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
            rolledStats: rolledStats,
            isEmpowered: allMaterialsEmpowered // Inherit empowered status if all materials were empowered
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
          rolledStats: rolledStats,
          isEmpowered: allMaterialsEmpowered
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
