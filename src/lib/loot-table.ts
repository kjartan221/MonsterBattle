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
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact' | 'spell_scroll';
  equipmentStats?: EquipmentStats; // Optional stats for equippable items
  spellData?: SpellData; // Optional spell data for spell scrolls
  cooldown?: number; // Optional cooldown for consumables
  healing?: number; // Optional healing amount for consumables (HP restored)
}

export interface SpellData {
  spellId: string;
  spellName: string;
  cooldown: number; // in seconds
  damage?: number;
  healing?: number;
  duration?: number; // in seconds (for buffs/debuffs)
  effect?: string; // description of special effects
}

// Common Loot (shared across all monsters)
const COMMON_LOOT: LootItem[] = [
  { lootId: 'common_coin', name: 'Gold Coin', icon: '🪙', description: 'A simple gold coin', rarity: 'common', type: 'material' },
  { lootId: 'common_potion', name: 'Health Potion', icon: '🧪', description: 'Restores 20 HP', rarity: 'common', type: 'consumable', cooldown: 5, healing: 20 },
  { lootId: 'common_bone', name: 'Monster Bone', icon: '🦴', description: 'A basic crafting material', rarity: 'common', type: 'material' },
  { lootId: 'common_leather', name: 'Leather Scraps', icon: '🧵', description: 'Worn leather pieces', rarity: 'common', type: 'material' },
  { lootId: 'common_dagger', name: 'Rusty Dagger', icon: '🗡️', description: 'A worn but functional blade', rarity: 'common', type: 'weapon', equipmentStats: { damageBonus: 1 } },
  { lootId: 'common_bread', name: 'Stale Bread', icon: '🍞', description: 'Restores 15 HP', rarity: 'common', type: 'consumable', cooldown: 5, healing: 15 },
  { lootId: 'common_cloth', name: 'Torn Cloth', icon: '🧶', description: 'Shabby fabric material', rarity: 'common', type: 'material' },
  { lootId: 'common_wood', name: 'Wooden Plank', icon: '🪵', description: 'Rough lumber for crafting', rarity: 'common', type: 'material' },
  { lootId: 'common_stone', name: 'Stone Fragment', icon: '🪨', description: 'A piece of rock', rarity: 'common', type: 'material' },
];

// Rare Loot (shared across all monsters, but less common than COMMON_LOOT)
const RARE_LOOT: LootItem[] = [
  { lootId: 'rare_gem', name: 'Precious Gem', icon: '💎', description: 'A valuable gemstone', rarity: 'rare', type: 'material' },
  { lootId: 'rare_elixir', name: 'Grand Elixir', icon: '⚗️', description: 'Restores 50 HP', rarity: 'rare', type: 'consumable', cooldown: 10, healing: 50 },
  { lootId: 'rare_steel', name: 'Steel Ingot', icon: '🔩', description: 'High-quality metal', rarity: 'rare', type: 'material' },
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
  { lootId: 'mana_potion', name: 'Mana Potion', icon: '⚗️', description: 'Restores 25 HP', rarity: 'rare', type: 'consumable', cooldown: 8, healing: 25 },
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
  { lootId: 'elixir_immortality', name: 'Elixir of Immortality', icon: '🧬', description: 'Restores 100 HP', rarity: 'legendary', type: 'consumable', cooldown: 20, healing: 100 },
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

// === BIOME-SPECIFIC LOOT (Phase 1.5 & 1.6) ===

// Forest Wolf & Bandit Raccoon Specific Loot (Forest Tier 1, Common Monsters)
const FOREST_WOLF_SPECIFIC: LootItem[] = [
  { lootId: 'wolf_pelt', name: 'Wolf Pelt', icon: '🐺', description: 'Soft and warm fur', rarity: 'common', type: 'material' },
  { lootId: 'wolf_fang', name: 'Wolf Fang', icon: '🦷', description: 'Sharp canine tooth', rarity: 'common', type: 'material' },
  { lootId: 'leather_vest', name: 'Leather Vest', icon: '🧥', description: 'Basic protective gear', rarity: 'common', type: 'armor', equipmentStats: { hpReduction: 5 } },
  { lootId: 'hunter_dagger', name: 'Hunter\'s Dagger', icon: '🗡️', description: 'A reliable hunting blade', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 3 } },
  { lootId: 'stolen_coin', name: 'Stolen Gold', icon: '🪙', description: 'Ill-gotten gains', rarity: 'common', type: 'material' },
  { lootId: 'bandana', name: 'Bandit Bandana', icon: '🏴', description: 'Worn by forest outlaws', rarity: 'rare', type: 'artifact', equipmentStats: { coinBonus: 10 } },
  { lootId: 'lockpick_set', name: 'Lockpicks', icon: '🔓', description: 'Opens treasure chests', rarity: 'common', type: 'material' },
];

// Wild Boar Specific Loot (Forest Tier 1, Rare Monster)
const WILD_BOAR_SPECIFIC: LootItem[] = [
  { lootId: 'boar_hide', name: 'Boar Hide', icon: '🐗', description: 'Thick and tough leather', rarity: 'rare', type: 'material' },
  { lootId: 'boar_tusk', name: 'Boar Tusk', icon: '🦷', description: 'Curved ivory horn', rarity: 'rare', type: 'material' },
  { lootId: 'heavy_armor', name: 'Heavy Leather Armor', icon: '🛡️', description: 'Reinforced protection', rarity: 'rare', type: 'armor', equipmentStats: { hpReduction: 10, maxHpBonus: 10 } },
  { lootId: 'charging_boots', name: 'Charging Boots', icon: '👢', description: 'Enables quick strikes', rarity: 'rare', type: 'artifact', equipmentStats: { attackSpeed: 5 } },
  { lootId: 'health_potion_forest', name: 'Forest Potion', icon: '🧪', description: 'Restore 30 HP', rarity: 'rare', type: 'consumable', cooldown: 7, healing: 30 },
];

// Forest Sprite Specific Loot (Forest Tier 1, Rare Monster)
const FOREST_SPRITE_SPECIFIC: LootItem[] = [
  { lootId: 'pixie_dust', name: 'Pixie Dust', icon: '✨', description: 'Sparkles with magic', rarity: 'rare', type: 'material' },
  { lootId: 'fairy_wing', name: 'Fairy Wing', icon: '🧚', description: 'Translucent and delicate', rarity: 'rare', type: 'material' },
  { lootId: 'nature_staff', name: 'Nature Staff', icon: '🪄', description: 'Channel nature\'s power', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 5 } },
  { lootId: 'sprite_ring', name: 'Sprite Ring', icon: '💍', description: 'Enhances agility', rarity: 'rare', type: 'artifact', equipmentStats: { attackSpeed: 8 } },
  { lootId: 'mana_elixir', name: 'Mana Elixir', icon: '⚗️', description: 'Restore 20 HP + remove 1 debuff', rarity: 'rare', type: 'consumable', cooldown: 10, healing: 20 },
];

// Treant Guardian Specific Loot (Forest Tier 2, Epic Boss)
const TREANT_GUARDIAN_SPECIFIC: LootItem[] = [
  { lootId: 'ancient_bark', name: 'Ancient Bark', icon: '🌳', description: 'Infused with life energy', rarity: 'epic', type: 'material' },
  { lootId: 'living_wood', name: 'Living Wood', icon: '🪵', description: 'Pulses with vitality', rarity: 'epic', type: 'material' },
  { lootId: 'treant_heart', name: 'Treant Heart', icon: '❤️', description: 'Still beating with nature magic', rarity: 'epic', type: 'material' },
  { lootId: 'guardian_armor', name: 'Guardian\'s Bark Armor', icon: '🛡️', description: 'Nature\'s protection', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 15, maxHpBonus: 20 } },
  { lootId: 'nature_blade', name: 'Nature\'s Wrath', icon: '🗡️', description: 'Living weapon', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 5, critChance: 8 } },
  { lootId: 'forest_crown', name: 'Crown of the Forest', icon: '👑', description: 'Blessed by the ancients', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 15, coinBonus: 10 } },
  { lootId: 'spell_scroll_heal', name: 'Minor Heal Scroll', icon: '📜', description: 'Unlocks Minor Heal spell', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'minor_heal', spellName: 'Minor Heal', cooldown: 15, healing: 20 } },
];

// Dire Wolf Alpha Specific Loot (Forest Tier 1+, Epic Mini-Boss)
const DIRE_WOLF_ALPHA_SPECIFIC: LootItem[] = [
  { lootId: 'alpha_pelt', name: 'Alpha Wolf Pelt', icon: '🐺', description: 'Thick fur from a pack leader', rarity: 'epic', type: 'material' },
  { lootId: 'alpha_fang', name: 'Alpha Wolf Fang', icon: '🦷', description: 'Legendary canine tooth', rarity: 'epic', type: 'material' },
  { lootId: 'pack_emblem', name: 'Pack Leader Emblem', icon: '🐺', description: 'Symbol of wolf pack dominance', rarity: 'epic', type: 'material' },
  { lootId: 'alpha_blade', name: 'Alpha Fang Sword', icon: '⚔️', description: 'Forged from the alpha\'s fang', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 5, critChance: 11, attackSpeed: 8 } },
  { lootId: 'alpha_armor', name: 'Alpha Pelt Armor', icon: '🛡️', description: 'Legendary wolf hide protection', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 14, maxHpBonus: 18 } },
  { lootId: 'pack_totem', name: 'Pack Leader\'s Totem', icon: '🗿', description: 'Commands respect from all beasts', rarity: 'epic', type: 'artifact', equipmentStats: { damageBonus: 3, critChance: 9, coinBonus: 15 } },
];

// Ancient Ent Specific Loot (Forest Tier 3+, Legendary Boss)
const ANCIENT_ENT_SPECIFIC: LootItem[] = [
  { lootId: 'eternal_wood', name: 'Eternal Wood', icon: '🌲', description: 'Wood that never decays', rarity: 'legendary', type: 'material' },
  { lootId: 'ancient_sap', name: 'Ancient Sap', icon: '💧', description: 'Millennium-old tree sap', rarity: 'legendary', type: 'material' },
  { lootId: 'millennium_root', name: 'Millennium Root', icon: '🌿', description: 'Root from the oldest tree', rarity: 'legendary', type: 'material' },
  { lootId: 'natures_judgment', name: 'Nature\'s Judgment', icon: '🪄', description: 'Ancient staff of the forest', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 9, critChance: 18, attackSpeed: 10 } },
  { lootId: 'ancient_bark_plate', name: 'Ancient Bark Plate', icon: '🛡️', description: 'Millennium-old protection', rarity: 'legendary', type: 'armor', equipmentStats: { hpReduction: 24, maxHpBonus: 55 } },
  { lootId: 'heart_of_forest', name: 'Heart of the Forest', icon: '💚', description: 'Essence of all nature', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 45, critChance: 14, coinBonus: 65 } },
  { lootId: 'spell_scroll_earthquake', name: 'Earthquake Scroll', icon: '📜', description: 'Unlocks Earthquake spell', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'earthquake', spellName: 'Earthquake', cooldown: 45, damage: 140, effect: 'Massive earth damage' } },
];

// Sand Scorpion Specific Loot (Desert Tier 1, Common Monster)
const SAND_SCORPION_SPECIFIC: LootItem[] = [
  { lootId: 'scorpion_tail', name: 'Scorpion Tail', icon: '🦂', description: 'Contains venom sac', rarity: 'common', type: 'material' },
  { lootId: 'chitin_shard', name: 'Chitin Shard', icon: '🪨', description: 'Hard exoskeleton piece', rarity: 'common', type: 'material' },
  { lootId: 'desert_cloth', name: 'Desert Wraps', icon: '🧣', description: 'Protects from heat and venom', rarity: 'common', type: 'armor', equipmentStats: { hpReduction: 6 } },
  { lootId: 'venom_dagger', name: 'Venom Blade', icon: '🗡️', description: 'Coated with poison', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2 } },
];

// Desert Viper Specific Loot (Desert Tier 1, Common Monster)
const DESERT_VIPER_SPECIFIC: LootItem[] = [
  { lootId: 'snake_skin', name: 'Snake Skin', icon: '🐍', description: 'Shed scales', rarity: 'common', type: 'material' },
  { lootId: 'viper_fang', name: 'Viper Fang', icon: '🦷', description: 'Drips with venom', rarity: 'rare', type: 'material' },
  { lootId: 'speed_boots', name: 'Sandstorm Boots', icon: '👟', description: 'Swift as the desert wind', rarity: 'rare', type: 'artifact', equipmentStats: { attackSpeed: 8 } },
  { lootId: 'antidote', name: 'Antidote Vial', icon: '🧪', description: 'Remove poison/burn effects', rarity: 'common', type: 'consumable', cooldown: 6 },
];

// Fire Elemental Specific Loot (Desert Tier 1, Rare Monster)
const FIRE_ELEMENTAL_SPECIFIC: LootItem[] = [
  { lootId: 'fire_essence', name: 'Fire Essence', icon: '🔥', description: 'Captured flame', rarity: 'rare', type: 'material' },
  { lootId: 'ember_core', name: 'Ember Core', icon: '⚫', description: 'Heart of a fire spirit', rarity: 'rare', type: 'material' },
  { lootId: 'flame_sword_desert', name: 'Flame Sword', icon: '🗡️', description: 'Blade wreathed in fire', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 4, critChance: 10 } },
  { lootId: 'fire_resist_charm', name: 'Flame Ward Amulet', icon: '📿', description: 'Protects from fire', rarity: 'rare', type: 'artifact', equipmentStats: { maxHpBonus: 5 } },
  { lootId: 'fire_potion', name: 'Fire Resistance Potion', icon: '🧪', description: 'Immune to burn for 30s', rarity: 'rare', type: 'consumable', cooldown: 12 },
];

// Sand Djinn Specific Loot (Desert Tier 1, Epic Mini-Boss)
const SAND_DJINN_SPECIFIC: LootItem[] = [
  { lootId: 'djinn_essence', name: 'Djinn Essence', icon: '🧞', description: 'Bottled magic', rarity: 'epic', type: 'material' },
  { lootId: 'desert_gem', name: 'Desert Sapphire', icon: '💎', description: 'Shimmers with heat', rarity: 'epic', type: 'material' },
  { lootId: 'djinn_scimitar', name: 'Djinn\'s Scimitar', icon: '⚔️', description: 'Curved blade of legend', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 5, critChance: 12, attackSpeed: 5 } },
  { lootId: 'sand_armor', name: 'Djinn\'s Sand Armor', icon: '🛡️', description: 'Flows like sand', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 12, maxHpBonus: 15 } },
  { lootId: 'mirage_cloak', name: 'Mirage Cloak', icon: '🧥', description: 'Bends light around wearer', rarity: 'epic', type: 'artifact', equipmentStats: { coinBonus: 15 } },
  { lootId: 'spell_scroll_fireball', name: 'Fireball Scroll', icon: '📜', description: 'Unlocks Fireball spell', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'fireball', spellName: 'Fireball', cooldown: 30, damage: 80, effect: 'Fire damage' } },
];

// Sandstone Golem Specific Loot (Desert Tier 2+, Epic Mini-Boss)
const SANDSTONE_GOLEM_SPECIFIC: LootItem[] = [
  { lootId: 'sandstone_core', name: 'Sandstone Core', icon: '🗿', description: 'Ancient stone heart', rarity: 'epic', type: 'material' },
  { lootId: 'hardened_sand', name: 'Hardened Sand', icon: '🪨', description: 'Compressed over millennia', rarity: 'epic', type: 'material' },
  { lootId: 'stone_fist', name: 'Stone Fist Fragment', icon: '✊', description: 'Piece of the golem\'s weapon', rarity: 'epic', type: 'material' },
  { lootId: 'golem_hammer', name: 'Golem\'s Wrath Hammer', icon: '🔨', description: 'Crushes with ancient power', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 10, maxHpBonus: 15 } },
  { lootId: 'sandstone_armor', name: 'Sandstone Plate', icon: '🛡️', description: 'Impenetrable stone armor', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 16, maxHpBonus: 25 } },
  { lootId: 'desert_stone_amulet', name: 'Desert Stone Amulet', icon: '📿', description: 'Grants earth\'s endurance', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 20, hpReduction: 8 } },
];

// Desert Phoenix Specific Loot (Desert Tier 3+, Legendary Boss)
const DESERT_PHOENIX_SPECIFIC: LootItem[] = [
  { lootId: 'phoenix_ash', name: 'Phoenix Ash', icon: '🦅', description: 'Ashes of rebirth', rarity: 'legendary', type: 'material' },
  { lootId: 'rebirth_flame', name: 'Rebirth Flame', icon: '🔥', description: 'Never-ending fire', rarity: 'legendary', type: 'material' },
  { lootId: 'phoenix_plume', name: 'Phoenix Plume', icon: '🪶', description: 'Feather of resurrection', rarity: 'legendary', type: 'material' },
  { lootId: 'phoenix_talon', name: 'Phoenix Talon Blade', icon: '⚔️', description: 'Forged from eternal flames', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 11, critChance: 22, attackSpeed: 14 } },
  { lootId: 'phoenix_plate', name: 'Phoenix Flame Plate', icon: '🛡️', description: 'Armor of rebirth', rarity: 'legendary', type: 'armor', equipmentStats: { hpReduction: 26, maxHpBonus: 65 } },
  { lootId: 'eternal_flame_orb', name: 'Eternal Flame Orb', icon: '🔮', description: 'Contains the phoenix\'s power', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 5, maxHpBonus: 50, critChance: 18, coinBonus: 75 } },
  { lootId: 'spell_scroll_phoenix_fire', name: 'Phoenix Fire Scroll', icon: '📜', description: 'Unlocks Phoenix Fire spell', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'phoenix_fire', spellName: 'Phoenix Fire', cooldown: 50, damage: 180, effect: 'Massive fire damage + burn' } },
];

// === OCEAN BIOME LOOT (Phase 2.4) ===

// Coral Crab Specific Loot (Ocean Tier 1, Common Monster)
const CORAL_CRAB_SPECIFIC: LootItem[] = [
  { lootId: 'coral_fragment', name: 'Coral Fragment', icon: '🪸', description: 'Hardened sea coral', rarity: 'common', type: 'material' },
  { lootId: 'crab_shell', name: 'Crab Shell', icon: '🦀', description: 'Natural armor', rarity: 'common', type: 'material' },
  { lootId: 'crab_claw', name: 'Crab Claw', icon: '🦀', description: 'Pincer weapon', rarity: 'common', type: 'material' },
  { lootId: 'shell_armor', name: 'Shell Armor', icon: '🛡️', description: 'Reinforced with crab shell', rarity: 'common', type: 'armor', equipmentStats: { hpReduction: 7, maxHpBonus: 5 } },
  { lootId: 'coral_dagger', name: 'Coral Dagger', icon: '🗡️', description: 'Sharp as a reef', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 3 } },
];

// Giant Jellyfish Specific Loot (Ocean Tier 1, Common Monster)
const GIANT_JELLYFISH_SPECIFIC: LootItem[] = [
  { lootId: 'jellyfish_tentacle', name: 'Jellyfish Tentacle', icon: '🪼', description: 'Stings on contact', rarity: 'common', type: 'material' },
  { lootId: 'bioluminescent_gel', name: 'Bioluminescent Gel', icon: '💧', description: 'Glows in the dark', rarity: 'common', type: 'material' },
  { lootId: 'sea_potion', name: 'Sea Potion', icon: '🧪', description: 'Restores 25 HP', rarity: 'common', type: 'consumable', cooldown: 6, healing: 25 },
  { lootId: 'jelly_armor', name: 'Jellyfish Membrane', icon: '🛡️', description: 'Flexible protection', rarity: 'common', type: 'armor', equipmentStats: { hpReduction: 5, maxHpBonus: 8 } },
  { lootId: 'stinger_whip', name: 'Stinger Whip', icon: '🪢', description: 'Paralyzing strikes', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 1, attackSpeed: 8 } },
];

// Frost Shark Specific Loot (Ocean Tier 1-2, Rare Monster)
const FROST_SHARK_SPECIFIC: LootItem[] = [
  { lootId: 'shark_tooth', name: 'Frost Shark Tooth', icon: '🦈', description: 'Cold as ice', rarity: 'rare', type: 'material' },
  { lootId: 'frozen_scale', name: 'Frozen Scale', icon: '❄️', description: 'Never melts', rarity: 'rare', type: 'material' },
  { lootId: 'shark_fin', name: 'Shark Fin', icon: '🦈', description: 'Razor sharp', rarity: 'rare', type: 'material' },
  { lootId: 'frost_blade', name: 'Frost Blade', icon: '🗡️', description: 'Freezes enemies', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 3, critChance: 7 } },
  { lootId: 'ice_armor', name: 'Frost Guard Armor', icon: '🛡️', description: 'Chills attackers', rarity: 'rare', type: 'armor', equipmentStats: { hpReduction: 11, maxHpBonus: 12 } },
  { lootId: 'frozen_heart', name: 'Frozen Heart', icon: '💙', description: 'Cold to the touch', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 10, critChance: 5 } },
];

// Electric Eel Specific Loot (Ocean Tier 1-2, Rare Monster)
const ELECTRIC_EEL_SPECIFIC: LootItem[] = [
  { lootId: 'electric_organ', name: 'Electric Organ', icon: '⚡', description: 'Stores bioelectricity', rarity: 'rare', type: 'material' },
  { lootId: 'eel_skin', name: 'Eel Skin', icon: '🐍', description: 'Smooth and slippery', rarity: 'rare', type: 'material' },
  { lootId: 'shock_dagger', name: 'Shock Dagger', icon: '🗡️', description: 'Electrifies on contact', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 8 } },
  { lootId: 'storm_amulet', name: 'Storm Amulet', icon: '📿', description: 'Crackles with energy', rarity: 'rare', type: 'artifact', equipmentStats: { attackSpeed: 10, coinBonus: 12 } },
  { lootId: 'lightning_potion', name: 'Lightning Potion', icon: '⚗️', description: 'Temporary speed boost', rarity: 'rare', type: 'consumable', cooldown: 8, healing: 15 },
];

// Sea Serpent Specific Loot (Ocean Tier 1+, Epic Mini-Boss)
const SEA_SERPENT_SPECIFIC: LootItem[] = [
  { lootId: 'serpent_scale', name: 'Serpent Scale', icon: '🐍', description: 'Iridescent and tough', rarity: 'epic', type: 'material' },
  { lootId: 'lightning_core', name: 'Lightning Core', icon: '⚡', description: 'Condensed electricity', rarity: 'epic', type: 'material' },
  { lootId: 'storm_blade', name: 'Storm Blade', icon: '⚔️', description: 'Channels lightning', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 5, critChance: 10, attackSpeed: 8 } },
  { lootId: 'tidal_armor', name: 'Tidal Scale Armor', icon: '🛡️', description: 'Flows like water', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 14, maxHpBonus: 18 } },
  { lootId: 'ocean_crown', name: 'Crown of the Deep', icon: '👑', description: 'Commands the seas', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 20, coinBonus: 15 } },
];

// Kraken Specific Loot (Ocean Tier 2+, Epic Mini-Boss)
const KRAKEN_SPECIFIC: LootItem[] = [
  { lootId: 'kraken_tentacle', name: 'Kraken Tentacle', icon: '🐙', description: 'Massive and powerful', rarity: 'epic', type: 'material' },
  { lootId: 'abyssal_ink', name: 'Abyssal Ink', icon: '💧', description: 'Darkness incarnate', rarity: 'epic', type: 'material' },
  { lootId: 'deep_sea_pearl', name: 'Deep Sea Pearl', icon: '💎', description: 'From the ocean depths', rarity: 'epic', type: 'material' },
  { lootId: 'tentacle_whip', name: 'Kraken\'s Whip', icon: '🪢', description: 'Crushes with tentacle power', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 11, maxHpBonus: 12 } },
  { lootId: 'kraken_armor', name: 'Kraken Scale Armor', icon: '🛡️', description: 'Forged from kraken hide', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 16, maxHpBonus: 22 } },
  { lootId: 'abyssal_amulet', name: 'Abyssal Amulet', icon: '📿', description: 'Commands the deep ocean', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 18, critChance: 8, coinBonus: 18 } },
];

// Leviathan Specific Loot (Ocean Tier 3+, Legendary Boss)
const LEVIATHAN_SPECIFIC: LootItem[] = [
  { lootId: 'leviathan_scale', name: 'Leviathan Scale', icon: '🐋', description: 'Massive and ancient', rarity: 'legendary', type: 'material' },
  { lootId: 'ocean_heart', name: 'Heart of the Ocean', icon: '💙', description: 'Pulses with the sea\'s power', rarity: 'legendary', type: 'material' },
  { lootId: 'trident', name: 'Poseidon\'s Trident', icon: '🔱', description: 'Legendary three-pronged spear', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 8, critChance: 18, attackSpeed: 10 } },
  { lootId: 'leviathan_armor', name: 'Leviathan Plate', icon: '🛡️', description: 'Unbreakable defense', rarity: 'legendary', type: 'armor', equipmentStats: { hpReduction: 22, maxHpBonus: 50 } },
  { lootId: 'tidal_orb', name: 'Tidal Orb', icon: '🔮', description: 'Controls water itself', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 40, critChance: 15, coinBonus: 60 } },
  { lootId: 'spell_scroll_tsunami', name: 'Tsunami Scroll', icon: '📜', description: 'Unlocks Tsunami spell', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'tsunami', spellName: 'Tsunami', cooldown: 45, damage: 120, effect: 'Massive water damage' } },
];

// === VOLCANO BIOME LOOT (Phase 2.4) ===

// Lava Salamander Specific Loot (Volcano Tier 1, Common Monster)
const LAVA_SALAMANDER_SPECIFIC: LootItem[] = [
  { lootId: 'molten_scale', name: 'Molten Scale', icon: '🦎', description: 'Still hot to touch', rarity: 'common', type: 'material' },
  { lootId: 'salamander_tail', name: 'Salamander Tail', icon: '🦎', description: 'Regrows when cut', rarity: 'common', type: 'material' },
  { lootId: 'lava_stone', name: 'Lava Stone', icon: '🪨', description: 'Glows with inner heat', rarity: 'common', type: 'material' },
  { lootId: 'flame_cloak', name: 'Flame Cloak', icon: '🧥', description: 'Resists fire', rarity: 'common', type: 'armor', equipmentStats: { hpReduction: 6 } },
  { lootId: 'molten_dagger', name: 'Molten Dagger', icon: '🗡️', description: 'Drips with lava', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 4 } },
];

// Fire Bat Specific Loot (Volcano Tier 1, Common Monster)
const FIRE_BAT_SPECIFIC: LootItem[] = [
  { lootId: 'bat_wing', name: 'Fire Bat Wing', icon: '🦇', description: 'Singed but intact', rarity: 'common', type: 'material' },
  { lootId: 'bat_fang', name: 'Fire Bat Fang', icon: '🦷', description: 'Inflames wounds', rarity: 'common', type: 'material' },
  { lootId: 'ash_cloth', name: 'Ash Cloth', icon: '🧶', description: 'Made from volcanic ash', rarity: 'common', type: 'material' },
  { lootId: 'ember_blade', name: 'Ember Blade', icon: '🗡️', description: 'Burns with residual heat', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 5 } },
  { lootId: 'wing_boots', name: 'Wing Boots', icon: '👢', description: 'Grants extra speed', rarity: 'rare', type: 'artifact', equipmentStats: { attackSpeed: 7 } },
];

// Magma Golem Specific Loot (Volcano Tier 1-2, Rare Monster)
const MAGMA_GOLEM_SPECIFIC: LootItem[] = [
  { lootId: 'golem_core', name: 'Golem Core', icon: '⚫', description: 'Solid obsidian heart', rarity: 'rare', type: 'material' },
  { lootId: 'obsidian_shard', name: 'Obsidian Shard', icon: '🪨', description: 'Sharp volcanic glass', rarity: 'rare', type: 'material' },
  { lootId: 'magma_hammer', name: 'Magma Hammer', icon: '🔨', description: 'Crushes with fiery force', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 4, critChance: 6 } },
  { lootId: 'obsidian_armor', name: 'Obsidian Plate', icon: '🛡️', description: 'Volcanic glass armor', rarity: 'rare', type: 'armor', equipmentStats: { hpReduction: 12, maxHpBonus: 10 } },
  { lootId: 'lava_potion', name: 'Lava Potion', icon: '🧪', description: 'Fire resistance, restores 30 HP', rarity: 'rare', type: 'consumable', cooldown: 9, healing: 30 },
];

// Inferno Imp Specific Loot (Volcano Tier 1-2, Rare Monster)
const INFERNO_IMP_SPECIFIC: LootItem[] = [
  { lootId: 'demon_horn_shard', name: 'Demon Horn Shard', icon: '👹', description: 'Fragment of infernal power', rarity: 'rare', type: 'material' },
  { lootId: 'imp_claw', name: 'Imp Claw', icon: '👹', description: 'Wickedly sharp', rarity: 'rare', type: 'material' },
  { lootId: 'hellfire_dagger', name: 'Hellfire Dagger', icon: '🗡️', description: 'Cursed flames', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 3, critChance: 9 } },
  { lootId: 'inferno_ring', name: 'Ring of Inferno', icon: '💍', description: 'Enhances fire attacks', rarity: 'rare', type: 'artifact', equipmentStats: { damageBonus: 2, critChance: 8 } },
  { lootId: 'brimstone_armor', name: 'Brimstone Armor', icon: '🛡️', description: 'Demonic protection', rarity: 'rare', type: 'armor', equipmentStats: { hpReduction: 10, maxHpBonus: 8 } },
];

// Fire Drake Specific Loot (Volcano Tier 1+, Epic Mini-Boss)
const FIRE_DRAKE_SPECIFIC: LootItem[] = [
  { lootId: 'drake_scale', name: 'Fire Drake Scale', icon: '🐲', description: 'Impervious to flames', rarity: 'epic', type: 'material' },
  { lootId: 'drake_claw', name: 'Drake Claw', icon: '🦅', description: 'Sharp and scorching', rarity: 'epic', type: 'material' },
  { lootId: 'dragonfire_sword', name: 'Dragonfire Sword', icon: '⚔️', description: 'Blazing with dragonfire', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 12, attackSpeed: 6 } },
  { lootId: 'drake_armor', name: 'Drake Scale Armor', icon: '🛡️', description: 'Forged from drake scales', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 15, maxHpBonus: 22 } },
  { lootId: 'flame_pendant', name: 'Flame Pendant', icon: '📿', description: 'Burns eternally', rarity: 'epic', type: 'artifact', equipmentStats: { critChance: 10, coinBonus: 18 } },
];

// Volcanic Titan Specific Loot (Volcano Tier 2+, Epic Mini-Boss)
const VOLCANIC_TITAN_SPECIFIC: LootItem[] = [
  { lootId: 'titan_core', name: 'Volcanic Titan Core', icon: '🔥', description: 'Burning heart of a titan', rarity: 'epic', type: 'material' },
  { lootId: 'molten_stone', name: 'Molten Stone', icon: '🪨', description: 'Forever burning rock', rarity: 'epic', type: 'material' },
  { lootId: 'lava_crystal', name: 'Lava Crystal', icon: '💎', description: 'Crystallized lava', rarity: 'epic', type: 'material' },
  { lootId: 'titan_fist', name: 'Titan Fist Gauntlet', icon: '✊', description: 'Strikes with volcanic fury', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 7, critChance: 10, maxHpBonus: 15 } },
  { lootId: 'molten_plate', name: 'Molten Titan Plate', icon: '🛡️', description: 'Volcanic armor of legends', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 17, maxHpBonus: 28 } },
  { lootId: 'eruption_ring', name: 'Ring of Eruption', icon: '💍', description: 'Harnesses volcanic power', rarity: 'epic', type: 'artifact', equipmentStats: { damageBonus: 4, critChance: 9, coinBonus: 16 } },
];

// Ancient Dragon Specific Loot (Volcano Tier 3+, Legendary Boss)
const ANCIENT_DRAGON_SPECIFIC: LootItem[] = [
  { lootId: 'ancient_dragon_scale', name: 'Ancient Dragon Scale', icon: '🐉', description: 'Legendary protection', rarity: 'legendary', type: 'material' },
  { lootId: 'dragon_soul', name: 'Dragon Soul', icon: '🔥', description: 'Essence of dragonkind', rarity: 'legendary', type: 'material' },
  { lootId: 'excalibur', name: 'Excalibur', icon: '⚔️', description: 'The legendary sword', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 10, critChance: 20, attackSpeed: 12 } },
  { lootId: 'ancient_dragon_armor', name: 'Ancient Dragon Plate', icon: '🛡️', description: 'Ultimate protection', rarity: 'legendary', type: 'armor', equipmentStats: { hpReduction: 25, maxHpBonus: 60 } },
  { lootId: 'dragon_amulet', name: 'Dragon Amulet', icon: '💎', description: 'Grants dragon\'s power', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 6, maxHpBonus: 45, critChance: 16 } },
  { lootId: 'spell_scroll_meteor', name: 'Meteor Scroll', icon: '📜', description: 'Unlocks Meteor spell', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'meteor', spellName: 'Meteor Strike', cooldown: 40, damage: 150, effect: 'Massive fire damage' } },
];

// === CASTLE BIOME LOOT (Phase 2.4) ===

// Skeleton Warrior Specific Loot (Castle Tier 1, Common Monster)
const SKELETON_WARRIOR_SPECIFIC: LootItem[] = [
  { lootId: 'bone_shard', name: 'Bone Shard', icon: '🦴', description: 'Brittle but sharp', rarity: 'common', type: 'material' },
  { lootId: 'warrior_skull', name: 'Warrior Skull', icon: '💀', description: 'Ancient and weathered', rarity: 'common', type: 'material' },
  { lootId: 'rusty_sword', name: 'Rusty Sword', icon: '⚔️', description: 'Aged but deadly', rarity: 'common', type: 'weapon', equipmentStats: { damageBonus: 2 } },
  { lootId: 'bone_armor', name: 'Bone Armor', icon: '🛡️', description: 'Assembled from skeletons', rarity: 'common', type: 'armor', equipmentStats: { hpReduction: 7, maxHpBonus: 5 } },
  { lootId: 'bone_dagger', name: 'Bone Dagger', icon: '🗡️', description: 'Sharpened rib', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 6 } },
];

// Cursed Spirit Specific Loot (Castle Tier 1, Common Monster)
const CURSED_SPIRIT_SPECIFIC: LootItem[] = [
  { lootId: 'cursed_cloth', name: 'Cursed Cloth', icon: '👻', description: 'Tattered and haunted', rarity: 'common', type: 'material' },
  { lootId: 'ectoplasm_vial', name: 'Ectoplasm Vial', icon: '💧', description: 'Ghostly essence', rarity: 'common', type: 'material' },
  { lootId: 'spirit_vial', name: 'Spirit Vial', icon: '🧪', description: 'Contains spectral energy, restores 20 HP', rarity: 'common', type: 'consumable', cooldown: 7, healing: 20 },
  { lootId: 'spectral_robes', name: 'Spectral Robes', icon: '🧥', description: 'Ethereal protection', rarity: 'common', type: 'armor', equipmentStats: { hpReduction: 5, maxHpBonus: 8 } },
  { lootId: 'haunted_pendant', name: 'Haunted Pendant', icon: '📿', description: 'Whispers dark secrets', rarity: 'rare', type: 'artifact', equipmentStats: { maxHpBonus: 5, coinBonus: 8 } },
];

// Vampire Lord Specific Loot (Castle Tier 1-2, Rare Monster)
const VAMPIRE_LORD_SPECIFIC: LootItem[] = [
  { lootId: 'vampire_fang', name: 'Vampire Fang', icon: '🦷', description: 'Drains life force', rarity: 'rare', type: 'material' },
  { lootId: 'blood_vial', name: 'Blood Vial', icon: '🩸', description: 'Contains vampiric blood', rarity: 'rare', type: 'material' },
  { lootId: 'blood_sword', name: 'Blood Sword', icon: '🗡️', description: 'Thirsts for blood', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 3, critChance: 8, maxHpBonus: 5 } },
  { lootId: 'vampire_cape', name: 'Vampire Cape', icon: '🧛', description: 'Grants night power', rarity: 'rare', type: 'armor', equipmentStats: { hpReduction: 10, maxHpBonus: 12 } },
  { lootId: 'crimson_ring', name: 'Crimson Ring', icon: '💍', description: 'Drains enemies', rarity: 'epic', type: 'artifact', equipmentStats: { critChance: 10, maxHpBonus: 8 } },
];

// Death Knight Specific Loot (Castle Tier 1-2, Rare Monster)
const DEATH_KNIGHT_SPECIFIC: LootItem[] = [
  { lootId: 'dark_steel', name: 'Dark Steel', icon: '⚫', description: 'Forged in darkness', rarity: 'rare', type: 'material' },
  { lootId: 'cursed_blade_fragment', name: 'Cursed Blade Fragment', icon: '⚔️', description: 'Piece of a legendary sword', rarity: 'rare', type: 'material' },
  { lootId: 'necrotic_sword', name: 'Necrotic Sword', icon: '⚔️', description: 'Drains life on hit', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 4, critChance: 7 } },
  { lootId: 'death_armor', name: 'Death Knight Armor', icon: '🛡️', description: 'Forged for the undead', rarity: 'rare', type: 'armor', equipmentStats: { hpReduction: 13, maxHpBonus: 15 } },
  { lootId: 'shadow_ring', name: 'Shadow Ring', icon: '💍', description: 'Hides in darkness', rarity: 'rare', type: 'artifact', equipmentStats: { attackSpeed: 12, coinBonus: 10 } },
];

// Necromancer Specific Loot (Castle Tier 1+, Epic Mini-Boss)
const NECROMANCER_SPECIFIC: LootItem[] = [
  { lootId: 'necrotic_essence', name: 'Necrotic Essence', icon: '🧙', description: 'Pure death magic', rarity: 'epic', type: 'material' },
  { lootId: 'dark_crystal', name: 'Dark Crystal', icon: '🔮', description: 'Channels necromancy', rarity: 'epic', type: 'material' },
  { lootId: 'staff_of_souls', name: 'Staff of Souls', icon: '🪄', description: 'Commands the dead', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 5, critChance: 11, attackSpeed: 10 } },
  { lootId: 'necro_robes', name: 'Necromancer\'s Robes', icon: '🧥', description: 'Radiates dark power', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 10, maxHpBonus: 25 } },
  { lootId: 'phylactery', name: 'Phylactery', icon: '⚱️', description: 'Stores a soul', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 30, coinBonus: 20 } },
];

// Wraith Lord Specific Loot (Castle Tier 2+, Epic Mini-Boss)
const WRAITH_LORD_SPECIFIC: LootItem[] = [
  { lootId: 'wraith_essence', name: 'Wraith Essence', icon: '👤', description: 'Pure spectral energy', rarity: 'epic', type: 'material' },
  { lootId: 'shadow_crystal', name: 'Shadow Crystal', icon: '🔮', description: 'Crystallized darkness', rarity: 'epic', type: 'material' },
  { lootId: 'spectral_shard', name: 'Spectral Shard', icon: '💎', description: 'Fragment of the afterlife', rarity: 'epic', type: 'material' },
  { lootId: 'wraith_blade', name: 'Wraith Lord\'s Blade', icon: '⚔️', description: 'Phases through armor', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 13, attackSpeed: 10 } },
  { lootId: 'shadow_armor', name: 'Shadow Lord Armor', icon: '🛡️', description: 'Ethereal protection', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 14, maxHpBonus: 26 } },
  { lootId: 'wraith_crown', name: 'Crown of Shadows', icon: '👑', description: 'Rules over the dead', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 22, critChance: 10, coinBonus: 20 } },
];

// Lich King Specific Loot (Castle Tier 3+, Legendary Boss)
const LICH_KING_SPECIFIC: LootItem[] = [
  { lootId: 'lich_crown', name: 'Crown of the Lich King', icon: '👑', description: 'Ultimate undead power', rarity: 'legendary', type: 'material' },
  { lootId: 'void_essence', name: 'Void Essence', icon: '⚫', description: 'Pure nothingness', rarity: 'legendary', type: 'material' },
  { lootId: 'scarlet_dagger', name: 'Scarlet Dagger', icon: '🗡️', description: 'The endgame weapon', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 12, critChance: 25, attackSpeed: 15 } },
  { lootId: 'lich_plate', name: 'Lich King\'s Plate', icon: '🛡️', description: 'Eternal protection', rarity: 'legendary', type: 'armor', equipmentStats: { hpReduction: 28, maxHpBonus: 70 } },
  { lootId: 'death_orb', name: 'Orb of Eternal Death', icon: '🔮', description: 'Controls life and death', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 50, critChance: 20, coinBonus: 80 } },
  { lootId: 'spell_scroll_death', name: 'Death Comet Scroll', icon: '📜', description: 'Unlocks Death Comet spell', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'death_comet', spellName: 'Death Comet', cooldown: 50, damage: 200, effect: 'Massive dark damage' } },
];

// ============================
// CRAFT-ONLY ITEMS
// These items can ONLY be obtained through crafting, not monster drops
// ============================

const CRAFT_ONLY_WEAPONS: LootItem[] = [
  { lootId: 'masterwork_blade', name: 'Masterwork Blade', icon: '⚔️', description: 'Perfectly balanced steel sword', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 4, critChance: 10 } },
  { lootId: 'alchemists_staff', name: 'Alchemist\'s Staff', icon: '🪄', description: 'Infused with magical properties', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 12, attackSpeed: 8 } },
  { lootId: 'vorpal_blade', name: 'Vorpal Blade', icon: '🗡️', description: 'Legendary blade that strikes true', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 15, critChance: 30 } },
  { lootId: 'tidal_reaver', name: 'Tidal Reaver', icon: '🔱', description: 'Legendary trident of the sea', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 14, critChance: 25, attackSpeed: 12 } },
  { lootId: 'infernal_claymore', name: 'Infernal Claymore', icon: '⚔️', description: 'Forged in volcanic fury', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 16, critChance: 22, maxHpBonus: 20 } },
  { lootId: 'reaper_scythe', name: 'Reaper\'s Scythe', icon: '🗡️', description: 'Harvests souls of the living', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 13, critChance: 28, maxHpBonus: 30 } },
];

const CRAFT_ONLY_ARMOR: LootItem[] = [
  { lootId: 'reinforced_steel_plate', name: 'Reinforced Steel Plate', icon: '🛡️', description: 'Heavy armor with exceptional protection', rarity: 'rare', type: 'armor', equipmentStats: { hpReduction: 15, maxHpBonus: 20 } },
  { lootId: 'enchanted_silk_robes', name: 'Enchanted Silk Robes', icon: '🧥', description: 'Light armor imbued with protective magic', rarity: 'epic', type: 'armor', equipmentStats: { hpReduction: 12, maxHpBonus: 35, attackSpeed: 10 } },
  { lootId: 'titans_armor', name: 'Titan\'s Armor', icon: '🛡️', description: 'Armor of the ancient giants', rarity: 'legendary', type: 'armor', equipmentStats: { hpReduction: 30, maxHpBonus: 100 } },
  { lootId: 'abyssal_plate', name: 'Abyssal Plate', icon: '🛡️', description: 'Forged in the deepest trenches', rarity: 'legendary', type: 'armor', equipmentStats: { hpReduction: 28, maxHpBonus: 90, attackSpeed: -5 } },
  { lootId: 'dragonlord_armor', name: 'Dragonlord Armor', icon: '🛡️', description: 'Ultimate volcanic protection', rarity: 'legendary', type: 'armor', equipmentStats: { hpReduction: 32, maxHpBonus: 110, critChance: 5 } },
  { lootId: 'dreadlord_plate', name: 'Dreadlord Plate', icon: '🛡️', description: 'Eternal undead protection', rarity: 'legendary', type: 'armor', equipmentStats: { hpReduction: 30, maxHpBonus: 95, damageBonus: 5 } },
];

const CRAFT_ONLY_CONSUMABLES: LootItem[] = [
  { lootId: 'concentrated_elixir', name: 'Concentrated Elixir', icon: '⚗️', description: 'Restores 75 HP', rarity: 'rare', type: 'consumable', cooldown: 12, healing: 75 },
  { lootId: 'transmutation_potion', name: 'Transmutation Potion', icon: '🧪', description: 'Restores 50 HP + grants 30s damage buff', rarity: 'epic', type: 'consumable', cooldown: 15, healing: 50 },
  { lootId: 'phoenix_tear', name: 'Phoenix Tear', icon: '💧', description: 'Fully restores HP', rarity: 'legendary', type: 'consumable', cooldown: 25, healing: 999 },
];

const CRAFT_ONLY_ARTIFACTS: LootItem[] = [
  { lootId: 'master_craftsman_ring', name: 'Master Craftsman\'s Ring', icon: '💍', description: 'Enhances all combat abilities', rarity: 'rare', type: 'artifact', equipmentStats: { damageBonus: 3, critChance: 8, attackSpeed: 8 } },
  { lootId: 'arcane_amplifier', name: 'Arcane Amplifier', icon: '🔮', description: 'Boosts magical power', rarity: 'epic', type: 'artifact', equipmentStats: { damageBonus: 5, critChance: 15, maxHpBonus: 40 } },
  { lootId: 'infinity_amulet', name: 'Infinity Amulet', icon: '🔱', description: 'Contains limitless power', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 8, critChance: 20, maxHpBonus: 80, coinBonus: 100 } },
  { lootId: 'maelstrom_pendant', name: 'Maelstrom Pendant', icon: '🌊', description: 'Harnesses the fury of the ocean', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 7, critChance: 18, attackSpeed: 15, coinBonus: 80 } },
  { lootId: 'volcanic_heart', name: 'Volcanic Heart', icon: '🔥', description: 'Pulses with molten power', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 10, critChance: 20, maxHpBonus: 60, coinBonus: 70 } },
  { lootId: 'crown_of_eternity', name: 'Crown of Eternity', icon: '👑', description: 'Rules over life and death', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 6, critChance: 22, maxHpBonus: 100, coinBonus: 120 } },
];

// Monster name to monster-specific loot mapping
const MONSTER_SPECIFIC_LOOT: Record<string, LootItem[]> = {
  // Legacy monsters (will be phased out)
  'Goblin': GOBLIN_ORC_SPECIFIC,
  'Orc': GOBLIN_ORC_SPECIFIC,
  'Zombie': ZOMBIE_SPECIFIC,
  'Troll': TROLL_GHOST_SPECIFIC,
  'Ghost': TROLL_GHOST_SPECIFIC,
  'Dragon': DRAGON_VAMPIRE_SPECIFIC,
  'Vampire': DRAGON_VAMPIRE_SPECIFIC,
  'Demon': DEMON_SPECIFIC,

  // Forest Biome Monsters
  'Forest Wolf': FOREST_WOLF_SPECIFIC,
  'Bandit Raccoon': FOREST_WOLF_SPECIFIC, // Shares with Forest Wolf
  'Wild Boar': WILD_BOAR_SPECIFIC,
  'Forest Sprite': FOREST_SPRITE_SPECIFIC,
  'Treant Guardian': TREANT_GUARDIAN_SPECIFIC,
  'Dire Wolf Alpha': DIRE_WOLF_ALPHA_SPECIFIC,
  'Ancient Ent': ANCIENT_ENT_SPECIFIC,

  // Desert Biome Monsters
  'Sand Scorpion': SAND_SCORPION_SPECIFIC,
  'Desert Viper': DESERT_VIPER_SPECIFIC,
  'Fire Elemental': FIRE_ELEMENTAL_SPECIFIC,
  'Sand Djinn': SAND_DJINN_SPECIFIC,
  'Sandstone Golem': SANDSTONE_GOLEM_SPECIFIC,
  'Desert Phoenix': DESERT_PHOENIX_SPECIFIC,

  // Ocean Biome Monsters (Phase 2.4)
  'Coral Crab': CORAL_CRAB_SPECIFIC,
  'Giant Jellyfish': GIANT_JELLYFISH_SPECIFIC,
  'Frost Shark': FROST_SHARK_SPECIFIC,
  'Electric Eel': ELECTRIC_EEL_SPECIFIC,
  'Sea Serpent': SEA_SERPENT_SPECIFIC,
  'Kraken': KRAKEN_SPECIFIC,
  'Leviathan': LEVIATHAN_SPECIFIC,

  // Volcano Biome Monsters (Phase 2.4)
  'Lava Salamander': LAVA_SALAMANDER_SPECIFIC,
  'Fire Bat': FIRE_BAT_SPECIFIC,
  'Magma Golem': MAGMA_GOLEM_SPECIFIC,
  'Inferno Imp': INFERNO_IMP_SPECIFIC,
  'Fire Drake': FIRE_DRAKE_SPECIFIC,
  'Volcanic Titan': VOLCANIC_TITAN_SPECIFIC,
  'Ancient Dragon': ANCIENT_DRAGON_SPECIFIC,

  // Castle Biome Monsters (Phase 2.4)
  'Skeleton Warrior': SKELETON_WARRIOR_SPECIFIC,
  'Cursed Spirit': CURSED_SPIRIT_SPECIFIC,
  'Vampire Lord': VAMPIRE_LORD_SPECIFIC,
  'Death Knight': DEATH_KNIGHT_SPECIFIC,
  'Necromancer': NECROMANCER_SPECIFIC,
  'Wraith Lord': WRAITH_LORD_SPECIFIC,
  'Lich King': LICH_KING_SPECIFIC,
};

// Create a map of all loot items for easy lookup by lootId
const ALL_LOOT_ITEMS_MAP = new Map<string, LootItem>();

// Populate the map with all loot items
[
  ...COMMON_LOOT,
  ...RARE_LOOT,
  ...GOBLIN_ORC_SPECIFIC,
  ...ZOMBIE_SPECIFIC,
  ...TROLL_GHOST_SPECIFIC,
  ...DRAGON_VAMPIRE_SPECIFIC,
  ...DEMON_SPECIFIC,
  // Biome-specific items (Forest & Desert)
  ...FOREST_WOLF_SPECIFIC,
  ...WILD_BOAR_SPECIFIC,
  ...FOREST_SPRITE_SPECIFIC,
  ...TREANT_GUARDIAN_SPECIFIC,
  ...DIRE_WOLF_ALPHA_SPECIFIC,
  ...ANCIENT_ENT_SPECIFIC,
  ...SAND_SCORPION_SPECIFIC,
  ...DESERT_VIPER_SPECIFIC,
  ...FIRE_ELEMENTAL_SPECIFIC,
  ...SAND_DJINN_SPECIFIC,
  ...SANDSTONE_GOLEM_SPECIFIC,
  ...DESERT_PHOENIX_SPECIFIC,
  // Phase 2.4 biome-specific items (Ocean, Volcano, Castle)
  ...CORAL_CRAB_SPECIFIC,
  ...GIANT_JELLYFISH_SPECIFIC,
  ...FROST_SHARK_SPECIFIC,
  ...ELECTRIC_EEL_SPECIFIC,
  ...SEA_SERPENT_SPECIFIC,
  ...KRAKEN_SPECIFIC,
  ...LEVIATHAN_SPECIFIC,
  ...LAVA_SALAMANDER_SPECIFIC,
  ...FIRE_BAT_SPECIFIC,
  ...MAGMA_GOLEM_SPECIFIC,
  ...INFERNO_IMP_SPECIFIC,
  ...FIRE_DRAKE_SPECIFIC,
  ...VOLCANIC_TITAN_SPECIFIC,
  ...ANCIENT_DRAGON_SPECIFIC,
  ...SKELETON_WARRIOR_SPECIFIC,
  ...CURSED_SPIRIT_SPECIFIC,
  ...VAMPIRE_LORD_SPECIFIC,
  ...DEATH_KNIGHT_SPECIFIC,
  ...NECROMANCER_SPECIFIC,
  ...WRAITH_LORD_SPECIFIC,
  ...LICH_KING_SPECIFIC,
  // Craft-only items
  ...CRAFT_ONLY_WEAPONS,
  ...CRAFT_ONLY_ARMOR,
  ...CRAFT_ONLY_CONSUMABLES,
  ...CRAFT_ONLY_ARTIFACTS,
].forEach(item => {
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
