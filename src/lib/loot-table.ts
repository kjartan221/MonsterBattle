export interface EquipmentStats {
  damageBonus?: number;     // For weapons - adds to player damage (clicks per attack)
  critChance?: number;       // For weapons - increases crit chance %
  hpReduction?: number;      // For armor - reduces monster damage %
  maxHpBonus?: number;       // For armor - increases max HP
  attackSpeed?: number;      // For accessories - increases attack speed %
  coinBonus?: number;        // For accessories - increases coin drops %
}

export interface LootItem {
  lootId: string;
  name: string;
  icon: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact';
  equipmentStats?: EquipmentStats; // Optional stats for equippable items
}

// Common Loot (shared across all monsters)
const COMMON_LOOT: LootItem[] = [
  { lootId: 'common_coin', name: 'Gold Coin', icon: '🪙', description: 'A simple gold coin', rarity: 'common', type: 'material' },
  { lootId: 'common_potion', name: 'Health Potion', icon: '🧪', description: 'Restores a small amount of health', rarity: 'common', type: 'consumable' },
  { lootId: 'common_bone', name: 'Monster Bone', icon: '🦴', description: 'A basic crafting material', rarity: 'common', type: 'material' },
  { lootId: 'common_leather', name: 'Leather Scraps', icon: '🧵', description: 'Worn leather pieces', rarity: 'common', type: 'material' },
  { lootId: 'common_dagger', name: 'Rusty Dagger', icon: '🗡️', description: 'A worn but functional blade', rarity: 'common', type: 'weapon', equipmentStats: { damageBonus: 1 } },
  { lootId: 'common_bread', name: 'Stale Bread', icon: '🍞', description: 'Hard but edible', rarity: 'common', type: 'consumable' },
  { lootId: 'common_cloth', name: 'Torn Cloth', icon: '🧶', description: 'Shabby fabric material', rarity: 'common', type: 'material' },
  { lootId: 'common_wood', name: 'Wooden Plank', icon: '🪵', description: 'Rough lumber for crafting', rarity: 'common', type: 'material' },
  { lootId: 'common_stone', name: 'Stone Fragment', icon: '🪨', description: 'A piece of rock', rarity: 'common', type: 'material' },
];

// Rare Loot (shared across all monsters, but less common than COMMON_LOOT)
const RARE_LOOT: LootItem[] = [
  { lootId: 'rare_gem', name: 'Precious Gem', icon: '💎', description: 'A valuable gemstone', rarity: 'rare', type: 'material' },
  { lootId: 'rare_elixir', name: 'Grand Elixir', icon: '⚗️', description: 'A powerful restorative potion', rarity: 'rare', type: 'consumable' },
  { lootId: 'rare_steel', name: 'Steel Ingot', icon: '🔩', description: 'High-quality metal', rarity: 'rare', type: 'material' },
  { lootId: 'rare_scroll', name: 'Magic Scroll', icon: '📜', description: 'Contains a powerful spell', rarity: 'rare', type: 'consumable' },
  { lootId: 'rare_amulet', name: 'Mystic Amulet', icon: '📿', description: 'Enhances magical abilities', rarity: 'rare', type: 'artifact', equipmentStats: { attackSpeed: 10 } },
  { lootId: 'rare_key', name: 'Ancient Key', icon: '🗝️', description: 'Opens mysterious locks', rarity: 'rare', type: 'artifact', equipmentStats: { coinBonus: 15 } },
  { lootId: 'rare_map', name: 'Treasure Map', icon: '🗺️', description: 'Leads to hidden riches', rarity: 'rare', type: 'artifact', equipmentStats: { coinBonus: 20 } },
];

// Monster-Specific Loot (only drops from specific monsters)

// Goblin & Orc Specific Loot (Common Monsters)
const GOBLIN_ORC_SPECIFIC: LootItem[] = [
  { lootId: 'goblin_ear', name: 'Goblin Ear', icon: '👂', description: 'Proof of goblin slaying', rarity: 'common', type: 'material' },
  { lootId: 'orc_tusk', name: 'Orc Tusk', icon: '🦷', description: 'A trophy from battle', rarity: 'common', type: 'material' },
  { lootId: 'tribal_mask', name: 'Tribal Mask', icon: '🎭', description: 'A crude ceremonial mask', rarity: 'rare', type: 'artifact', equipmentStats: { critChance: 5 } },
  { lootId: 'war_paint', name: 'War Paint', icon: '🎨', description: 'Used in tribal rituals', rarity: 'common', type: 'material' },
];

// Zombie Specific Loot (Common Monster)
const ZOMBIE_SPECIFIC: LootItem[] = [
  { lootId: 'rotten_flesh', name: 'Rotten Flesh', icon: '🥩', description: 'Decaying organic matter', rarity: 'common', type: 'material' },
  { lootId: 'zombie_brain', name: 'Zombie Brain', icon: '🧠', description: 'Surprisingly intact', rarity: 'rare', type: 'material' },
  { lootId: 'infected_blood', name: 'Infected Blood', icon: '🩸', description: 'Carries the zombie virus', rarity: 'rare', type: 'material' },
];

// Troll & Ghost Specific Loot (Rare Monsters)
const TROLL_GHOST_SPECIFIC: LootItem[] = [
  { lootId: 'troll_blood', name: 'Troll Blood', icon: '🩸', description: 'Has regenerative properties', rarity: 'rare', type: 'material' },
  { lootId: 'ectoplasm', name: 'Ectoplasm', icon: '💧', description: 'Ghostly essence', rarity: 'rare', type: 'material' },
  { lootId: 'silver_sword', name: 'Silver Sword', icon: '⚔️', description: 'Effective against the undead', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 5 } },
  { lootId: 'spirit_crystal', name: 'Spirit Crystal', icon: '💎', description: 'Contains trapped souls', rarity: 'rare', type: 'artifact', equipmentStats: { maxHpBonus: 10 } },
  { lootId: 'enchanted_ring', name: 'Enchanted Ring', icon: '💍', description: 'Hums with magical energy', rarity: 'rare', type: 'artifact', equipmentStats: { coinBonus: 25, critChance: 3 } },
  { lootId: 'mana_potion', name: 'Mana Potion', icon: '⚗️', description: 'Restores magical power', rarity: 'rare', type: 'consumable' },
  { lootId: 'spectral_cloak', name: 'Spectral Cloak', icon: '🧥', description: 'Grants temporary invisibility', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 10, maxHpBonus: 15 } },
  { lootId: 'troll_hide', name: 'Troll Hide', icon: '🛡️', description: 'Tough and durable leather', rarity: 'rare', type: 'material' },
];

// Dragon & Vampire Specific Loot (Epic Monsters)
const DRAGON_VAMPIRE_SPECIFIC: LootItem[] = [
  { lootId: 'dragon_scale', name: 'Dragon Scale', icon: '🐲', description: 'Incredibly tough armor material', rarity: 'epic', type: 'material' },
  { lootId: 'dragon_fang', name: 'Dragon Fang', icon: '🦷', description: 'A massive tooth from an ancient beast', rarity: 'epic', type: 'material' },
  { lootId: 'vampire_blood', name: 'Vampire Blood', icon: '🩸', description: 'Grants dark powers', rarity: 'epic', type: 'material' },
  { lootId: 'dragon_heart', name: 'Dragon Heart', icon: '❤️', description: 'Still warm and beating', rarity: 'epic', type: 'material' },
  { lootId: 'flame_sword', name: 'Flame Sword', icon: '🔥', description: 'Blade wreathed in eternal fire', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 4, critChance: 10 } },
  { lootId: 'blood_chalice', name: 'Blood Chalice', icon: '🏆', description: 'An ancient vampiric relic', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 25, coinBonus: 30 } },
  { lootId: 'dragon_armor', name: 'Dragon Scale Armor', icon: '🛡️', description: 'Nearly impenetrable defense', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 15, maxHpBonus: 30 } },
  { lootId: 'wing_fragment', name: 'Dragon Wing Fragment', icon: '🪽', description: 'Enables short flight', rarity: 'legendary', type: 'material' },
  { lootId: 'elixir_immortality', name: 'Elixir of Immortality', icon: '🧬', description: 'Grants extended life', rarity: 'legendary', type: 'consumable' },
  { lootId: 'crimson_crown', name: 'Crimson Crown', icon: '👑', description: 'Symbol of vampiric royalty', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 50, critChance: 15, coinBonus: 50 } },
];

// Demon Specific Loot (Legendary Monster)
const DEMON_SPECIFIC: LootItem[] = [
  { lootId: 'demon_horn', name: 'Demon Horn', icon: '🦖', description: 'Radiates malevolent energy', rarity: 'legendary', type: 'material' },
  { lootId: 'soul_stone', name: 'Soul Stone', icon: '💠', description: 'Contains thousands of trapped souls', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 100, critChance: 20, attackSpeed: 15 } },
  { lootId: 'infernal_blade', name: 'Infernal Blade', icon: '🗡️', description: 'Forged in the fires of hell', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 8, critChance: 20 } },
  { lootId: 'demon_eye', name: 'Demon Eye', icon: '👁️', description: 'Sees through all illusions', rarity: 'legendary', type: 'material' },
  { lootId: 'hellfire_staff', name: 'Hellfire Staff', icon: '🪄', description: 'Commands the flames of perdition', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 10, attackSpeed: 20 } },
  { lootId: 'void_armor', name: 'Void Armor', icon: '🛡️', description: 'Forged from pure darkness', rarity: 'legendary', type: 'armor', equipmentStats: { hpReduction: 25, maxHpBonus: 75 } },
  { lootId: 'demonic_tome', name: 'Demonic Tome', icon: '📖', description: 'Contains forbidden knowledge', rarity: 'legendary', type: 'artifact', equipmentStats: { critChance: 25, attackSpeed: 15 } },
  { lootId: 'chaos_orb', name: 'Chaos Orb', icon: '🔮', description: 'Reality bends around it', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 5, maxHpBonus: 50, coinBonus: 100 } },
  { lootId: 'dark_halo', name: 'Dark Halo', icon: '⭕', description: 'Corrupts all who wear it', rarity: 'legendary', type: 'artifact', equipmentStats: { critChance: 30, hpReduction: 10 } },
  { lootId: 'phoenix_feather', name: 'Phoenix Feather', icon: '🪶', description: 'Grants resurrection', rarity: 'legendary', type: 'material' },
];

// Monster name to monster-specific loot mapping
const MONSTER_SPECIFIC_LOOT: Record<string, LootItem[]> = {
  'Goblin': GOBLIN_ORC_SPECIFIC,
  'Orc': GOBLIN_ORC_SPECIFIC,
  'Zombie': ZOMBIE_SPECIFIC,
  'Troll': TROLL_GHOST_SPECIFIC,
  'Ghost': TROLL_GHOST_SPECIFIC,
  'Dragon': DRAGON_VAMPIRE_SPECIFIC,
  'Vampire': DRAGON_VAMPIRE_SPECIFIC,
  'Demon': DEMON_SPECIFIC,
};

// Create a map of all loot items for easy lookup by lootId
const ALL_LOOT_ITEMS_MAP = new Map<string, LootItem>();

// Populate the map with all loot items
[...COMMON_LOOT, ...RARE_LOOT, ...GOBLIN_ORC_SPECIFIC, ...ZOMBIE_SPECIFIC,
 ...TROLL_GHOST_SPECIFIC, ...DRAGON_VAMPIRE_SPECIFIC, ...DEMON_SPECIFIC].forEach(item => {
  ALL_LOOT_ITEMS_MAP.set(item.lootId, item);
});

/**
 * Get a loot item by its lootId
 */
export function getLootItemById(lootId: string): LootItem | undefined {
  return ALL_LOOT_ITEMS_MAP.get(lootId);
}

/**
 * Get multiple loot items by their lootIds
 */
export function getLootItemsByIds(lootIds: string[]): LootItem[] {
  return lootIds.map(id => getLootItemById(id)).filter((item): item is LootItem => item !== undefined);
}

/**
 * Randomly select N items from various loot pools
 * Guarantees at least 1 monster-specific item (can be more if lucky)
 * Fills remaining slots with COMMON_LOOT or RARE_LOOT
 * @param monsterName - The name of the monster that dropped the loot
 * @param count - Number of items to generate
 * @param winStreak - Current win streak (increases rare drop chance)
 */
export function getRandomLoot(monsterName: string, count: number = 3, winStreak: number = 0): LootItem[] {
  const monsterLoot = MONSTER_SPECIFIC_LOOT[monsterName] || [];
  const results: LootItem[] = [];

  if (monsterLoot.length === 0) {
    // Fallback: if no monster-specific loot, just return common/rare loot
    const fallbackPool = [...COMMON_LOOT, ...RARE_LOOT];
    const shuffled = [...fallbackPool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Step 1: Determine how many monster-specific items to include (1-3 possible)
  // Base chances: 70% for 1 item, 25% for 2 items, 5% for 3 items
  // Streak multiplier increases chances for 2 and 3 items
  const streakMultiplier = 1.0 + Math.min(winStreak * 0.03, 0.30); // 1.0x to 1.3x

  const chance2Items = Math.min(0.25 * streakMultiplier, 0.40); // 25% → 32.5% at 10 streak
  const chance3Items = Math.min(0.05 * streakMultiplier, 0.10); // 5% → 6.5% at 10 streak
  const chance1Item = 1 - chance2Items - chance3Items; // Remaining probability

  const random = Math.random();
  let monsterItemCount: number;
  if (random < chance1Item) {
    monsterItemCount = 1;
  } else if (random < chance1Item + chance2Items) {
    monsterItemCount = 2;
  } else {
    monsterItemCount = Math.min(3, count); // Can get all 3 from monster if lucky!
  }

  // Step 2: Pick random monster-specific items
  const shuffledMonsterLoot = [...monsterLoot].sort(() => Math.random() - 0.5);
  const selectedMonsterLoot = shuffledMonsterLoot.slice(0, Math.min(monsterItemCount, monsterLoot.length));
  results.push(...selectedMonsterLoot);

  // Step 3: Fill remaining slots with common or rare loot
  const remainingSlots = count - results.length;
  if (remainingSlots > 0) {
    // Shuffle both pools once
    const shuffledCommon = [...COMMON_LOOT].sort(() => Math.random() - 0.5);
    const shuffledRare = [...RARE_LOOT].sort(() => Math.random() - 0.5);

    let commonIndex = 0;
    let rareIndex = 0;

    // Calculate drop chance multiplier based on win streak
    // Multiplicative bonus: +3% per win streak (max +30% at 10 streak)
    // Example: 30% base rare → 39% at 10 streak (1.3x multiplier)
    const streakMultiplier = 1.0 + Math.min(winStreak * 0.03, 0.30); // 1.0x to 1.3x
    const rareChance = Math.min(0.30 * streakMultiplier, 0.95); // 30% base, capped at 95%
    const commonChance = 1 - rareChance;

    // For each remaining slot, decide if it's common or rare based on streak
    for (let i = 0; i < remainingSlots; i++) {
      const isCommon = Math.random() < commonChance;

      if (isCommon && commonIndex < shuffledCommon.length) {
        results.push(shuffledCommon[commonIndex]);
        commonIndex++;
      } else if (!isCommon && rareIndex < shuffledRare.length) {
        results.push(shuffledRare[rareIndex]);
        rareIndex++;
      } else if (commonIndex < shuffledCommon.length) {
        // Fallback to common if rare pool is exhausted
        results.push(shuffledCommon[commonIndex]);
        commonIndex++;
      } else if (rareIndex < shuffledRare.length) {
        // Fallback to rare if common pool is exhausted
        results.push(shuffledRare[rareIndex]);
        rareIndex++;
      }
    }
  }

  return results;
}
