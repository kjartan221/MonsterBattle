'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CraftingRecipe, getAllRecipes, getRecipesByCategory } from '@/lib/recipe-table';
import { getLootItemById } from '@/lib/loot-table';
import toast from 'react-hot-toast';
import { colorToRGBA } from '@/utils/publicKeyToColor';

type Category = 'all' | 'weapon' | 'armor' | 'consumable' | 'artifact';

interface MaterialCount {
  lootTableId: string;
  quantity: number;
}

export default function CraftingPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<CraftingRecipe[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [playerMaterials, setPlayerMaterials] = useState<Map<string, number>>(new Map());
  const [playerLevel, setPlayerLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [crafting, setCrafting] = useState<string | null>(null); // recipeId being crafted

  useEffect(() => {
    loadRecipesAndMaterials();
  }, [selectedCategory]);

  const loadRecipesAndMaterials = async () => {
    try {
      setLoading(true);

      // Fetch player materials (only type: 'material' items)
      const materialsResponse = await fetch('/api/inventory/get');
      const materialsData = await materialsResponse.json();

      if (materialsResponse.ok && materialsData.success) {
        // Count materials by lootTableId
        const materialMap = new Map<string, number>();
        materialsData.inventory.forEach((item: any) => {
          const lootItem = getLootItemById(item.lootId);
          if (lootItem && lootItem.type === 'material') {
            const count = materialMap.get(item.lootId) || 0;
            materialMap.set(item.lootId, count + 1);
          }
        });
        setPlayerMaterials(materialMap);
      }

      // Fetch player stats for level
      const statsResponse = await fetch('/api/player-stats');
      const statsData = await statsResponse.json();
      if (statsResponse.ok && statsData.playerStats) {
        setPlayerLevel(statsData.playerStats.level);
      }

      // Load recipes based on category
      const allRecipes = getAllRecipes();
      const filteredRecipes = selectedCategory === 'all'
        ? allRecipes
        : getRecipesByCategory(selectedCategory);

      setRecipes(filteredRecipes);
    } catch (error) {
      console.error('Error loading crafting data:', error);
      toast.error('Failed to load crafting data');
    } finally {
      setLoading(false);
    }
  };

  const handleCraft = async (recipe: CraftingRecipe) => {
    // Check level requirement
    if (recipe.unlocksAtLevel && playerLevel < recipe.unlocksAtLevel) {
      toast.error(`Requires level ${recipe.unlocksAtLevel}!`);
      return;
    }

    // Check materials
    const missingMaterials: string[] = [];
    for (const req of recipe.requiredMaterials) {
      const playerQuantity = playerMaterials.get(req.lootTableId) || 0;
      if (playerQuantity < req.quantity) {
        const lootItem = getLootItemById(req.lootTableId);
        missingMaterials.push(`${lootItem?.name || req.lootTableId} (need ${req.quantity - playerQuantity} more)`);
      }
    }

    if (missingMaterials.length > 0) {
      toast.error(`Missing materials: ${missingMaterials.join(', ')}`);
      return;
    }

    // Craft the item
    setCrafting(recipe.recipeId);
    try {
      const response = await fetch('/api/crafting/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId: recipe.recipeId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const outputItem = getLootItemById(recipe.output.lootTableId);
        toast.success(`Crafted ${recipe.output.quantity}x ${outputItem?.name || 'item'}!`, {
          icon: '🔨',
          duration: 3000
        });
        // Reload materials
        await loadRecipesAndMaterials();
      } else {
        toast.error(data.error || 'Failed to craft item');
      }
    } catch (error) {
      console.error('Error crafting item:', error);
      toast.error('Failed to craft item');
    } finally {
      setCrafting(null);
    }
  };

  const canCraftRecipe = (recipe: CraftingRecipe): boolean => {
    if (recipe.unlocksAtLevel && playerLevel < recipe.unlocksAtLevel) {
      return false;
    }

    for (const req of recipe.requiredMaterials) {
      const playerQuantity = playerMaterials.get(req.lootTableId) || 0;
      if (playerQuantity < req.quantity) {
        return false;
      }
    }

    return true;
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'text-gray-400';
      case 'rare': return 'text-blue-400';
      case 'epic': return 'text-purple-400';
      case 'legendary': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getRarityBgGradient = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'from-gray-900/80 to-gray-800/80';
      case 'rare': return 'from-blue-900/50 to-blue-800/50';
      case 'epic': return 'from-purple-900/50 to-purple-800/50';
      case 'legendary': return 'from-yellow-900/50 to-yellow-800/50';
      default: return 'from-gray-900/80 to-gray-800/80';
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading crafting recipes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">🔨 Crafting Workshop</h1>
            <p className="text-gray-400">Combine materials to create powerful items</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/battle')}
              className="px-4 py-2 bg-green-900/50 text-green-200 border border-green-700 rounded hover:bg-green-800/70 transition-colors"
            >
              ⚔️ Battle
            </button>
            <button
              onClick={() => router.push('/inventory')}
              className="px-4 py-2 bg-blue-900/50 text-blue-200 border border-blue-700 rounded hover:bg-blue-800/70 transition-colors"
            >
              🎒 Inventory
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-900/50 text-gray-200 border border-gray-700 rounded hover:bg-gray-800/70 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-4">
          {(['all', 'weapon', 'armor', 'consumable', 'artifact'] as Category[]).map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2 rounded-t transition-colors ${
                selectedCategory === category
                  ? 'bg-purple-900/50 text-purple-200 border-t border-l border-r border-purple-700'
                  : 'bg-gray-900/30 text-gray-400 hover:bg-gray-800/50'
              }`}
            >
              {category === 'all' ? '🗂️ All' : ''}
              {category === 'weapon' ? '⚔️ Weapons' : ''}
              {category === 'armor' ? '🛡️ Armor' : ''}
              {category === 'consumable' ? '🧪 Consumables' : ''}
              {category === 'artifact' ? '💍 Artifacts' : ''}
            </button>
          ))}
        </div>

        {/* Recipes Grid */}
        {recipes.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <div className="text-6xl mb-4">🔨</div>
            <div className="text-xl">No recipes available in this category</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map(recipe => {
              const outputItem = getLootItemById(recipe.output.lootTableId);
              const canCraft = canCraftRecipe(recipe);
              const isLocked = recipe.unlocksAtLevel && playerLevel < recipe.unlocksAtLevel;

              const isCrafting = crafting === recipe.recipeId;
              const isDisabled = Boolean(!canCraft || isCrafting || isLocked);

              return (
                <div
                  key={recipe.recipeId}
                  className={`
                    relative p-5 rounded-lg border-2 transition-all
                    bg-gradient-to-br ${getRarityBgGradient(recipe.rarity)}
                    ${canCraft && !isLocked ? 'border-purple-500 hover:border-purple-400' : 'border-gray-700'}
                    ${isLocked ? 'opacity-60' : ''}
                  `}
                >
                  {/* Lock Badge */}
                  {isLocked && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-red-900/80 text-red-200 rounded text-xs border border-red-700">
                      🔒 Level {recipe.unlocksAtLevel}
                    </div>
                  )}

                  {/* Recipe Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">{recipe.icon}</span>
                    <div className="flex-1">
                      <div className={`text-lg font-bold ${getRarityColor(recipe.rarity)}`}>
                        {recipe.name}
                      </div>
                      <div className="text-xs text-gray-400">{recipe.description}</div>
                    </div>
                  </div>

                  {/* Materials Required */}
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-2">Materials Required:</div>
                    <div className="space-y-1">
                      {recipe.requiredMaterials.map(req => {
                        const material = getLootItemById(req.lootTableId);
                        const playerQuantity = playerMaterials.get(req.lootTableId) || 0;
                        const hasEnough = playerQuantity >= req.quantity;

                        return (
                          <div key={req.lootTableId} className="flex justify-between text-sm">
                            <span className={hasEnough ? 'text-green-400' : 'text-red-400'}>
                              {material?.icon} {material?.name}
                            </span>
                            <span className={hasEnough ? 'text-green-400' : 'text-red-400'}>
                              {playerQuantity} / {req.quantity}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Output */}
                  <div className="mb-4 pt-3 border-t border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Creates:</div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{outputItem?.icon}</span>
                      <span className="text-base font-semibold text-white">
                        {recipe.output.quantity}x {outputItem?.name}
                      </span>
                    </div>
                  </div>

                  {/* Craft Button */}
                  <button
                    onClick={() => handleCraft(recipe)}
                    disabled={isDisabled}
                    className={`
                      w-full py-2 rounded font-semibold transition-all
                      ${canCraft && !isLocked
                        ? 'bg-purple-900/70 text-purple-200 border border-purple-700 hover:bg-purple-800/90'
                        : 'bg-gray-800/50 text-gray-500 border border-gray-700 cursor-not-allowed'
                      }
                      ${isCrafting ? 'opacity-50' : ''}
                    `}
                  >
                    {isCrafting ? '🔨 Crafting...' : isLocked ? '🔒 Locked' : canCraft ? '🔨 Craft' : '❌ Missing Materials'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
