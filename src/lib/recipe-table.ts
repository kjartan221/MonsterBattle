/**
 * Crafting Recipe System
 *
 * Defines all crafting recipes in the game.
 * Players can combine materials to create weapons, armor, consumables, and artifacts.
 */

export interface MaterialRequirement {
  lootTableId: string; // Reference to loot-table.ts item
  quantity: number;
}

export interface CraftingOutput {
  lootTableId: string; // Reference to loot-table.ts item
  quantity: number;
  tier?: number; // Optional tier for tiered items (1-5)
}

export interface CraftingRecipe {
  recipeId: string;
  name: string;
  description: string;
  icon: string;
  category: 'weapon' | 'armor' | 'consumable' | 'artifact';
  requiredMaterials: MaterialRequirement[];
  output: CraftingOutput;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocksAtLevel?: number; // Optional level requirement
}

// ============================
// WEAPON RECIPES
// ============================

const WEAPON_RECIPES: CraftingRecipe[] = [
  {
    recipeId: 'craft_wooden_sword',
    name: 'Wooden Sword',
    description: 'A basic training sword',
    icon: '🗡️',
    category: 'weapon',
    requiredMaterials: [
      { lootTableId: 'common_wood', quantity: 5 },
      { lootTableId: 'common_leather', quantity: 2 }
    ],
    output: { lootTableId: 'common_dagger', quantity: 1, tier: 1 },
    rarity: 'common'
  },
  {
    recipeId: 'craft_iron_sword',
    name: 'Iron Sword',
    description: 'A reliable steel blade',
    icon: '⚔️',
    category: 'weapon',
    requiredMaterials: [
      { lootTableId: 'rare_steel', quantity: 4 },
      { lootTableId: 'common_wood', quantity: 3 },
      { lootTableId: 'common_leather', quantity: 2 }
    ],
    output: { lootTableId: 'silver_sword', quantity: 1, tier: 1 },
    rarity: 'rare',
    unlocksAtLevel: 3
  },
  {
    recipeId: 'craft_hunters_dagger',
    name: 'Hunter\'s Dagger',
    description: 'Sharp blade for quick strikes',
    icon: '🗡️',
    category: 'weapon',
    requiredMaterials: [
      { lootTableId: 'wolf_fang', quantity: 3 },
      { lootTableId: 'rare_steel', quantity: 2 },
      { lootTableId: 'wolf_pelt', quantity: 1 }
    ],
    output: { lootTableId: 'hunter_dagger', quantity: 1, tier: 1 },
    rarity: 'rare',
    unlocksAtLevel: 2
  },
  {
    recipeId: 'craft_flame_sword',
    name: 'Flame Sword',
    description: 'Blade wreathed in eternal fire',
    icon: '🔥',
    category: 'weapon',
    requiredMaterials: [
      { lootTableId: 'fire_essence', quantity: 5 },
      { lootTableId: 'rare_steel', quantity: 10 },
      { lootTableId: 'ember_core', quantity: 3 },
      { lootTableId: 'dragon_scale', quantity: 2 }
    ],
    output: { lootTableId: 'flame_sword', quantity: 1, tier: 2 },
    rarity: 'epic',
    unlocksAtLevel: 8
  },
  {
    recipeId: 'craft_venom_blade',
    name: 'Venom Blade',
    description: 'Coated with deadly poison',
    icon: '🗡️',
    category: 'weapon',
    requiredMaterials: [
      { lootTableId: 'viper_fang', quantity: 5 },
      { lootTableId: 'scorpion_tail', quantity: 3 },
      { lootTableId: 'rare_steel', quantity: 4 }
    ],
    output: { lootTableId: 'venom_dagger', quantity: 1, tier: 1 },
    rarity: 'rare',
    unlocksAtLevel: 4
  }
];

// ============================
// ARMOR RECIPES
// ============================

const ARMOR_RECIPES: CraftingRecipe[] = [
  {
    recipeId: 'craft_leather_vest',
    name: 'Leather Vest',
    description: 'Basic protective gear',
    icon: '🧥',
    category: 'armor',
    requiredMaterials: [
      { lootTableId: 'wolf_pelt', quantity: 4 },
      { lootTableId: 'common_leather', quantity: 3 }
    ],
    output: { lootTableId: 'leather_vest', quantity: 1, tier: 1 },
    rarity: 'common'
  },
  {
    recipeId: 'craft_heavy_armor',
    name: 'Heavy Leather Armor',
    description: 'Reinforced protection',
    icon: '🛡️',
    category: 'armor',
    requiredMaterials: [
      { lootTableId: 'boar_hide', quantity: 6 },
      { lootTableId: 'rare_steel', quantity: 4 },
      { lootTableId: 'common_leather', quantity: 5 }
    ],
    output: { lootTableId: 'heavy_armor', quantity: 1, tier: 1 },
    rarity: 'rare',
    unlocksAtLevel: 3
  },
  {
    recipeId: 'craft_desert_wraps',
    name: 'Desert Wraps',
    description: 'Protects from heat and venom',
    icon: '🧣',
    category: 'armor',
    requiredMaterials: [
      { lootTableId: 'snake_skin', quantity: 5 },
      { lootTableId: 'common_cloth', quantity: 8 }
    ],
    output: { lootTableId: 'desert_cloth', quantity: 1, tier: 1 },
    rarity: 'common',
    unlocksAtLevel: 2
  },
  {
    recipeId: 'craft_dragon_armor',
    name: 'Dragon Scale Armor',
    description: 'Nearly impenetrable defense',
    icon: '🛡️',
    category: 'armor',
    requiredMaterials: [
      { lootTableId: 'dragon_scale', quantity: 15 },
      { lootTableId: 'dragon_fang', quantity: 5 },
      { lootTableId: 'rare_steel', quantity: 10 },
      { lootTableId: 'troll_hide', quantity: 5 }
    ],
    output: { lootTableId: 'dragon_armor', quantity: 1, tier: 2 },
    rarity: 'epic',
    unlocksAtLevel: 10
  },
  {
    recipeId: 'craft_guardian_armor',
    name: 'Guardian\'s Bark Armor',
    description: 'Nature\'s protection',
    icon: '🛡️',
    category: 'armor',
    requiredMaterials: [
      { lootTableId: 'ancient_bark', quantity: 10 },
      { lootTableId: 'living_wood', quantity: 8 },
      { lootTableId: 'treant_heart', quantity: 1 }
    ],
    output: { lootTableId: 'guardian_armor', quantity: 1, tier: 2 },
    rarity: 'epic',
    unlocksAtLevel: 7
  }
];

// ============================
// CONSUMABLE RECIPES
// ============================

const CONSUMABLE_RECIPES: CraftingRecipe[] = [
  {
    recipeId: 'craft_health_potion',
    name: 'Health Potion',
    description: 'Restores 20 HP',
    icon: '🧪',
    category: 'consumable',
    requiredMaterials: [
      { lootTableId: 'common_bone', quantity: 2 },
      { lootTableId: 'pixie_dust', quantity: 1 }
    ],
    output: { lootTableId: 'common_potion', quantity: 3 },
    rarity: 'common'
  },
  {
    recipeId: 'craft_forest_potion',
    name: 'Forest Potion',
    description: 'Restore 30 HP',
    icon: '🧪',
    category: 'consumable',
    requiredMaterials: [
      { lootTableId: 'pixie_dust', quantity: 3 },
      { lootTableId: 'fairy_wing', quantity: 2 },
      { lootTableId: 'common_bone', quantity: 4 }
    ],
    output: { lootTableId: 'health_potion_forest', quantity: 2 },
    rarity: 'rare',
    unlocksAtLevel: 3
  },
  {
    recipeId: 'craft_grand_elixir',
    name: 'Grand Elixir',
    description: 'Restores 50 HP',
    icon: '⚗️',
    category: 'consumable',
    requiredMaterials: [
      { lootTableId: 'troll_blood', quantity: 3 },
      { lootTableId: 'rare_gem', quantity: 2 },
      { lootTableId: 'pixie_dust', quantity: 5 }
    ],
    output: { lootTableId: 'rare_elixir', quantity: 2 },
    rarity: 'rare',
    unlocksAtLevel: 5
  },
  {
    recipeId: 'craft_antidote',
    name: 'Antidote Vial',
    description: 'Remove poison/burn effects',
    icon: '🧪',
    category: 'consumable',
    requiredMaterials: [
      { lootTableId: 'viper_fang', quantity: 2 },
      { lootTableId: 'pixie_dust', quantity: 1 }
    ],
    output: { lootTableId: 'antidote', quantity: 3 },
    rarity: 'common',
    unlocksAtLevel: 2
  },
  {
    recipeId: 'craft_mana_elixir',
    name: 'Mana Elixir',
    description: 'Restore 20 HP + remove 1 debuff',
    icon: '⚗️',
    category: 'consumable',
    requiredMaterials: [
      { lootTableId: 'ectoplasm', quantity: 3 },
      { lootTableId: 'spirit_crystal', quantity: 1 },
      { lootTableId: 'pixie_dust', quantity: 2 }
    ],
    output: { lootTableId: 'mana_elixir', quantity: 2 },
    rarity: 'rare',
    unlocksAtLevel: 4
  },
  {
    recipeId: 'craft_elixir_immortality',
    name: 'Elixir of Immortality',
    description: 'Restores 100 HP',
    icon: '🧬',
    category: 'consumable',
    requiredMaterials: [
      { lootTableId: 'dragon_heart', quantity: 1 },
      { lootTableId: 'vampire_blood', quantity: 5 },
      { lootTableId: 'rare_gem', quantity: 10 },
      { lootTableId: 'phoenix_feather', quantity: 1 }
    ],
    output: { lootTableId: 'elixir_immortality', quantity: 1 },
    rarity: 'legendary',
    unlocksAtLevel: 15
  }
];

// ============================
// ARTIFACT RECIPES
// ============================

const ARTIFACT_RECIPES: CraftingRecipe[] = [
  {
    recipeId: 'craft_lucky_coin',
    name: 'Lucky Coin',
    description: 'Increases coin drops',
    icon: '🪙',
    category: 'artifact',
    requiredMaterials: [
      { lootTableId: 'common_coin', quantity: 10 },
      { lootTableId: 'rare_gem', quantity: 1 }
    ],
    output: { lootTableId: 'rare_key', quantity: 1, tier: 1 },
    rarity: 'rare',
    unlocksAtLevel: 2
  },
  {
    recipeId: 'craft_speed_boots',
    name: 'Sandstorm Boots',
    description: 'Swift as the desert wind',
    icon: '👟',
    category: 'artifact',
    requiredMaterials: [
      { lootTableId: 'snake_skin', quantity: 4 },
      { lootTableId: 'common_leather', quantity: 6 },
      { lootTableId: 'pixie_dust', quantity: 2 }
    ],
    output: { lootTableId: 'speed_boots', quantity: 1, tier: 1 },
    rarity: 'rare',
    unlocksAtLevel: 3
  },
  {
    recipeId: 'craft_charging_boots',
    name: 'Charging Boots',
    description: 'Enables quick strikes',
    icon: '👢',
    category: 'artifact',
    requiredMaterials: [
      { lootTableId: 'boar_tusk', quantity: 4 },
      { lootTableId: 'boar_hide', quantity: 3 },
      { lootTableId: 'common_leather', quantity: 5 }
    ],
    output: { lootTableId: 'charging_boots', quantity: 1, tier: 1 },
    rarity: 'rare',
    unlocksAtLevel: 3
  },
  {
    recipeId: 'craft_enchanted_ring',
    name: 'Enchanted Ring',
    description: 'Hums with magical energy',
    icon: '💍',
    category: 'artifact',
    requiredMaterials: [
      { lootTableId: 'rare_gem', quantity: 3 },
      { lootTableId: 'ectoplasm', quantity: 5 },
      { lootTableId: 'rare_steel', quantity: 2 }
    ],
    output: { lootTableId: 'enchanted_ring', quantity: 1, tier: 1 },
    rarity: 'rare',
    unlocksAtLevel: 4
  },
  {
    recipeId: 'craft_sprite_ring',
    name: 'Sprite Ring',
    description: 'Enhances agility',
    icon: '💍',
    category: 'artifact',
    requiredMaterials: [
      { lootTableId: 'fairy_wing', quantity: 5 },
      { lootTableId: 'pixie_dust', quantity: 8 },
      { lootTableId: 'rare_gem', quantity: 2 }
    ],
    output: { lootTableId: 'sprite_ring', quantity: 1, tier: 1 },
    rarity: 'rare',
    unlocksAtLevel: 3
  },
  {
    recipeId: 'craft_blood_chalice',
    name: 'Blood Chalice',
    description: 'An ancient vampiric relic',
    icon: '🏆',
    category: 'artifact',
    requiredMaterials: [
      { lootTableId: 'vampire_blood', quantity: 10 },
      { lootTableId: 'dragon_heart', quantity: 1 },
      { lootTableId: 'rare_gem', quantity: 5 },
      { lootTableId: 'rare_steel', quantity: 8 }
    ],
    output: { lootTableId: 'blood_chalice', quantity: 1, tier: 2 },
    rarity: 'epic',
    unlocksAtLevel: 9
  }
];

// ============================
// CRAFT-ONLY RECIPES
// These recipes create items that CANNOT be obtained from monster drops
// ============================

const CRAFT_ONLY_WEAPON_RECIPES: CraftingRecipe[] = [
  {
    recipeId: 'craft_masterwork_blade',
    name: 'Masterwork Blade',
    description: 'Perfectly balanced steel sword',
    icon: '⚔️',
    category: 'weapon',
    requiredMaterials: [
      { lootTableId: 'rare_steel', quantity: 12 },
      { lootTableId: 'rare_gem', quantity: 3 },
      { lootTableId: 'wolf_fang', quantity: 6 }
    ],
    output: { lootTableId: 'masterwork_blade', quantity: 1 },
    rarity: 'rare',
    unlocksAtLevel: 6
  },
  {
    recipeId: 'craft_alchemists_staff',
    name: 'Alchemist\'s Staff',
    description: 'Infused with magical properties',
    icon: '🪄',
    category: 'weapon',
    requiredMaterials: [
      { lootTableId: 'living_wood', quantity: 10 },
      { lootTableId: 'spirit_crystal', quantity: 5 },
      { lootTableId: 'ectoplasm', quantity: 8 },
      { lootTableId: 'rare_gem', quantity: 4 }
    ],
    output: { lootTableId: 'alchemists_staff', quantity: 1 },
    rarity: 'epic',
    unlocksAtLevel: 10
  },
  {
    recipeId: 'craft_vorpal_blade',
    name: 'Vorpal Blade',
    description: 'Legendary blade that strikes true',
    icon: '🗡️',
    category: 'weapon',
    requiredMaterials: [
      { lootTableId: 'dragon_fang', quantity: 10 },
      { lootTableId: 'demon_horn', quantity: 5 },
      { lootTableId: 'rare_steel', quantity: 20 },
      { lootTableId: 'soul_stone', quantity: 1 }
    ],
    output: { lootTableId: 'vorpal_blade', quantity: 1 },
    rarity: 'legendary',
    unlocksAtLevel: 18
  }
];

const CRAFT_ONLY_ARMOR_RECIPES: CraftingRecipe[] = [
  {
    recipeId: 'craft_reinforced_steel_plate',
    name: 'Reinforced Steel Plate',
    description: 'Heavy armor with exceptional protection',
    icon: '🛡️',
    category: 'armor',
    requiredMaterials: [
      { lootTableId: 'rare_steel', quantity: 15 },
      { lootTableId: 'troll_hide', quantity: 8 },
      { lootTableId: 'boar_hide', quantity: 10 }
    ],
    output: { lootTableId: 'reinforced_steel_plate', quantity: 1 },
    rarity: 'rare',
    unlocksAtLevel: 6
  },
  {
    recipeId: 'craft_enchanted_silk_robes',
    name: 'Enchanted Silk Robes',
    description: 'Light armor imbued with protective magic',
    icon: '🧥',
    category: 'armor',
    requiredMaterials: [
      { lootTableId: 'fairy_wing', quantity: 15 },
      { lootTableId: 'pixie_dust', quantity: 20 },
      { lootTableId: 'spirit_crystal', quantity: 5 },
      { lootTableId: 'common_cloth', quantity: 25 }
    ],
    output: { lootTableId: 'enchanted_silk_robes', quantity: 1 },
    rarity: 'epic',
    unlocksAtLevel: 11
  },
  {
    recipeId: 'craft_titans_armor',
    name: 'Titan\'s Armor',
    description: 'Armor of the ancient giants',
    icon: '🛡️',
    category: 'armor',
    requiredMaterials: [
      { lootTableId: 'dragon_scale', quantity: 30 },
      { lootTableId: 'rare_steel', quantity: 25 },
      { lootTableId: 'treant_heart', quantity: 3 },
      { lootTableId: 'demon_horn', quantity: 5 }
    ],
    output: { lootTableId: 'titans_armor', quantity: 1 },
    rarity: 'legendary',
    unlocksAtLevel: 20
  }
];

const CRAFT_ONLY_CONSUMABLE_RECIPES: CraftingRecipe[] = [
  {
    recipeId: 'craft_concentrated_elixir',
    name: 'Concentrated Elixir',
    description: 'Restores 75 HP',
    icon: '⚗️',
    category: 'consumable',
    requiredMaterials: [
      { lootTableId: 'troll_blood', quantity: 5 },
      { lootTableId: 'vampire_blood', quantity: 3 },
      { lootTableId: 'rare_gem', quantity: 4 },
      { lootTableId: 'pixie_dust', quantity: 10 }
    ],
    output: { lootTableId: 'concentrated_elixir', quantity: 2 },
    rarity: 'rare',
    unlocksAtLevel: 7
  },
  {
    recipeId: 'craft_transmutation_potion',
    name: 'Transmutation Potion',
    description: 'Restores 50 HP + grants 30s damage buff',
    icon: '🧪',
    category: 'consumable',
    requiredMaterials: [
      { lootTableId: 'dragon_heart', quantity: 1 },
      { lootTableId: 'fire_essence', quantity: 10 },
      { lootTableId: 'spirit_crystal', quantity: 5 },
      { lootTableId: 'pixie_dust', quantity: 15 }
    ],
    output: { lootTableId: 'transmutation_potion', quantity: 2 },
    rarity: 'epic',
    unlocksAtLevel: 12
  },
  {
    recipeId: 'craft_phoenix_tear',
    name: 'Phoenix Tear',
    description: 'Fully restores HP',
    icon: '💧',
    category: 'consumable',
    requiredMaterials: [
      { lootTableId: 'phoenix_feather', quantity: 3 },
      { lootTableId: 'dragon_heart', quantity: 2 },
      { lootTableId: 'rare_gem', quantity: 10 },
      { lootTableId: 'vampire_blood', quantity: 10 }
    ],
    output: { lootTableId: 'phoenix_tear', quantity: 1 },
    rarity: 'legendary',
    unlocksAtLevel: 20
  }
];

const CRAFT_ONLY_ARTIFACT_RECIPES: CraftingRecipe[] = [
  {
    recipeId: 'craft_master_craftsman_ring',
    name: 'Master Craftsman\'s Ring',
    description: 'Enhances all combat abilities',
    icon: '💍',
    category: 'artifact',
    requiredMaterials: [
      { lootTableId: 'rare_gem', quantity: 5 },
      { lootTableId: 'rare_steel', quantity: 8 },
      { lootTableId: 'pixie_dust', quantity: 10 }
    ],
    output: { lootTableId: 'master_craftsman_ring', quantity: 1 },
    rarity: 'rare',
    unlocksAtLevel: 6
  },
  {
    recipeId: 'craft_arcane_amplifier',
    name: 'Arcane Amplifier',
    description: 'Boosts magical power',
    icon: '🔮',
    category: 'artifact',
    requiredMaterials: [
      { lootTableId: 'soul_stone', quantity: 1 },
      { lootTableId: 'spirit_crystal', quantity: 8 },
      { lootTableId: 'djinn_essence', quantity: 5 },
      { lootTableId: 'rare_gem', quantity: 10 }
    ],
    output: { lootTableId: 'arcane_amplifier', quantity: 1 },
    rarity: 'epic',
    unlocksAtLevel: 13
  },
  {
    recipeId: 'craft_infinity_amulet',
    name: 'Infinity Amulet',
    description: 'Contains limitless power',
    icon: '🔱',
    category: 'artifact',
    requiredMaterials: [
      { lootTableId: 'soul_stone', quantity: 3 },
      { lootTableId: 'chaos_orb', quantity: 1 },
      { lootTableId: 'phoenix_feather', quantity: 5 },
      { lootTableId: 'rare_gem', quantity: 20 }
    ],
    output: { lootTableId: 'infinity_amulet', quantity: 1 },
    rarity: 'legendary',
    unlocksAtLevel: 25
  }
];

// ============================
// ALL RECIPES
// ============================

const ALL_RECIPES: CraftingRecipe[] = [
  ...WEAPON_RECIPES,
  ...ARMOR_RECIPES,
  ...CONSUMABLE_RECIPES,
  ...ARTIFACT_RECIPES,
  ...CRAFT_ONLY_WEAPON_RECIPES,
  ...CRAFT_ONLY_ARMOR_RECIPES,
  ...CRAFT_ONLY_CONSUMABLE_RECIPES,
  ...CRAFT_ONLY_ARTIFACT_RECIPES
];

// Create a map for quick lookup by recipeId
const RECIPE_MAP = new Map<string, CraftingRecipe>();
ALL_RECIPES.forEach(recipe => {
  RECIPE_MAP.set(recipe.recipeId, recipe);
});

// ============================
// HELPER FUNCTIONS
// ============================

/**
 * Get all crafting recipes
 */
export function getAllRecipes(): CraftingRecipe[] {
  return ALL_RECIPES;
}

/**
 * Get recipes by category
 */
export function getRecipesByCategory(category: 'weapon' | 'armor' | 'consumable' | 'artifact'): CraftingRecipe[] {
  return ALL_RECIPES.filter(recipe => recipe.category === category);
}

/**
 * Get recipe by ID
 */
export function getRecipeById(recipeId: string): CraftingRecipe | undefined {
  return RECIPE_MAP.get(recipeId);
}

/**
 * Get recipes unlocked at or below a specific level
 */
export function getUnlockedRecipes(playerLevel: number): CraftingRecipe[] {
  return ALL_RECIPES.filter(recipe => {
    return !recipe.unlocksAtLevel || recipe.unlocksAtLevel <= playerLevel;
  });
}

/**
 * Get recipes by rarity
 */
export function getRecipesByRarity(rarity: 'common' | 'rare' | 'epic' | 'legendary'): CraftingRecipe[] {
  return ALL_RECIPES.filter(recipe => recipe.rarity === rarity);
}

/**
 * Check if player has enough materials for a recipe
 * Returns { canCraft: boolean, missing: MaterialRequirement[] }
 */
export function checkMaterialsForRecipe(
  recipe: CraftingRecipe,
  playerMaterials: Map<string, number>
): { canCraft: boolean; missing: MaterialRequirement[] } {
  const missing: MaterialRequirement[] = [];

  for (const requirement of recipe.requiredMaterials) {
    const playerQuantity = playerMaterials.get(requirement.lootTableId) || 0;
    if (playerQuantity < requirement.quantity) {
      missing.push({
        lootTableId: requirement.lootTableId,
        quantity: requirement.quantity - playerQuantity
      });
    }
  }

  return {
    canCraft: missing.length === 0,
    missing
  };
}
