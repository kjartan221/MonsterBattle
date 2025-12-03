export interface EquipmentStats {
  damageBonus?: number;     // For weapons - adds to player damage (clicks per attack)
  critChance?: number;       // For weapons - increases crit chance %
  defense?: number;          // For armor - reduces monster damage (diminishing returns, max 80%)
  maxHpBonus?: number;       // For armor - increases max HP
  attackSpeed?: number;      // For accessories - slows monster attacks (diminishing returns, max 50%)
  coinBonus?: number;        // For accessories - increases coin drops %
  healBonus?: number;        // For artifacts/armor - increases HP healing % (after battle victories)
  lifesteal?: number;        // For weapons - % of damage dealt returned as HP (works on all damage sources)
  defensiveLifesteal?: number; // For armor - % of damage taken returned as HP (works on all damage sources)
  thorns?: number;           // For armor - % of damage taken reflected back to monster (uses pre-mitigation damage)
  autoClickRate?: number;    // For weapons/artifacts - auto-clicks per second (stacks across items)
  fireResistance?: number;   // For armor/artifacts - reduces burn DoT damage %
  poisonResistance?: number; // For armor/artifacts - reduces poison DoT damage %
  bleedResistance?: number;  // For armor/artifacts - reduces bleed DoT damage %
}

export interface LootItem {
  lootId: string;
  name: string;
  icon: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact' | 'spell_scroll' | 'inscription_scroll';
  equipmentStats?: EquipmentStats; // Optional stats for equippable items
  spellData?: SpellData; // Optional spell data for spell scrolls
  inscriptionData?: import('@/lib/types').InscriptionData; // Optional inscription data for inscription scrolls
  cooldown?: number; // Optional cooldown for consumables
  healing?: number; // Optional healing amount for consumables (HP restored)
  buffData?: ConsumableBuffData; // Optional buff data for consumables (temporary buffs)
}

export interface ConsumableBuffData {
  buffType: 'shield' | 'damage_boost' | 'damage_mult' | 'crit_boost' | 'attack_speed' | 'cooldown_reduction' | 'coin_boost' | 'xp_boost' | 'heal_boost' | 'fire_resistance' | 'poison_resistance' | 'bleed_resistance';
  buffValue: number; // Value of the buff (HP for shield, percentage for resistances/boosts)
  duration: number; // Duration in seconds
}

export interface SpellData {
  spellId: string;
  spellName: string;
  cooldown: number; // in seconds
  damage?: number;
  healing?: number;
  duration?: number; // in seconds (for buffs/debuffs)
  effect?: string; // description of special effects
  // Buff data (for defensive/utility spells)
  buffType?: 'shield' | 'damage_boost' | 'damage_mult' | 'crit_boost' | 'attack_speed' | 'cooldown_reduction' | 'coin_boost' | 'xp_boost' | 'heal_boost';
  buffValue?: number; // Value of the buff (HP for shield, percentage for others)
  // Debuff data (for offensive DoT/CC spells)
  debuffType?: 'poison' | 'burn' | 'bleed' | 'stun' | 'slow';
  debuffValue?: number; // Damage per tick for DoTs
  debuffDamageType?: 'flat' | 'percentage'; // For DoTs
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
  // Phase 2.6: Basic spell scrolls (common tier) - Nerfed to balance with legendary spells
  { lootId: 'spell_scroll_spark', name: 'Spark Scroll', icon: '⚡', description: 'Unlocks Spark spell - Basic magic missile', rarity: 'common', type: 'spell_scroll', spellData: { spellId: 'spark', spellName: 'Spark', cooldown: 10, damage: 15, effect: 'Lightning damage' } },
  { lootId: 'spell_scroll_light_heal', name: 'Light Heal Scroll', icon: '✨', description: 'Unlocks Light Heal spell - Basic restoration', rarity: 'common', type: 'spell_scroll', spellData: { spellId: 'light_heal', spellName: 'Light Heal', cooldown: 12, healing: 8 } },
  { lootId: 'spell_scroll_poison_dart', name: 'Poison Dart Scroll', icon: '🎯', description: 'Unlocks Poison Dart - Inflicts poison DoT', rarity: 'common', type: 'spell_scroll', spellData: { spellId: 'poison_dart', spellName: 'Poison Dart', cooldown: 15, debuffType: 'poison', debuffValue: 5, debuffDamageType: 'flat', duration: 5, effect: 'Poison DoT' } },
  { lootId: 'spell_scroll_minor_shield', name: 'Minor Shield Scroll', icon: '🛡️', description: 'Unlocks Minor Shield - Absorbs damage', rarity: 'common', type: 'spell_scroll', spellData: { spellId: 'minor_shield', spellName: 'Minor Shield', cooldown: 15, buffType: 'shield', buffValue: 20, duration: 10, effect: 'Damage absorption' } },
  // Phase 3.4: Inscription scrolls (common tier) - Basic prefix/suffix upgrades
  { lootId: 'prefix_damage_common', name: 'Savage Prefix Scroll', icon: '📜', description: 'Adds "Savage" prefix: +3 damage', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 3, slot: 'prefix', name: 'Savage', description: 'Adds +3 damage to equipment' } },
  { lootId: 'suffix_damage_common', name: 'Suffix of Fury Scroll', icon: '📜', description: 'Adds "of Fury" suffix: +3 damage', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 3, slot: 'suffix', name: 'of Fury', description: 'Adds +3 damage to equipment' } },
  { lootId: 'prefix_critical_common', name: 'Keen Prefix Scroll', icon: '📜', description: 'Adds "Keen" prefix: +3% crit chance', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 3, slot: 'prefix', name: 'Keen', description: 'Adds +3% crit chance to equipment' } },
];

// Rare Loot (shared across all monsters, but less common than COMMON_LOOT)
const RARE_LOOT: LootItem[] = [
  { lootId: 'rare_gem', name: 'Precious Gem', icon: '💎', description: 'A valuable gemstone', rarity: 'rare', type: 'material' },
  { lootId: 'rare_elixir', name: 'Grand Elixir', icon: '⚗️', description: 'Restores 50 HP', rarity: 'rare', type: 'consumable', cooldown: 10, healing: 50 },
  { lootId: 'rare_steel', name: 'Steel Ingot', icon: '🔩', description: 'High-quality metal', rarity: 'rare', type: 'material' },
  { lootId: 'rare_amulet', name: 'Mystic Amulet', icon: '📿', description: 'Enhances magical abilities', rarity: 'rare', type: 'artifact', equipmentStats: { attackSpeed: 10 } },
  { lootId: 'rare_key', name: 'Ancient Key', icon: '🗝️', description: 'Opens mysterious locks', rarity: 'rare', type: 'artifact', equipmentStats: { coinBonus: 15 } },
  { lootId: 'rare_map', name: 'Treasure Map', icon: '🗺️', description: 'Leads to hidden riches', rarity: 'rare', type: 'artifact', equipmentStats: { coinBonus: 20 } },
  // Heal-focused items (sustainability builds)
  { lootId: 'regeneration_pendant', name: 'Regeneration Pendant', icon: '💚', description: 'Enhances natural healing (+4% heal)', rarity: 'rare', type: 'artifact', equipmentStats: { healBonus: 4 } },
  { lootId: 'ring_of_vitality', name: 'Ring of Vitality', icon: '💍', description: 'Grants enhanced recovery (+5% heal)', rarity: 'rare', type: 'artifact', equipmentStats: { healBonus: 5, maxHpBonus: 5 } },
  // Phase 2.6: Intermediate spell scrolls (rare tier) - Nerfed to balance with legendary spells
  { lootId: 'spell_scroll_ice_shard', name: 'Ice Shard Scroll', icon: '❄️', description: 'Unlocks Ice Shard spell - Freezing projectile', rarity: 'rare', type: 'spell_scroll', spellData: { spellId: 'ice_shard', spellName: 'Ice Shard', cooldown: 20, damage: 25, effect: 'Ice damage' } },
  { lootId: 'spell_scroll_greater_heal', name: 'Greater Heal Scroll', icon: '💫', description: 'Unlocks Greater Heal spell - Strong restoration', rarity: 'rare', type: 'spell_scroll', spellData: { spellId: 'greater_heal', spellName: 'Greater Heal', cooldown: 25, healing: 15 } },
  { lootId: 'spell_scroll_flame_strike', name: 'Flame Strike Scroll', icon: '🔥', description: 'Unlocks Flame Strike - Burns target over time', rarity: 'rare', type: 'spell_scroll', spellData: { spellId: 'flame_strike', spellName: 'Flame Strike', cooldown: 22, debuffType: 'burn', debuffValue: 8, debuffDamageType: 'flat', duration: 6, effect: 'Burn DoT' } },
  { lootId: 'spell_scroll_battle_fury', name: 'Battle Fury Scroll', icon: '⚔️', description: 'Unlocks Battle Fury - Increases damage output', rarity: 'rare', type: 'spell_scroll', spellData: { spellId: 'battle_fury', spellName: 'Battle Fury', cooldown: 20, buffType: 'damage_boost', buffValue: 15, duration: 8, effect: 'Damage boost' } },
  { lootId: 'spell_scroll_greater_shield', name: 'Greater Shield Scroll', icon: '🛡️', description: 'Unlocks Greater Shield - Strong damage absorption', rarity: 'rare', type: 'spell_scroll', spellData: { spellId: 'greater_shield', spellName: 'Greater Shield', cooldown: 20, buffType: 'shield', buffValue: 40, duration: 12, effect: 'Damage absorption' } },
  // Phase 3.4: Inscription scrolls (rare tier) - Improved prefix/suffix upgrades
  { lootId: 'prefix_damage_rare', name: 'Fierce Prefix Scroll', icon: '📜', description: 'Adds "Fierce" prefix: +5 damage', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 5, slot: 'prefix', name: 'Fierce', description: 'Adds +5 damage to equipment' } },
  { lootId: 'suffix_damage_rare', name: 'Suffix of Rage Scroll', icon: '📜', description: 'Adds "of Rage" suffix: +5 damage', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 5, slot: 'suffix', name: 'of Rage', description: 'Adds +5 damage to equipment' } },
  { lootId: 'prefix_protection_rare', name: 'Steadfast Prefix Scroll', icon: '📜', description: 'Adds "Steadfast" prefix: +5% damage reduction', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'protection', statValue: 5, slot: 'prefix', name: 'Steadfast', description: 'Adds +5% damage reduction to equipment' } },
  { lootId: 'suffix_vitality_rare', name: 'Suffix of Life Scroll', icon: '📜', description: 'Adds "of Life" suffix: +5 max HP', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 5, slot: 'suffix', name: 'of Life', description: 'Adds +5 max HP to equipment' } },
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
  { lootId: 'spectral_cloak', name: 'Spectral Cloak', icon: '🧥', description: 'Grants temporary invisibility', rarity: 'epic', type: 'armor', equipmentStats: { defense: 10, maxHpBonus: 15 } },
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
  { lootId: 'dragon_armor', name: 'Dragon Scale Armor', icon: '🛡️', description: 'Nearly impenetrable defense - spiked scales reflect damage', rarity: 'epic', type: 'armor', equipmentStats: { defense: 15, maxHpBonus: 30, thorns: 12 } },
  // Phase 2.6: Advanced spell scrolls (epic tier)
  { lootId: 'spell_scroll_lightning_bolt', name: 'Lightning Bolt Scroll', icon: '⚡', description: 'Unlocks Lightning Bolt spell - Devastating electric strike', rarity: 'epic', type: 'spell_scroll', spellData: { spellId: 'lightning_bolt', spellName: 'Lightning Bolt', cooldown: 35, damage: 100, effect: 'Electric damage' } },
  { lootId: 'spell_scroll_mass_heal', name: 'Mass Heal Scroll', icon: '🌟', description: 'Unlocks Mass Heal spell - Powerful restoration', rarity: 'epic', type: 'spell_scroll', spellData: { spellId: 'mass_heal', spellName: 'Mass Heal', cooldown: 40, healing: 60 } },
  { lootId: 'spell_scroll_blade_storm', name: 'Blade Storm Scroll', icon: '🌪️', description: 'Unlocks Blade Storm spell - AoE attack that slows enemies', rarity: 'epic', type: 'spell_scroll', spellData: { spellId: 'blade_storm', spellName: 'Blade Storm', cooldown: 30, damage: 75, debuffType: 'slow', debuffValue: 50, duration: 8, effect: 'AoE damage + slow' } },
  { lootId: 'spell_scroll_arcane_shield', name: 'Arcane Shield Scroll', icon: '🔮', description: 'Unlocks Arcane Shield spell - Powerful magical barrier', rarity: 'epic', type: 'spell_scroll', spellData: { spellId: 'arcane_shield', spellName: 'Arcane Shield', cooldown: 35, buffType: 'shield', buffValue: 80, duration: 15, effect: 'Strong damage absorption' } },
  { lootId: 'spell_scroll_berserker_rage', name: 'Berserker Rage Scroll', icon: '💢', description: 'Unlocks Berserker Rage spell - Massive damage boost', rarity: 'epic', type: 'spell_scroll', spellData: { spellId: 'berserker_rage', spellName: 'Berserker Rage', cooldown: 40, buffType: 'damage_mult', buffValue: 50, duration: 10, effect: '+50% damage multiplier' } },
  { lootId: 'spell_scroll_time_warp', name: 'Time Warp Scroll', icon: '⏰', description: 'Unlocks Time Warp spell - Accelerates attacks', rarity: 'epic', type: 'spell_scroll', spellData: { spellId: 'time_warp', spellName: 'Time Warp', cooldown: 35, buffType: 'attack_speed', buffValue: 30, duration: 12, effect: '+30% attack speed' } },
  { lootId: 'wing_fragment', name: 'Dragon Wing Fragment', icon: '🪽', description: 'Enables short flight', rarity: 'legendary', type: 'material' },
  { lootId: 'elixir_immortality', name: 'Elixir of Immortality', icon: '🧬', description: 'Restores 100 HP', rarity: 'legendary', type: 'consumable', cooldown: 20, healing: 100 },
  { lootId: 'crimson_crown', name: 'Crimson Crown', icon: '👑', description: 'Symbol of vampiric royalty', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 50, critChance: 15, coinBonus: 50 } },
  // Phase 3.4: Epic inscription scrolls (mini-boss drops)
  { lootId: 'prefix_damage_epic', name: 'Vicious Prefix Scroll', icon: '📜', description: 'Adds "Vicious" prefix: +8 damage', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 8, slot: 'prefix', name: 'Vicious', description: 'Adds +8 damage to equipment' } },
  { lootId: 'suffix_critical_epic', name: 'Suffix of Execution Scroll', icon: '📜', description: 'Adds "of Execution" suffix: +8% crit chance', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 8, slot: 'suffix', name: 'of Execution', description: 'Adds +8% crit chance to equipment' } },
  { lootId: 'prefix_vitality_epic', name: 'Robust Prefix Scroll', icon: '📜', description: 'Adds "Robust" prefix: +32 max HP', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 32, slot: 'prefix', name: 'Robust', description: 'Adds +32 maximum HP to equipment' } },
  { lootId: 'suffix_protection_epic', name: 'Suffix of Warding Scroll', icon: '📜', description: 'Adds "of Warding" suffix: +25 defense', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'protection', statValue: 25, slot: 'suffix', name: 'of Warding', description: 'Adds +25 defense to equipment' } },
];

// Demon Specific Loot (Legendary Monster)
const DEMON_SPECIFIC: LootItem[] = [
  { lootId: 'demon_horn', name: 'Demon Horn', icon: '🦖', description: 'Radiates malevolent energy', rarity: 'legendary', type: 'material' },
  { lootId: 'soul_stone', name: 'Soul Stone', icon: '💠', description: 'Contains thousands of trapped souls', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 100, critChance: 20, attackSpeed: 15 } },
  { lootId: 'infernal_blade', name: 'Infernal Blade', icon: '🗡️', description: 'Forged in the fires of hell - pure offensive power', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 8, critChance: 16 } },
  { lootId: 'demon_eye', name: 'Demon Eye', icon: '👁️', description: 'Sees through all illusions', rarity: 'legendary', type: 'material' },
  { lootId: 'hellfire_staff', name: 'Hellfire Staff', icon: '🪄', description: 'Commands the flames of perdition - devastating magical assault', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 8, critChance: 14 } },
  { lootId: 'void_armor', name: 'Void Armor', icon: '🛡️', description: 'Forged from pure darkness - devours pain as sustenance', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 25, maxHpBonus: 75, defensiveLifesteal: 5 } },
  { lootId: 'demonic_tome', name: 'Demonic Tome', icon: '📖', description: 'Contains forbidden knowledge', rarity: 'legendary', type: 'artifact', equipmentStats: { critChance: 25, attackSpeed: 15 } },
  { lootId: 'chaos_orb', name: 'Chaos Orb', icon: '🔮', description: 'Reality bends around it', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 5, maxHpBonus: 50, coinBonus: 100 } },
  { lootId: 'dark_halo', name: 'Dark Halo', icon: '⭕', description: 'Corrupts all who wear it', rarity: 'legendary', type: 'artifact', equipmentStats: { critChance: 30, defense: 10 } },
  { lootId: 'phoenix_feather', name: 'Phoenix Feather', icon: '🪶', description: 'Grants resurrection', rarity: 'legendary', type: 'material' },
  // Phase 3.4: Legendary inscription scrolls (boss drops)
  { lootId: 'prefix_damage_legendary', name: 'Deadly Prefix Scroll', icon: '📜', description: 'Adds "Deadly" prefix: +12 damage', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 12, slot: 'prefix', name: 'Deadly', description: 'Adds +12 damage to equipment' } },
  { lootId: 'suffix_critical_legendary', name: 'Suffix of Piercing Scroll', icon: '📜', description: 'Adds "of Piercing" suffix: +12% crit chance', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 12, slot: 'suffix', name: 'of Piercing', description: 'Adds +12% crit chance to equipment' } },
  { lootId: 'prefix_haste_legendary', name: 'Lightning Prefix Scroll', icon: '📜', description: 'Adds "Lightning" prefix: +12 attack speed', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'haste', statValue: 12, slot: 'prefix', name: 'Lightning', description: 'Adds +12 attack speed to equipment' } },
  { lootId: 'suffix_fortune_legendary', name: 'Suffix of Prosperity Scroll', icon: '📜', description: 'Adds "of Prosperity" suffix: +12% coin bonus', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'fortune', statValue: 12, slot: 'suffix', name: 'of Prosperity', description: 'Adds +12% coin bonus to equipment' } },
  // Phase 3.4: Special legendary inscriptions (lifesteal & autoclick) - Extremely rare
  { lootId: 'prefix_lifesteal_legendary', name: 'Vampiric Prefix Scroll', icon: '📜', description: 'Adds "Vampiric" prefix: +2% lifesteal (cannot stack with lifesteal suffix)', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'lifesteal', statValue: 2, slot: 'prefix', name: 'Vampiric', description: 'Adds +2% lifesteal to equipment - heals for 2% of damage dealt (exclusive with lifesteal suffix)' } },
  { lootId: 'suffix_autoclick_legendary', name: 'Suffix of Eternity Scroll', icon: '📜', description: 'Adds "of Eternity" suffix: +1 auto-hit/sec (cannot stack with autoclick prefix)', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'autoclick', statValue: 1, slot: 'suffix', name: 'of Eternity', description: 'Adds +1 auto-hit per second to equipment (exclusive with autoclick prefix)' } },
];

// === BIOME-SPECIFIC LOOT (Phase 1.5 & 1.6) ===

// Forest Wolf & Bandit Raccoon Specific Loot (Forest Tier 1, Common Monsters)
const FOREST_WOLF_SPECIFIC: LootItem[] = [
  { lootId: 'wolf_pelt', name: 'Wolf Pelt', icon: '🐺', description: 'Soft and warm fur', rarity: 'common', type: 'material' },
  { lootId: 'wolf_fang', name: 'Wolf Fang', icon: '🦷', description: 'Sharp canine tooth', rarity: 'common', type: 'material' },
  { lootId: 'leather_vest', name: 'Leather Vest', icon: '🧥', description: 'Basic protective gear', rarity: 'common', type: 'armor', equipmentStats: { defense: 5 } },
  { lootId: 'hunter_dagger', name: 'Hunter\'s Dagger', icon: '🗡️', description: 'A reliable hunting blade', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 3 } },
  { lootId: 'stolen_coin', name: 'Stolen Gold', icon: '🪙', description: 'Ill-gotten gains', rarity: 'common', type: 'material' },
  { lootId: 'bandana', name: 'Bandit Bandana', icon: '🏴', description: 'Worn by forest outlaws', rarity: 'rare', type: 'artifact', equipmentStats: { coinBonus: 10 } },
  { lootId: 'lockpick_set', name: 'Lockpicks', icon: '🔓', description: 'Opens treasure chests', rarity: 'common', type: 'material' },
];

// Wild Boar Specific Loot (Forest Tier 1, Rare Monster)
const WILD_BOAR_SPECIFIC: LootItem[] = [
  { lootId: 'boar_hide', name: 'Boar Hide', icon: '🐗', description: 'Thick and tough leather', rarity: 'rare', type: 'material' },
  { lootId: 'boar_tusk', name: 'Boar Tusk', icon: '🦷', description: 'Curved ivory horn', rarity: 'rare', type: 'material' },
  { lootId: 'heavy_armor', name: 'Heavy Leather Armor', icon: '🛡️', description: 'Reinforced protection', rarity: 'rare', type: 'armor', equipmentStats: { defense: 10, maxHpBonus: 10 } },
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
  { lootId: 'guardian_armor', name: 'Guardian\'s Bark Armor', icon: '🛡️', description: 'Nature\'s protection', rarity: 'epic', type: 'armor', equipmentStats: { defense: 15, maxHpBonus: 20 } },
  { lootId: 'nature_blade', name: 'Nature\'s Wrath', icon: '🗡️', description: 'Living weapon', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 5, critChance: 8 } },
  { lootId: 'forest_crown', name: 'Crown of the Forest', icon: '👑', description: 'Blessed by the ancients', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 15, coinBonus: 10 } },
  // Heal-focused items (nature healing theme)
  { lootId: 'medics_robe', name: 'Medic\'s Robe', icon: '🧥', description: 'Blessed by forest healers (+6% heal)', rarity: 'epic', type: 'armor', equipmentStats: { defense: 8, maxHpBonus: 12, healBonus: 6 } },
  { lootId: 'amulet_of_life', name: 'Amulet of Life', icon: '🌿', description: 'Channels nature\'s vitality (+8% heal)', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 15, healBonus: 8 } },
  { lootId: 'spell_scroll_heal', name: 'Nature\'s Blessing Scroll', icon: '📜', description: 'Unlocks Nature\'s Blessing spell - Powerful heal + shield', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'minor_heal', spellName: 'Nature\'s Blessing', cooldown: 25, healing: 50, buffType: 'shield', buffValue: 60, duration: 15, effect: 'Heal + shield' } },
  // Phase 3.4: Epic inscription scrolls (mini-boss drops)
  { lootId: 'prefix_healing_epic', name: 'Renewing Prefix Scroll', icon: '📜', description: 'Adds "Renewing" prefix: +8% heal bonus', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'healing', statValue: 8, slot: 'prefix', name: 'Renewing', description: 'Adds +8% heal bonus to equipment' } },
  { lootId: 'suffix_vitality_epic', name: 'Suffix of Endurance Scroll', icon: '📜', description: 'Adds "of Endurance" suffix: +32 max HP', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 32, slot: 'suffix', name: 'of Endurance', description: 'Adds +32 maximum HP to equipment' } },
];

// Dire Wolf Alpha Specific Loot (Forest Tier 1+, Epic Mini-Boss)
const DIRE_WOLF_ALPHA_SPECIFIC: LootItem[] = [
  { lootId: 'alpha_pelt', name: 'Alpha Wolf Pelt', icon: '🐺', description: 'Thick fur from a pack leader', rarity: 'epic', type: 'material' },
  { lootId: 'alpha_fang', name: 'Alpha Wolf Fang', icon: '🦷', description: 'Legendary canine tooth', rarity: 'epic', type: 'material' },
  { lootId: 'pack_emblem', name: 'Pack Leader Emblem', icon: '🐺', description: 'Symbol of wolf pack dominance', rarity: 'epic', type: 'material' },
  { lootId: 'alpha_blade', name: 'Alpha Fang Sword', icon: '⚔️', description: 'Forged from the alpha\'s fang', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 5, critChance: 11, attackSpeed: 8 } },
  { lootId: 'alpha_armor', name: 'Alpha Pelt Armor', icon: '🛡️', description: 'Legendary wolf hide protection', rarity: 'epic', type: 'armor', equipmentStats: { defense: 14, maxHpBonus: 18 } },
  { lootId: 'pack_totem', name: 'Pack Leader\'s Totem', icon: '🗿', description: 'Commands respect from all beasts', rarity: 'epic', type: 'artifact', equipmentStats: { damageBonus: 3, critChance: 9, coinBonus: 15 } },
];

// Ancient Ent Specific Loot (Forest Tier 3+, Legendary Boss)
const ANCIENT_ENT_SPECIFIC: LootItem[] = [
  { lootId: 'eternal_wood', name: 'Eternal Wood', icon: '🌲', description: 'Wood that never decays', rarity: 'legendary', type: 'material' },
  { lootId: 'ancient_sap', name: 'Ancient Sap', icon: '💧', description: 'Millennium-old tree sap', rarity: 'legendary', type: 'material' },
  { lootId: 'millennium_root', name: 'Millennium Root', icon: '🌿', description: 'Root from the oldest tree', rarity: 'legendary', type: 'material' },
  { lootId: 'natures_judgment', name: 'Nature\'s Judgment', icon: '🪄', description: 'Ancient staff of the forest - balanced power and utility', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 7, critChance: 13, attackSpeed: 8 } },
  { lootId: 'ancient_bark_plate', name: 'Ancient Bark Plate', icon: '🛡️', description: 'Millennium-old protection', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 24, maxHpBonus: 55 } },
  { lootId: 'heart_of_forest', name: 'Heart of the Forest', icon: '💚', description: 'Essence of all nature', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 45, critChance: 14, coinBonus: 65 } },
  // Legendary heal-focused items (ultimate sustainability)
  { lootId: 'heart_crystal', name: 'Heart Crystal', icon: '💎', description: 'Ancient crystal pulsing with life (+12% heal)', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 40, healBonus: 12 } },
  { lootId: 'lifebringers_crown', name: 'Lifebringer\'s Crown', icon: '👑', description: 'Crown of the eternal healer (+15% heal)', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 50, healBonus: 15, defense: 10 } },
  { lootId: 'spell_scroll_earthquake', name: 'Earthquake Scroll', icon: '📜', description: 'Unlocks Earthquake spell - Massive earth damage + stun', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'earthquake', spellName: 'Earthquake', cooldown: 45, damage: 140, debuffType: 'stun', debuffValue: 100, duration: 4, effect: 'Massive earth damage + stun' } },
];

// Sand Scorpion Specific Loot (Desert Tier 1, Common Monster)
const SAND_SCORPION_SPECIFIC: LootItem[] = [
  { lootId: 'scorpion_tail', name: 'Scorpion Tail', icon: '🦂', description: 'Contains venom sac', rarity: 'common', type: 'material' },
  { lootId: 'chitin_shard', name: 'Chitin Shard', icon: '🪨', description: 'Hard exoskeleton piece', rarity: 'common', type: 'material' },
  { lootId: 'desert_cloth', name: 'Desert Wraps', icon: '🧣', description: 'Protects from heat and venom', rarity: 'common', type: 'armor', equipmentStats: { defense: 6 } },
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
  { lootId: 'fire_resist_charm', name: 'Flame Ward Amulet', icon: '📿', description: 'Protects from fire (+50% fire resist)', rarity: 'rare', type: 'artifact', equipmentStats: { maxHpBonus: 5, fireResistance: 50 } },
  { lootId: 'fire_potion', name: 'Fire Resistance Potion', icon: '🧪', description: 'Immune to burn for 30s (+100% fire resist)', rarity: 'rare', type: 'consumable', cooldown: 12, buffData: { buffType: 'fire_resistance', buffValue: 100, duration: 30 } },
];

// Sand Djinn Specific Loot (Desert Tier 1, Epic Mini-Boss)
const SAND_DJINN_SPECIFIC: LootItem[] = [
  { lootId: 'djinn_essence', name: 'Djinn Essence', icon: '🧞', description: 'Bottled magic', rarity: 'epic', type: 'material' },
  { lootId: 'desert_gem', name: 'Desert Sapphire', icon: '💎', description: 'Shimmers with heat', rarity: 'epic', type: 'material' },
  { lootId: 'djinn_scimitar', name: 'Djinn\'s Scimitar', icon: '⚔️', description: 'Curved blade of legend', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 5, critChance: 12, attackSpeed: 5 } },
  { lootId: 'sand_armor', name: 'Djinn\'s Sand Armor', icon: '🛡️', description: 'Flows like sand', rarity: 'epic', type: 'armor', equipmentStats: { defense: 12, maxHpBonus: 15 } },
  { lootId: 'mirage_cloak', name: 'Mirage Cloak', icon: '🧥', description: 'Bends light around wearer', rarity: 'epic', type: 'artifact', equipmentStats: { coinBonus: 15 } },
  { lootId: 'spell_scroll_fireball', name: 'Fireball Scroll', icon: '📜', description: 'Unlocks Fireball spell - Explosive fire damage + burn', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'fireball', spellName: 'Fireball', cooldown: 30, damage: 80, debuffType: 'burn', debuffValue: 12, debuffDamageType: 'flat', duration: 8, effect: 'Fire damage + burn DoT' } },
  // Phase 3.4: Epic inscription scrolls (mini-boss drops)
  { lootId: 'prefix_haste_epic', name: 'Nimble Prefix Scroll', icon: '📜', description: 'Adds "Nimble" prefix: +8 attack speed', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'haste', statValue: 8, slot: 'prefix', name: 'Nimble', description: 'Adds +8 attack speed to equipment' } },
  { lootId: 'suffix_fortune_epic', name: 'Suffix of Greed Scroll', icon: '📜', description: 'Adds "of Greed" suffix: +8% coin bonus', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'fortune', statValue: 8, slot: 'suffix', name: 'of Greed', description: 'Adds +8% coin bonus to equipment' } },
];

// Sandstone Golem Specific Loot (Desert Tier 2+, Epic Mini-Boss)
const SANDSTONE_GOLEM_SPECIFIC: LootItem[] = [
  { lootId: 'sandstone_core', name: 'Sandstone Core', icon: '🗿', description: 'Ancient stone heart', rarity: 'epic', type: 'material' },
  { lootId: 'hardened_sand', name: 'Hardened Sand', icon: '🪨', description: 'Compressed over millennia', rarity: 'epic', type: 'material' },
  { lootId: 'stone_fist', name: 'Stone Fist Fragment', icon: '✊', description: 'Piece of the golem\'s weapon', rarity: 'epic', type: 'material' },
  { lootId: 'golem_hammer', name: 'Golem\'s Wrath Hammer', icon: '🔨', description: 'Crushes with ancient power', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 10, maxHpBonus: 15 } },
  { lootId: 'sandstone_armor', name: 'Sandstone Plate', icon: '🛡️', description: 'Impenetrable stone armor', rarity: 'epic', type: 'armor', equipmentStats: { defense: 16, maxHpBonus: 25 } },
  { lootId: 'desert_stone_amulet', name: 'Desert Stone Amulet', icon: '📿', description: 'Grants earth\'s endurance', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 20, defense: 8 } },
];

// Desert Phoenix Specific Loot (Desert Tier 3+, Legendary Boss)
const DESERT_PHOENIX_SPECIFIC: LootItem[] = [
  { lootId: 'phoenix_ash', name: 'Phoenix Ash', icon: '🦅', description: 'Ashes of rebirth', rarity: 'legendary', type: 'material' },
  { lootId: 'rebirth_flame', name: 'Rebirth Flame', icon: '🔥', description: 'Never-ending fire', rarity: 'legendary', type: 'material' },
  { lootId: 'phoenix_plume', name: 'Phoenix Plume', icon: '🪶', description: 'Feather of resurrection', rarity: 'legendary', type: 'material' },
  { lootId: 'phoenix_talon', name: 'Phoenix Talon Blade', icon: '⚔️', description: 'Forged from eternal flames - sustain-focused blade for tank builds', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 10, attackSpeed: 15, defense: 10, maxHpBonus: 25, lifesteal: 4 } },
  { lootId: 'phoenix_plate', name: 'Phoenix Flame Plate', icon: '🛡️', description: 'Armor of rebirth', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 26, maxHpBonus: 65 } },
  { lootId: 'eternal_flame_orb', name: 'Eternal Flame Orb', icon: '🔮', description: 'Contains the phoenix\'s power', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 5, maxHpBonus: 50, critChance: 18, coinBonus: 75 } },
  { lootId: 'spell_scroll_phoenix_fire', name: 'Phoenix Fire Scroll', icon: '📜', description: 'Unlocks Phoenix Fire spell - Massive fire damage + burn + self-heal', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'phoenix_fire', spellName: 'Phoenix Fire', cooldown: 50, damage: 180, healing: 40, debuffType: 'burn', debuffValue: 15, debuffDamageType: 'flat', duration: 10, effect: 'Massive fire damage + burn + heal' } },
];

// === OCEAN BIOME LOOT (Phase 2.4) ===

// Coral Crab Specific Loot (Ocean Tier 1, Common Monster)
const CORAL_CRAB_SPECIFIC: LootItem[] = [
  { lootId: 'coral_fragment', name: 'Coral Fragment', icon: '🪸', description: 'Hardened sea coral', rarity: 'common', type: 'material' },
  { lootId: 'crab_shell', name: 'Crab Shell', icon: '🦀', description: 'Natural armor', rarity: 'common', type: 'material' },
  { lootId: 'crab_claw', name: 'Crab Claw', icon: '🦀', description: 'Pincer weapon', rarity: 'common', type: 'material' },
  { lootId: 'shell_armor', name: 'Shell Armor', icon: '🛡️', description: 'Reinforced with crab shell', rarity: 'common', type: 'armor', equipmentStats: { defense: 7, maxHpBonus: 5 } },
  { lootId: 'coral_dagger', name: 'Coral Dagger', icon: '🗡️', description: 'Sharp as a reef', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 3 } },
];

// Giant Jellyfish Specific Loot (Ocean Tier 1, Common Monster)
const GIANT_JELLYFISH_SPECIFIC: LootItem[] = [
  { lootId: 'jellyfish_tentacle', name: 'Jellyfish Tentacle', icon: '🪼', description: 'Stings on contact', rarity: 'common', type: 'material' },
  { lootId: 'bioluminescent_gel', name: 'Bioluminescent Gel', icon: '💧', description: 'Glows in the dark', rarity: 'common', type: 'material' },
  { lootId: 'sea_potion', name: 'Sea Potion', icon: '🧪', description: 'Restores 25 HP', rarity: 'common', type: 'consumable', cooldown: 6, healing: 25 },
  { lootId: 'jelly_armor', name: 'Jellyfish Membrane', icon: '🛡️', description: 'Flexible protection', rarity: 'common', type: 'armor', equipmentStats: { defense: 5, maxHpBonus: 8 } },
  { lootId: 'stinger_whip', name: 'Stinger Whip', icon: '🪢', description: 'Paralyzing strikes', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 1, attackSpeed: 8 } },
];

// Frost Shark Specific Loot (Ocean Tier 1-2, Rare Monster)
const FROST_SHARK_SPECIFIC: LootItem[] = [
  { lootId: 'shark_tooth', name: 'Frost Shark Tooth', icon: '🦈', description: 'Cold as ice', rarity: 'rare', type: 'material' },
  { lootId: 'frozen_scale', name: 'Frozen Scale', icon: '❄️', description: 'Never melts', rarity: 'rare', type: 'material' },
  { lootId: 'shark_fin', name: 'Shark Fin', icon: '🦈', description: 'Razor sharp', rarity: 'rare', type: 'material' },
  { lootId: 'frost_blade', name: 'Frost Blade', icon: '🗡️', description: 'Freezes enemies', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 3, critChance: 7 } },
  { lootId: 'ice_armor', name: 'Frost Guard Armor', icon: '🛡️', description: 'Chills attackers', rarity: 'rare', type: 'armor', equipmentStats: { defense: 11, maxHpBonus: 12 } },
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
  { lootId: 'tidal_armor', name: 'Tidal Scale Armor', icon: '🛡️', description: 'Flows like water', rarity: 'epic', type: 'armor', equipmentStats: { defense: 14, maxHpBonus: 18 } },
  { lootId: 'ocean_crown', name: 'Crown of the Deep', icon: '👑', description: 'Commands the seas', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 20, coinBonus: 15 } },
];

// Kraken Specific Loot (Ocean Tier 2+, Epic Mini-Boss)
const KRAKEN_SPECIFIC: LootItem[] = [
  { lootId: 'kraken_tentacle', name: 'Kraken Tentacle', icon: '🐙', description: 'Massive and powerful', rarity: 'epic', type: 'material' },
  { lootId: 'abyssal_ink', name: 'Abyssal Ink', icon: '💧', description: 'Darkness incarnate', rarity: 'epic', type: 'material' },
  { lootId: 'deep_sea_pearl', name: 'Deep Sea Pearl', icon: '💎', description: 'From the ocean depths', rarity: 'epic', type: 'material' },
  { lootId: 'tentacle_whip', name: 'Kraken\'s Whip', icon: '🪢', description: 'Crushes with tentacle power', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 11, maxHpBonus: 12 } },
  { lootId: 'kraken_armor', name: 'Kraken Scale Armor', icon: '🛡️', description: 'Forged from kraken hide', rarity: 'epic', type: 'armor', equipmentStats: { defense: 16, maxHpBonus: 22 } },
  { lootId: 'abyssal_amulet', name: 'Abyssal Amulet', icon: '📿', description: 'Commands the deep ocean', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 18, critChance: 8, coinBonus: 18 } },
];

// Leviathan Specific Loot (Ocean Tier 3+, Legendary Boss)
const LEVIATHAN_SPECIFIC: LootItem[] = [
  { lootId: 'leviathan_scale', name: 'Leviathan Scale', icon: '🐋', description: 'Massive and ancient', rarity: 'legendary', type: 'material' },
  { lootId: 'ocean_heart', name: 'Heart of the Ocean', icon: '💙', description: 'Pulses with the sea\'s power', rarity: 'legendary', type: 'material' },
  { lootId: 'trident', name: 'Poseidon\'s Trident', icon: '🔱', description: 'Legendary three-pronged spear - balanced power and utility', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 13, attackSpeed: 10 } },
  { lootId: 'leviathan_armor', name: 'Leviathan Plate', icon: '🛡️', description: 'Unbreakable defense', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 22, maxHpBonus: 50 } },
  { lootId: 'tidal_orb', name: 'Tidal Orb', icon: '🔮', description: 'Controls water itself', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 40, critChance: 15, coinBonus: 60 } },
  { lootId: 'spell_scroll_tsunami', name: 'Tsunami Scroll', icon: '📜', description: 'Unlocks Tsunami spell - Massive water damage + slow', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'tsunami', spellName: 'Tsunami', cooldown: 45, damage: 120, debuffType: 'slow', debuffValue: 75, duration: 10, effect: 'Massive water damage + slow' } },
];

// === VOLCANO BIOME LOOT (Phase 2.4) ===

// Lava Salamander Specific Loot (Volcano Tier 1, Common Monster)
const LAVA_SALAMANDER_SPECIFIC: LootItem[] = [
  { lootId: 'molten_scale', name: 'Molten Scale', icon: '🦎', description: 'Still hot to touch', rarity: 'common', type: 'material' },
  { lootId: 'salamander_tail', name: 'Salamander Tail', icon: '🦎', description: 'Regrows when cut', rarity: 'common', type: 'material' },
  { lootId: 'lava_stone', name: 'Lava Stone', icon: '🪨', description: 'Glows with inner heat', rarity: 'common', type: 'material' },
  { lootId: 'flame_cloak', name: 'Flame Cloak', icon: '🧥', description: 'Resists fire (+30% fire resist)', rarity: 'common', type: 'armor', equipmentStats: { defense: 6, fireResistance: 30 } },
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
  { lootId: 'obsidian_armor', name: 'Obsidian Plate', icon: '🛡️', description: 'Volcanic glass armor', rarity: 'rare', type: 'armor', equipmentStats: { defense: 12, maxHpBonus: 10 } },
  { lootId: 'lava_potion', name: 'Lava Potion', icon: '🧪', description: 'Fire resistance + restores 30 HP (+75% fire resist for 20s)', rarity: 'rare', type: 'consumable', cooldown: 9, healing: 30, buffData: { buffType: 'fire_resistance', buffValue: 75, duration: 20 } },
];

// Inferno Imp Specific Loot (Volcano Tier 1-2, Rare Monster)
const INFERNO_IMP_SPECIFIC: LootItem[] = [
  { lootId: 'demon_horn_shard', name: 'Demon Horn Shard', icon: '👹', description: 'Fragment of infernal power', rarity: 'rare', type: 'material' },
  { lootId: 'imp_claw', name: 'Imp Claw', icon: '👹', description: 'Wickedly sharp', rarity: 'rare', type: 'material' },
  { lootId: 'hellfire_dagger', name: 'Hellfire Dagger', icon: '🗡️', description: 'Cursed flames', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 3, critChance: 9 } },
  { lootId: 'inferno_ring', name: 'Ring of Inferno', icon: '💍', description: 'Enhances fire attacks', rarity: 'rare', type: 'artifact', equipmentStats: { damageBonus: 2, critChance: 8 } },
  { lootId: 'brimstone_armor', name: 'Brimstone Armor', icon: '🛡️', description: 'Demonic protection', rarity: 'rare', type: 'armor', equipmentStats: { defense: 10, maxHpBonus: 8 } },
];

// Fire Drake Specific Loot (Volcano Tier 1+, Epic Mini-Boss)
const FIRE_DRAKE_SPECIFIC: LootItem[] = [
  { lootId: 'drake_scale', name: 'Fire Drake Scale', icon: '🐲', description: 'Impervious to flames', rarity: 'epic', type: 'material' },
  { lootId: 'drake_claw', name: 'Drake Claw', icon: '🦅', description: 'Sharp and scorching', rarity: 'epic', type: 'material' },
  { lootId: 'dragonfire_sword', name: 'Dragonfire Sword', icon: '⚔️', description: 'Blazing with dragonfire', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 12, attackSpeed: 6 } },
  { lootId: 'drake_armor', name: 'Drake Scale Armor', icon: '🛡️', description: 'Forged from drake scales', rarity: 'epic', type: 'armor', equipmentStats: { defense: 15, maxHpBonus: 22 } },
  { lootId: 'flame_pendant', name: 'Flame Pendant', icon: '📿', description: 'Burns eternally', rarity: 'epic', type: 'artifact', equipmentStats: { critChance: 10, coinBonus: 18 } },
];

// Volcanic Titan Specific Loot (Volcano Tier 2+, Epic Mini-Boss)
const VOLCANIC_TITAN_SPECIFIC: LootItem[] = [
  { lootId: 'titan_core', name: 'Volcanic Titan Core', icon: '🔥', description: 'Burning heart of a titan', rarity: 'epic', type: 'material' },
  { lootId: 'molten_stone', name: 'Molten Stone', icon: '🪨', description: 'Forever burning rock', rarity: 'epic', type: 'material' },
  { lootId: 'lava_crystal', name: 'Lava Crystal', icon: '💎', description: 'Crystallized lava', rarity: 'epic', type: 'material' },
  { lootId: 'titan_fist', name: 'Titan Fist Gauntlet', icon: '✊', description: 'Strikes with volcanic fury', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 7, critChance: 10, maxHpBonus: 15 } },
  { lootId: 'molten_plate', name: 'Molten Titan Plate', icon: '🛡️', description: 'Volcanic armor of legends', rarity: 'epic', type: 'armor', equipmentStats: { defense: 17, maxHpBonus: 28 } },
  { lootId: 'eruption_ring', name: 'Ring of Eruption', icon: '💍', description: 'Harnesses volcanic power', rarity: 'epic', type: 'artifact', equipmentStats: { damageBonus: 4, critChance: 9, coinBonus: 16 } },
];

// Ancient Dragon Specific Loot (Volcano Tier 3+, Legendary Boss)
const ANCIENT_DRAGON_SPECIFIC: LootItem[] = [
  { lootId: 'ancient_dragon_scale', name: 'Ancient Dragon Scale', icon: '🐉', description: 'Legendary protection', rarity: 'legendary', type: 'material' },
  { lootId: 'dragon_soul', name: 'Dragon Soul', icon: '🔥', description: 'Essence of dragonkind', rarity: 'legendary', type: 'material' },
  { lootId: 'excalibur', name: 'Excalibur', icon: '⚔️', description: 'The legendary sword - balanced power for versatile warriors', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 7, critChance: 14, attackSpeed: 8 } },
  { lootId: 'ancient_dragon_armor', name: 'Ancient Dragon Plate', icon: '🛡️', description: 'Ultimate protection - ancient scales retaliate fiercely', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 25, maxHpBonus: 60, thorns: 18 } },
  { lootId: 'dragon_amulet', name: 'Dragon Amulet', icon: '💎', description: 'Grants dragon\'s power', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 6, maxHpBonus: 45, critChance: 16 } },
  { lootId: 'spell_scroll_meteor', name: 'Meteor Scroll', icon: '📜', description: 'Unlocks Meteor spell - Devastating impact + burn', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'meteor', spellName: 'Meteor Strike', cooldown: 40, damage: 150, debuffType: 'burn', debuffValue: 20, debuffDamageType: 'flat', duration: 12, effect: 'Massive fire damage + burn' } },
];

// === CASTLE BIOME LOOT (Phase 2.4) ===

// Skeleton Warrior Specific Loot (Castle Tier 1, Common Monster)
const SKELETON_WARRIOR_SPECIFIC: LootItem[] = [
  { lootId: 'bone_shard', name: 'Bone Shard', icon: '🦴', description: 'Brittle but sharp', rarity: 'common', type: 'material' },
  { lootId: 'warrior_skull', name: 'Warrior Skull', icon: '💀', description: 'Ancient and weathered', rarity: 'common', type: 'material' },
  { lootId: 'rusty_sword', name: 'Rusty Sword', icon: '⚔️', description: 'Aged but deadly', rarity: 'common', type: 'weapon', equipmentStats: { damageBonus: 2 } },
  { lootId: 'bone_armor', name: 'Bone Armor', icon: '🛡️', description: 'Assembled from skeletons', rarity: 'common', type: 'armor', equipmentStats: { defense: 7, maxHpBonus: 5 } },
  { lootId: 'bone_dagger', name: 'Bone Dagger', icon: '🗡️', description: 'Sharpened rib', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 2, critChance: 6 } },
];

// Cursed Spirit Specific Loot (Castle Tier 1, Common Monster)
const CURSED_SPIRIT_SPECIFIC: LootItem[] = [
  { lootId: 'cursed_cloth', name: 'Cursed Cloth', icon: '👻', description: 'Tattered and haunted', rarity: 'common', type: 'material' },
  { lootId: 'ectoplasm_vial', name: 'Ectoplasm Vial', icon: '💧', description: 'Ghostly essence', rarity: 'common', type: 'material' },
  { lootId: 'spirit_vial', name: 'Spirit Vial', icon: '🧪', description: 'Contains spectral energy, restores 20 HP', rarity: 'common', type: 'consumable', cooldown: 7, healing: 20 },
  { lootId: 'spectral_robes', name: 'Spectral Robes', icon: '🧥', description: 'Ethereal protection', rarity: 'common', type: 'armor', equipmentStats: { defense: 5, maxHpBonus: 8 } },
  { lootId: 'haunted_pendant', name: 'Haunted Pendant', icon: '📿', description: 'Whispers dark secrets', rarity: 'rare', type: 'artifact', equipmentStats: { maxHpBonus: 5, coinBonus: 8 } },
];

// Vampire Lord Specific Loot (Castle Tier 1-2, Rare Monster)
const VAMPIRE_LORD_SPECIFIC: LootItem[] = [
  { lootId: 'vampire_fang', name: 'Vampire Fang', icon: '🦷', description: 'Drains life force', rarity: 'rare', type: 'material' },
  { lootId: 'blood_vial', name: 'Blood Vial', icon: '🩸', description: 'Contains vampiric blood', rarity: 'rare', type: 'material' },
  { lootId: 'blood_sword', name: 'Blood Sword', icon: '🗡️', description: 'Thirsts for blood', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 3, critChance: 8, maxHpBonus: 5 } },
  { lootId: 'vampire_cape', name: 'Vampire Cape', icon: '🧛', description: 'Grants night power - heals from damage taken', rarity: 'rare', type: 'armor', equipmentStats: { defense: 10, maxHpBonus: 12, defensiveLifesteal: 3 } },
  { lootId: 'crimson_ring', name: 'Crimson Ring', icon: '💍', description: 'Drains enemies', rarity: 'epic', type: 'artifact', equipmentStats: { critChance: 10, maxHpBonus: 8 } },
];

// Death Knight Specific Loot (Castle Tier 1-2, Rare Monster)
const DEATH_KNIGHT_SPECIFIC: LootItem[] = [
  { lootId: 'dark_steel', name: 'Dark Steel', icon: '⚫', description: 'Forged in darkness', rarity: 'rare', type: 'material' },
  { lootId: 'cursed_blade_fragment', name: 'Cursed Blade Fragment', icon: '⚔️', description: 'Piece of a legendary sword', rarity: 'rare', type: 'material' },
  { lootId: 'necrotic_sword', name: 'Necrotic Sword', icon: '⚔️', description: 'Drains life on hit', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 4, critChance: 7 } },
  { lootId: 'death_armor', name: 'Death Knight Armor', icon: '🛡️', description: 'Forged for the undead - absorbs life and curses attackers', rarity: 'rare', type: 'armor', equipmentStats: { defense: 13, maxHpBonus: 15, defensiveLifesteal: 3, thorns: 8 } },
  { lootId: 'shadow_ring', name: 'Shadow Ring', icon: '💍', description: 'Hides in darkness', rarity: 'rare', type: 'artifact', equipmentStats: { attackSpeed: 12, coinBonus: 10 } },
];

// Necromancer Specific Loot (Castle Tier 1+, Epic Mini-Boss)
const NECROMANCER_SPECIFIC: LootItem[] = [
  { lootId: 'necrotic_essence', name: 'Necrotic Essence', icon: '🧙', description: 'Pure death magic', rarity: 'epic', type: 'material' },
  { lootId: 'dark_crystal', name: 'Dark Crystal', icon: '🔮', description: 'Channels necromancy', rarity: 'epic', type: 'material' },
  { lootId: 'staff_of_souls', name: 'Staff of Souls', icon: '🪄', description: 'Commands the dead', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 5, critChance: 11, attackSpeed: 10 } },
  { lootId: 'necro_robes', name: 'Necromancer\'s Robes', icon: '🧥', description: 'Radiates dark power - siphons life force', rarity: 'epic', type: 'armor', equipmentStats: { defense: 10, maxHpBonus: 25, defensiveLifesteal: 4 } },
  { lootId: 'phylactery', name: 'Phylactery', icon: '⚱️', description: 'Stores a soul', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 30, coinBonus: 20 } },
];

// Wraith Lord Specific Loot (Castle Tier 2+, Epic Mini-Boss)
const WRAITH_LORD_SPECIFIC: LootItem[] = [
  { lootId: 'wraith_essence', name: 'Wraith Essence', icon: '👤', description: 'Pure spectral energy', rarity: 'epic', type: 'material' },
  { lootId: 'shadow_crystal', name: 'Shadow Crystal', icon: '🔮', description: 'Crystallized darkness', rarity: 'epic', type: 'material' },
  { lootId: 'spectral_shard', name: 'Spectral Shard', icon: '💎', description: 'Fragment of the afterlife', rarity: 'epic', type: 'material' },
  { lootId: 'wraith_blade', name: 'Wraith Lord\'s Blade', icon: '⚔️', description: 'Phases through armor', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 13, attackSpeed: 10 } },
  { lootId: 'shadow_armor', name: 'Shadow Lord Armor', icon: '🛡️', description: 'Ethereal protection', rarity: 'epic', type: 'armor', equipmentStats: { defense: 14, maxHpBonus: 26 } },
  { lootId: 'wraith_crown', name: 'Crown of Shadows', icon: '👑', description: 'Rules over the dead', rarity: 'epic', type: 'artifact', equipmentStats: { maxHpBonus: 22, critChance: 10, coinBonus: 20 } },
];

// Lich King Specific Loot (Castle Tier 3+, Legendary Boss)
const LICH_KING_SPECIFIC: LootItem[] = [
  { lootId: 'lich_crown', name: 'Crown of the Lich King', icon: '👑', description: 'Ultimate undead power', rarity: 'legendary', type: 'material' },
  { lootId: 'void_essence', name: 'Void Essence', icon: '⚫', description: 'Pure nothingness', rarity: 'legendary', type: 'material' },
  { lootId: 'scarlet_dagger', name: 'Scarlet Dagger', icon: '🗡️', description: 'Pure offensive power - no defensive capabilities', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 9, critChance: 18 } },
  { lootId: 'lich_plate', name: 'Lich King\'s Plate', icon: '🛡️', description: 'Eternal protection', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 28, maxHpBonus: 70 } },
  { lootId: 'death_orb', name: 'Orb of Eternal Death', icon: '🔮', description: 'Controls life and death', rarity: 'legendary', type: 'artifact', equipmentStats: { maxHpBonus: 50, critChance: 20, coinBonus: 80 } },
  { lootId: 'spell_scroll_death', name: 'Death Comet Scroll', icon: '📜', description: 'Unlocks Death Comet spell - Ultimate dark damage + bleed + self-empower', rarity: 'legendary', type: 'spell_scroll', spellData: { spellId: 'death_comet', spellName: 'Death Comet', cooldown: 50, damage: 200, buffType: 'damage_boost', buffValue: 25, duration: 15, debuffType: 'bleed', debuffValue: 18, debuffDamageType: 'flat', effect: 'Massive dark damage + bleed + damage boost' } },
];

// ============================
// CRAFT-ONLY ITEMS
// These items can ONLY be obtained through crafting, not monster drops
// ============================

const CRAFT_ONLY_WEAPONS: LootItem[] = [
  { lootId: 'masterwork_blade', name: 'Masterwork Blade', icon: '⚔️', description: 'Perfectly balanced steel sword', rarity: 'rare', type: 'weapon', equipmentStats: { damageBonus: 4, critChance: 10 } },
  { lootId: 'alchemists_staff', name: 'Alchemist\'s Staff', icon: '🪄', description: 'Infused with magical properties', rarity: 'epic', type: 'weapon', equipmentStats: { damageBonus: 6, critChance: 12, attackSpeed: 8 } },
  { lootId: 'vorpal_blade', name: 'Vorpal Blade', icon: '🗡️', description: 'Legendary blade that strikes true - pure glass cannon offense', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 9, critChance: 18 } },
  { lootId: 'tidal_reaver', name: 'Tidal Reaver', icon: '🔱', description: 'Legendary trident of the sea - balanced power and speed', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 8, critChance: 14, attackSpeed: 12 } },
  { lootId: 'infernal_claymore', name: 'Infernal Claymore', icon: '⚔️', description: 'Forged in volcanic fury - power with endurance', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 8, critChance: 13, maxHpBonus: 20 } },
  { lootId: 'reaper_scythe', name: 'Reaper\'s Scythe', icon: '🗡️', description: 'Harvests souls of the living - balanced offense and survivability', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 7, critChance: 16, maxHpBonus: 30 } },
  // Phase 2.5 - Advanced Legendary Items with special effects
  { lootId: 'excalibur', name: 'Excalibur', icon: '⚔️', description: 'The legendary sword of kings - strikes with divine fury (auto-attacks)', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 8, critChance: 15, autoClickRate: 1 } },
  { lootId: 'scarlet_dagger', name: 'Scarlet Dagger', icon: '🗡️', description: 'Crimson blade that thirsts for blood - heals with every strike', rarity: 'legendary', type: 'weapon', equipmentStats: { damageBonus: 7, critChance: 16, lifesteal: 3 } },
];

const CRAFT_ONLY_ARMOR: LootItem[] = [
  { lootId: 'reinforced_steel_plate', name: 'Reinforced Steel Plate', icon: '🛡️', description: 'Heavy spiked armor punishes attackers', rarity: 'rare', type: 'armor', equipmentStats: { defense: 15, maxHpBonus: 20, thorns: 10 } },
  { lootId: 'enchanted_silk_robes', name: 'Enchanted Silk Robes', icon: '🧥', description: 'Light armor imbued with protective magic', rarity: 'epic', type: 'armor', equipmentStats: { defense: 12, maxHpBonus: 35, attackSpeed: 10 } },
  { lootId: 'healers_plate', name: 'Healer\'s Plate', icon: '🛡️', description: 'Armor infused with restoration magic (+10% heal, 5% defensive lifesteal)', rarity: 'epic', type: 'armor', equipmentStats: { defense: 14, maxHpBonus: 30, healBonus: 10, defensiveLifesteal: 5 } },
  // NEW: Archetype-specific epic armor
  { lootId: 'assassins_leathers', name: 'Assassin\'s Leathers', icon: '🥋', description: 'Light armor designed for precision strikes - sacrifices all protection for deadly accuracy', rarity: 'epic', type: 'armor', equipmentStats: { critChance: 18 } },
  { lootId: 'battle_robes', name: 'Battle Robes', icon: '🧥', description: 'Enchanted robes offering balanced protection and utility', rarity: 'epic', type: 'armor', equipmentStats: { defense: 14, maxHpBonus: 22, attackSpeed: 8 } },
  { lootId: 'bulwark_plate', name: 'Bulwark Plate', icon: '🛡️', description: 'Impenetrable heavy armor that slows your reactions but grants unmatched protection', rarity: 'epic', type: 'armor', equipmentStats: { defense: 20, maxHpBonus: 40, attackSpeed: 12, thorns: 10 } },
  { lootId: 'berserkers_vest', name: 'Berserker\'s Vest', icon: '🎽', description: 'Ragged armor of the fearless - boosts offensive power while exposing vulnerabilities', rarity: 'epic', type: 'armor', equipmentStats: { damageBonus: 4, critChance: 15 } },
  { lootId: 'titans_armor', name: 'Titan\'s Armor', icon: '🛡️', description: 'Armor of the ancient giants - thrives on adversity', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 28, maxHpBonus: 70, defensiveLifesteal: 5 } },
  { lootId: 'abyssal_plate', name: 'Abyssal Plate', icon: '🛡️', description: 'Forged in the deepest trenches - converts pain to power', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 26, maxHpBonus: 65, attackSpeed: -5, defensiveLifesteal: 4 } },
  { lootId: 'dragonlord_armor', name: 'Dragonlord Armor', icon: '🛡️', description: 'Ultimate volcanic protection - molten scales sear attackers', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 28, maxHpBonus: 70, critChance: 5, thorns: 18 } },
  { lootId: 'dreadlord_plate', name: 'Dreadlord Plate', icon: '🛡️', description: 'Eternal undead protection - feeds on suffering and curses attackers', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 28, maxHpBonus: 70, damageBonus: 5, defensiveLifesteal: 5, thorns: 18 } },
  { lootId: 'sacred_guardian_armor', name: 'Sacred Guardian Armor', icon: '🛡️', description: 'Divine protection with regenerative power (+12% heal, 5% defensive lifesteal)', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 26, maxHpBonus: 65, healBonus: 12, defensiveLifesteal: 5 } },
  // NEW: Archetype-specific legendary armor
  { lootId: 'shadowdancer_silk', name: 'Shadowdancer Silk', icon: '🥷', description: 'Ethereal armor worn by legendary assassins - offers no protection, only deadliness', rarity: 'legendary', type: 'armor', equipmentStats: { critChance: 28 } },
  { lootId: 'fortress_plate', name: 'Fortress Plate', icon: '🛡️', description: 'Living citadel - impenetrable defense that slows monsters and reflects attacks', rarity: 'legendary', type: 'armor', equipmentStats: { defense: 30, maxHpBonus: 75, attackSpeed: 20, thorns: 20, defensiveLifesteal: 4 } },
  { lootId: 'warlords_regalia', name: 'Warlord\'s Regalia', icon: '👑', description: 'Armor of legendary commanders - balanced offense and defense for versatile warriors', rarity: 'legendary', type: 'armor', equipmentStats: { damageBonus: 5, defense: 22, maxHpBonus: 60, attackSpeed: 12 } },
];

const CRAFT_ONLY_CONSUMABLES: LootItem[] = [
  { lootId: 'concentrated_elixir', name: 'Concentrated Elixir', icon: '⚗️', description: 'Restores 75 HP', rarity: 'rare', type: 'consumable', cooldown: 12, healing: 75 },
  { lootId: 'transmutation_potion', name: 'Transmutation Potion', icon: '🧪', description: 'Restores 50 HP + grants 30s damage buff', rarity: 'epic', type: 'consumable', cooldown: 15, healing: 50 },
  { lootId: 'phoenix_tear', name: 'Phoenix Tear', icon: '💧', description: 'Fully restores HP', rarity: 'legendary', type: 'consumable', cooldown: 25, healing: 999 },
];

const CRAFT_ONLY_ARTIFACTS: LootItem[] = [
  { lootId: 'master_craftsman_ring', name: 'Master Craftsman\'s Ring', icon: '💍', description: 'Enhances all combat abilities', rarity: 'rare', type: 'artifact', equipmentStats: { damageBonus: 3, critChance: 8, attackSpeed: 8 } },
  { lootId: 'arcane_amplifier', name: 'Arcane Amplifier', icon: '🔮', description: 'Boosts magical power', rarity: 'epic', type: 'artifact', equipmentStats: { damageBonus: 5, critChance: 15, maxHpBonus: 40 } },
  // NEW: Archetype-specific epic artifacts
  { lootId: 'assassins_mark', name: 'Assassin\'s Mark', icon: '💀', description: 'Cursed relic that grants deadly precision at the cost of all protection', rarity: 'epic', type: 'artifact', equipmentStats: { critChance: 20 } },
  { lootId: 'executioners_eye', name: 'Executioner\'s Eye', icon: '👁️', description: 'See enemy weaknesses with perfect clarity - pure offense, no protection', rarity: 'epic', type: 'artifact', equipmentStats: { damageBonus: 5, critChance: 15 } },
  { lootId: 'guardians_talisman', name: 'Guardian\'s Talisman', icon: '🛡️', description: 'Sacred relic of protectors - grants endurance and resilience, but no offensive power', rarity: 'epic', type: 'artifact', equipmentStats: { defense: 15, maxHpBonus: 50, attackSpeed: 10 } },
  { lootId: 'ironheart_stone', name: 'Ironheart Stone', icon: '💎', description: 'Grants the endurance of stone and the strength to endure any assault', rarity: 'epic', type: 'artifact', equipmentStats: { defense: 12, maxHpBonus: 45, attackSpeed: 12, defensiveLifesteal: 2 } },
  { lootId: 'adventurers_compass', name: 'Adventurer\'s Compass', icon: '🧭', description: 'Guides the way to fortune and survival - balanced power for versatile builds', rarity: 'epic', type: 'artifact', equipmentStats: { damageBonus: 3, critChance: 8, maxHpBonus: 20, coinBonus: 25 } },
  { lootId: 'infinity_amulet', name: 'Infinity Amulet', icon: '🔱', description: 'Contains limitless power - balanced might', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 8, critChance: 16, maxHpBonus: 60, coinBonus: 100 } },
  { lootId: 'maelstrom_pendant', name: 'Maelstrom Pendant', icon: '🌊', description: 'Harnesses the fury of the ocean - swift and deadly', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 7, critChance: 14, attackSpeed: 15, coinBonus: 80 } },
  { lootId: 'volcanic_heart', name: 'Volcanic Heart', icon: '🔥', description: 'Pulses with molten power - raw offensive force', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 8, critChance: 16, maxHpBonus: 60, coinBonus: 70 } },
  { lootId: 'crown_of_eternity', name: 'Crown of Eternity', icon: '👑', description: 'Rules over life and death - enduring power', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 6, critChance: 18, maxHpBonus: 70, coinBonus: 120 } },
  // NEW: Archetype-specific legendary artifacts
  { lootId: 'heart_of_reaper', name: 'Heart of the Reaper', icon: '💀', description: 'Ultimate offensive artifact - Death incarnate, offering no mercy or protection', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 8, critChance: 20 } },
  { lootId: 'perfect_prism', name: 'Perfect Prism', icon: '🔷', description: 'Focuses all power into critical strikes - fragile but devastating', rarity: 'legendary', type: 'artifact', equipmentStats: { critChance: 25 } },
  { lootId: 'aegis_of_titans', name: 'Aegis of Titans', icon: '🛡️', description: 'Legendary shield of the ancient giants - unbreakable defense with no offensive power', rarity: 'legendary', type: 'artifact', equipmentStats: { defense: 25, maxHpBonus: 100, attackSpeed: 20, defensiveLifesteal: 3 } },
  { lootId: 'bastion_core', name: 'Bastion Core', icon: '⚙️', description: 'Mechanical heart of an ancient guardian - reflects damage while enduring endless assault', rarity: 'legendary', type: 'artifact', equipmentStats: { defense: 20, maxHpBonus: 70, attackSpeed: 18, thorns: 20 } },
  { lootId: 'equilibrium_orb', name: 'Equilibrium Orb', icon: '☯️', description: 'Perfect balance of offense and defense - the way of the warrior sage', rarity: 'legendary', type: 'artifact', equipmentStats: { damageBonus: 6, critChance: 15, defense: 12, maxHpBonus: 60, attackSpeed: 10 } },
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

// ========== INSCRIPTION SCROLLS (Equipment Customization Phase 1) ==========
// 56 total scrolls: 7 inscription types × 4 rarities × 2 slots (prefix/suffix)

// Damage Inscription Scrolls (+damageBonus)
const INSCRIPTION_DAMAGE: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_damage_common', name: 'Savage Prefix Scroll', icon: '📜', description: 'Adds "Savage" prefix: +3 damage', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 3, slot: 'prefix', name: 'Savage', description: 'Adds +3 damage to equipment' } },
  { lootId: 'prefix_damage_rare', name: 'Brutal Prefix Scroll', icon: '📜', description: 'Adds "Brutal" prefix: +5 damage', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 5, slot: 'prefix', name: 'Brutal', description: 'Adds +5 damage to equipment' } },
  { lootId: 'prefix_damage_epic', name: 'Rending Prefix Scroll', icon: '📜', description: 'Adds "Rending" prefix: +8 damage', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 8, slot: 'prefix', name: 'Rending', description: 'Adds +8 damage to equipment' } },
  { lootId: 'prefix_damage_legendary', name: 'Fierce Prefix Scroll', icon: '📜', description: 'Adds "Fierce" prefix: +12 damage', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 12, slot: 'prefix', name: 'Fierce', description: 'Adds +12 damage to equipment' } },
  // Suffixes
  { lootId: 'suffix_damage_common', name: 'Suffix of Fury Scroll', icon: '📜', description: 'Adds "of Fury" suffix: +3 damage', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 3, slot: 'suffix', name: 'of Fury', description: 'Adds +3 damage to equipment' } },
  { lootId: 'suffix_damage_rare', name: 'Suffix of Violence Scroll', icon: '📜', description: 'Adds "of Violence" suffix: +5 damage', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 5, slot: 'suffix', name: 'of Violence', description: 'Adds +5 damage to equipment' } },
  { lootId: 'suffix_damage_epic', name: 'Suffix of Power Scroll', icon: '📜', description: 'Adds "of Power" suffix: +8 damage', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 8, slot: 'suffix', name: 'of Power', description: 'Adds +8 damage to equipment' } },
  { lootId: 'suffix_damage_legendary', name: 'Suffix of Ruin Scroll', icon: '📜', description: 'Adds "of Ruin" suffix: +12 damage', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'damage', statValue: 12, slot: 'suffix', name: 'of Ruin', description: 'Adds +12 damage to equipment' } },
];

// Critical Inscription Scrolls (+critChance)
const INSCRIPTION_CRITICAL: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_critical_common', name: 'Keen Prefix Scroll', icon: '📜', description: 'Adds "Keen" prefix: +3% crit', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 3, slot: 'prefix', name: 'Keen', description: 'Adds +3% critical chance to equipment' } },
  { lootId: 'prefix_critical_rare', name: 'Deadly Prefix Scroll', icon: '📜', description: 'Adds "Deadly" prefix: +5% crit', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 5, slot: 'prefix', name: 'Deadly', description: 'Adds +5% critical chance to equipment' } },
  { lootId: 'prefix_critical_epic', name: 'Piercing Prefix Scroll', icon: '📜', description: 'Adds "Piercing" prefix: +8% crit', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 8, slot: 'prefix', name: 'Piercing', description: 'Adds +8% critical chance to equipment' } },
  { lootId: 'prefix_critical_legendary', name: 'Sharpened Prefix Scroll', icon: '📜', description: 'Adds "Sharpened" prefix: +12% crit', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 12, slot: 'prefix', name: 'Sharpened', description: 'Adds +12% critical chance to equipment' } },
  // Suffixes
  { lootId: 'suffix_critical_common', name: 'Suffix of Precision Scroll', icon: '📜', description: 'Adds "of Precision" suffix: +3% crit', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 3, slot: 'suffix', name: 'of Precision', description: 'Adds +3% critical chance to equipment' } },
  { lootId: 'suffix_critical_rare', name: 'Suffix of Striking Scroll', icon: '📜', description: 'Adds "of Striking" suffix: +5% crit', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 5, slot: 'suffix', name: 'of Striking', description: 'Adds +5% critical chance to equipment' } },
  { lootId: 'suffix_critical_epic', name: 'Suffix of Execution Scroll', icon: '📜', description: 'Adds "of Execution" suffix: +8% crit', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 8, slot: 'suffix', name: 'of Execution', description: 'Adds +8% critical chance to equipment' } },
  { lootId: 'suffix_critical_legendary', name: 'Suffix of Piercing Scroll', icon: '📜', description: 'Adds "of Piercing" suffix: +12% crit', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'critical', statValue: 12, slot: 'suffix', name: 'of Piercing', description: 'Adds +12% critical chance to equipment' } },
];

// Protection Inscription Scrolls (+hpReduction/defense)
const INSCRIPTION_PROTECTION: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_protection_common', name: 'Guarded Prefix Scroll', icon: '📜', description: 'Adds "Guarded" prefix: +10 defense', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'protection', statValue: 10, slot: 'prefix', name: 'Guarded', description: 'Adds +10 defense to equipment' } },
  { lootId: 'prefix_protection_rare', name: 'Steadfast Prefix Scroll', icon: '📜', description: 'Adds "Steadfast" prefix: +15 defense', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'protection', statValue: 15, slot: 'prefix', name: 'Steadfast', description: 'Adds +15 defense to equipment' } },
  { lootId: 'prefix_protection_epic', name: 'Bulwark Prefix Scroll', icon: '📜', description: 'Adds "Bulwark" prefix: +25 defense', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'protection', statValue: 25, slot: 'prefix', name: 'Bulwark', description: 'Adds +25 defense to equipment' } },
  { lootId: 'prefix_protection_legendary', name: 'Fortified Prefix Scroll', icon: '📜', description: 'Adds "Fortified" prefix: +35 defense', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'protection', statValue: 35, slot: 'prefix', name: 'Fortified', description: 'Adds +35 defense to equipment' } },
  // Suffixes
  { lootId: 'suffix_protection_common', name: 'Suffix of Protection Scroll', icon: '📜', description: 'Adds "of Protection" suffix: +10 defense', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'protection', statValue: 10, slot: 'suffix', name: 'of Protection', description: 'Adds +10 defense to equipment' } },
  { lootId: 'suffix_protection_rare', name: 'Suffix of Resilience Scroll', icon: '📜', description: 'Adds "of Resilience" suffix: +15 defense', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'protection', statValue: 15, slot: 'suffix', name: 'of Resilience', description: 'Adds +15 defense to equipment' } },
  { lootId: 'suffix_protection_epic', name: 'Suffix of Warding Scroll', icon: '📜', description: 'Adds "of Warding" suffix: +25 defense', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'protection', statValue: 25, slot: 'suffix', name: 'of Warding', description: 'Adds +25 defense to equipment' } },
  { lootId: 'suffix_protection_legendary', name: 'Suffix of Safeguarding Scroll', icon: '📜', description: 'Adds "of Safeguarding" suffix: +35 defense', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'protection', statValue: 35, slot: 'suffix', name: 'of Safeguarding', description: 'Adds +35 defense to equipment' } },
];

// Vitality Inscription Scrolls (+maxHpBonus)
const INSCRIPTION_VITALITY: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_vitality_common', name: 'Vigorous Prefix Scroll', icon: '📜', description: 'Adds "Vigorous" prefix: +12 max HP', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 12, slot: 'prefix', name: 'Vigorous', description: 'Adds +12 maximum HP to equipment' } },
  { lootId: 'prefix_vitality_rare', name: 'Stout Prefix Scroll', icon: '📜', description: 'Adds "Stout" prefix: +20 max HP', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 20, slot: 'prefix', name: 'Stout', description: 'Adds +20 maximum HP to equipment' } },
  { lootId: 'prefix_vitality_epic', name: 'Robust Prefix Scroll', icon: '📜', description: 'Adds "Robust" prefix: +32 max HP', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 32, slot: 'prefix', name: 'Robust', description: 'Adds +32 maximum HP to equipment' } },
  { lootId: 'prefix_vitality_legendary', name: 'Hardy Prefix Scroll', icon: '📜', description: 'Adds "Hardy" prefix: +50 max HP', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 50, slot: 'prefix', name: 'Hardy', description: 'Adds +50 maximum HP to equipment' } },
  // Suffixes
  { lootId: 'suffix_vitality_common', name: 'Suffix of Vitality Scroll', icon: '📜', description: 'Adds "of Vitality" suffix: +12 max HP', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 12, slot: 'suffix', name: 'of Vitality', description: 'Adds +12 maximum HP to equipment' } },
  { lootId: 'suffix_vitality_rare', name: 'Suffix of Life Scroll', icon: '📜', description: 'Adds "of Life" suffix: +20 max HP', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 20, slot: 'suffix', name: 'of Life', description: 'Adds +20 maximum HP to equipment' } },
  { lootId: 'suffix_vitality_epic', name: 'Suffix of Endurance Scroll', icon: '📜', description: 'Adds "of Endurance" suffix: +32 max HP', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 32, slot: 'suffix', name: 'of Endurance', description: 'Adds +32 maximum HP to equipment' } },
  { lootId: 'suffix_vitality_legendary', name: 'Suffix of the Titan Scroll', icon: '📜', description: 'Adds "of the Titan" suffix: +50 max HP', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'vitality', statValue: 50, slot: 'suffix', name: 'of the Titan', description: 'Adds +50 maximum HP to equipment' } },
];

// Haste Inscription Scrolls (+attackSpeed)
const INSCRIPTION_HASTE: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_haste_common', name: 'Swift Prefix Scroll', icon: '📜', description: 'Adds "Swift" prefix: +3 attack speed', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'haste', statValue: 3, slot: 'prefix', name: 'Swift', description: 'Adds +3 attack speed to equipment' } },
  { lootId: 'prefix_haste_rare', name: 'Rapid Prefix Scroll', icon: '📜', description: 'Adds "Rapid" prefix: +5 attack speed', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'haste', statValue: 5, slot: 'prefix', name: 'Rapid', description: 'Adds +5 attack speed to equipment' } },
  { lootId: 'prefix_haste_epic', name: 'Nimble Prefix Scroll', icon: '📜', description: 'Adds "Nimble" prefix: +8 attack speed', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'haste', statValue: 8, slot: 'prefix', name: 'Nimble', description: 'Adds +8 attack speed to equipment' } },
  { lootId: 'prefix_haste_legendary', name: 'Lightning Prefix Scroll', icon: '📜', description: 'Adds "Lightning" prefix: +12 attack speed', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'haste', statValue: 12, slot: 'prefix', name: 'Lightning', description: 'Adds +12 attack speed to equipment' } },
  // Suffixes
  { lootId: 'suffix_haste_common', name: 'Suffix of Haste Scroll', icon: '📜', description: 'Adds "of Haste" suffix: +3 attack speed', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'haste', statValue: 3, slot: 'suffix', name: 'of Haste', description: 'Adds +3 attack speed to equipment' } },
  { lootId: 'suffix_haste_rare', name: 'Suffix of Quickness Scroll', icon: '📜', description: 'Adds "of Quickness" suffix: +5 attack speed', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'haste', statValue: 5, slot: 'suffix', name: 'of Quickness', description: 'Adds +5 attack speed to equipment' } },
  { lootId: 'suffix_haste_epic', name: 'Suffix of Agility Scroll', icon: '📜', description: 'Adds "of Agility" suffix: +8 attack speed', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'haste', statValue: 8, slot: 'suffix', name: 'of Agility', description: 'Adds +8 attack speed to equipment' } },
  { lootId: 'suffix_haste_legendary', name: 'Suffix of the Zephyr Scroll', icon: '📜', description: 'Adds "of the Zephyr" suffix: +12 attack speed', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'haste', statValue: 12, slot: 'suffix', name: 'of the Zephyr', description: 'Adds +12 attack speed to equipment' } },
];

// Fortune Inscription Scrolls (+coinBonus)
const INSCRIPTION_FORTUNE: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_fortune_common', name: 'Prosperous Prefix Scroll', icon: '📜', description: 'Adds "Prosperous" prefix: +3% coin bonus', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'fortune', statValue: 3, slot: 'prefix', name: 'Prosperous', description: 'Adds +3% coin bonus to equipment' } },
  { lootId: 'prefix_fortune_rare', name: 'Lucky Prefix Scroll', icon: '📜', description: 'Adds "Lucky" prefix: +5% coin bonus', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'fortune', statValue: 5, slot: 'prefix', name: 'Lucky', description: 'Adds +5% coin bonus to equipment' } },
  { lootId: 'prefix_fortune_epic', name: 'Golden Prefix Scroll', icon: '📜', description: 'Adds "Golden" prefix: +8% coin bonus', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'fortune', statValue: 8, slot: 'prefix', name: 'Golden', description: 'Adds +8% coin bonus to equipment' } },
  { lootId: 'prefix_fortune_legendary', name: "Opportunist's Prefix Scroll", icon: '📜', description: 'Adds "Opportunist\'s" prefix: +12% coin bonus', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'fortune', statValue: 12, slot: 'prefix', name: "Opportunist's", description: 'Adds +12% coin bonus to equipment' } },
  // Suffixes
  { lootId: 'suffix_fortune_common', name: 'Suffix of Fortune Scroll', icon: '📜', description: 'Adds "of Fortune" suffix: +3% coin bonus', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'fortune', statValue: 3, slot: 'suffix', name: 'of Fortune', description: 'Adds +3% coin bonus to equipment' } },
  { lootId: 'suffix_fortune_rare', name: 'Suffix of Wealth Scroll', icon: '📜', description: 'Adds "of Wealth" suffix: +5% coin bonus', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'fortune', statValue: 5, slot: 'suffix', name: 'of Wealth', description: 'Adds +5% coin bonus to equipment' } },
  { lootId: 'suffix_fortune_epic', name: 'Suffix of Greed Scroll', icon: '📜', description: 'Adds "of Greed" suffix: +8% coin bonus', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'fortune', statValue: 8, slot: 'suffix', name: 'of Greed', description: 'Adds +8% coin bonus to equipment' } },
  { lootId: 'suffix_fortune_legendary', name: 'Suffix of Prosperity Scroll', icon: '📜', description: 'Adds "of Prosperity" suffix: +12% coin bonus', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'fortune', statValue: 12, slot: 'suffix', name: 'of Prosperity', description: 'Adds +12% coin bonus to equipment' } },
];

// Healing Inscription Scrolls (+healBonus)
const INSCRIPTION_HEALING: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_healing_common', name: 'Sacred Prefix Scroll', icon: '📜', description: 'Adds "Sacred" prefix: +3% heal bonus', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'healing', statValue: 3, slot: 'prefix', name: 'Sacred', description: 'Adds +3% heal bonus to equipment' } },
  { lootId: 'prefix_healing_rare', name: 'Blessed Prefix Scroll', icon: '📜', description: 'Adds "Blessed" prefix: +5% heal bonus', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'healing', statValue: 5, slot: 'prefix', name: 'Blessed', description: 'Adds +5% heal bonus to equipment' } },
  { lootId: 'prefix_healing_epic', name: 'Renewing Prefix Scroll', icon: '📜', description: 'Adds "Renewing" prefix: +8% heal bonus', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'healing', statValue: 8, slot: 'prefix', name: 'Renewing', description: 'Adds +8% heal bonus to equipment' } },
  { lootId: 'prefix_healing_legendary', name: 'Mending Prefix Scroll', icon: '📜', description: 'Adds "Mending" prefix: +12% heal bonus', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'healing', statValue: 12, slot: 'prefix', name: 'Mending', description: 'Adds +12% heal bonus to equipment' } },
  // Suffixes
  { lootId: 'suffix_healing_common', name: 'Suffix of Healing Scroll', icon: '📜', description: 'Adds "of Healing" suffix: +3% heal bonus', rarity: 'common', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'healing', statValue: 3, slot: 'suffix', name: 'of Healing', description: 'Adds +3% heal bonus to equipment' } },
  { lootId: 'suffix_healing_rare', name: 'Suffix of Restoration Scroll', icon: '📜', description: 'Adds "of Restoration" suffix: +5% heal bonus', rarity: 'rare', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'healing', statValue: 5, slot: 'suffix', name: 'of Restoration', description: 'Adds +5% heal bonus to equipment' } },
  { lootId: 'suffix_healing_epic', name: 'Suffix of Renewal Scroll', icon: '📜', description: 'Adds "of Renewal" suffix: +8% heal bonus', rarity: 'epic', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'healing', statValue: 8, slot: 'suffix', name: 'of Renewal', description: 'Adds +8% heal bonus to equipment' } },
  { lootId: 'suffix_healing_legendary', name: 'Suffix of Grace Scroll', icon: '📜', description: 'Adds "of Grace" suffix: +12% heal bonus', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'healing', statValue: 12, slot: 'suffix', name: 'of Grace', description: 'Adds +12% heal bonus to equipment' } },
];

// Lifesteal Inscription Scrolls (+lifesteal) - LEGENDARY ONLY (Boss drops)
// IMPORTANT: Cannot have both prefix AND suffix lifesteal on same item (exclusive)
const INSCRIPTION_LIFESTEAL: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_lifesteal_legendary', name: 'Vampiric Prefix Scroll', icon: '📜', description: 'Adds "Vampiric" prefix: +2% lifesteal (cannot stack with lifesteal suffix)', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'lifesteal', statValue: 2, slot: 'prefix', name: 'Vampiric', description: 'Adds +2% lifesteal to equipment - heals for 2% of damage dealt (exclusive with lifesteal suffix)' } },
  { lootId: 'prefix_lifesteal_legendary_2', name: 'Bloodthirsty Prefix Scroll', icon: '📜', description: 'Adds "Bloodthirsty" prefix: +3% lifesteal (cannot stack with lifesteal suffix)', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'lifesteal', statValue: 3, slot: 'prefix', name: 'Bloodthirsty', description: 'Adds +3% lifesteal to equipment - heals for 3% of damage dealt (exclusive with lifesteal suffix)' } },
  // Suffixes
  { lootId: 'suffix_lifesteal_legendary', name: 'Suffix of the Vampire Scroll', icon: '📜', description: 'Adds "of the Vampire" suffix: +2% lifesteal (cannot stack with lifesteal prefix)', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'lifesteal', statValue: 2, slot: 'suffix', name: 'of the Vampire', description: 'Adds +2% lifesteal to equipment - heals for 2% of damage dealt (exclusive with lifesteal prefix)' } },
  { lootId: 'suffix_lifesteal_legendary_2', name: 'Suffix of Sanguine Scroll', icon: '📜', description: 'Adds "of Sanguine" suffix: +3% lifesteal (cannot stack with lifesteal prefix)', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'lifesteal', statValue: 3, slot: 'suffix', name: 'of Sanguine', description: 'Adds +3% lifesteal to equipment - heals for 3% of damage dealt (exclusive with lifesteal prefix)' } },
];

// Autoclick Inscription Scrolls (+autoClickRate) - LEGENDARY ONLY (Boss drops)
// IMPORTANT: Cannot have both prefix AND suffix autoclick on same item (exclusive)
const INSCRIPTION_AUTOCLICK: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_autoclick_legendary', name: 'Automated Prefix Scroll', icon: '📜', description: 'Adds "Automated" prefix: +0.5 auto-hits/sec (cannot stack with autoclick suffix)', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'autoclick', statValue: 0.5, slot: 'prefix', name: 'Automated', description: 'Adds +0.5 auto-hits per second to equipment (exclusive with autoclick suffix)' } },
  { lootId: 'prefix_autoclick_legendary_2', name: 'Relentless Prefix Scroll', icon: '📜', description: 'Adds "Relentless" prefix: +1 auto-hit/sec (cannot stack with autoclick suffix)', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'autoclick', statValue: 1, slot: 'prefix', name: 'Relentless', description: 'Adds +1 auto-hit per second to equipment (exclusive with autoclick suffix)' } },
  // Suffixes
  { lootId: 'suffix_autoclick_legendary', name: 'Suffix of Perpetuity Scroll', icon: '📜', description: 'Adds "of Perpetuity" suffix: +0.5 auto-hits/sec (cannot stack with autoclick prefix)', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'autoclick', statValue: 0.5, slot: 'suffix', name: 'of Perpetuity', description: 'Adds +0.5 auto-hits per second to equipment (exclusive with autoclick prefix)' } },
  { lootId: 'suffix_autoclick_legendary_2', name: 'Suffix of Eternity Scroll', icon: '📜', description: 'Adds "of Eternity" suffix: +1 auto-hit/sec (cannot stack with autoclick prefix)', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'autoclick', statValue: 1, slot: 'suffix', name: 'of Eternity', description: 'Adds +1 auto-hit per second to equipment (exclusive with autoclick prefix)' } },
];

// Defensive Lifesteal Inscription Scrolls (+defensiveLifesteal) - LEGENDARY ONLY (Boss drops)
// Heals for % of damage taken (works on all damage sources)
const INSCRIPTION_DEFENSIVE_LIFESTEAL: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_defensive_lifesteal_legendary', name: 'Guardian Prefix Scroll', icon: '📜', description: 'Adds "Guardian" prefix: +12% defensive lifesteal', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'defensiveLifesteal', statValue: 12, slot: 'prefix', name: 'Guardian', description: 'Adds +12% defensive lifesteal to equipment - heals for 12% of damage taken from all sources' } },
  { lootId: 'prefix_defensive_lifesteal_legendary_2', name: 'Resilient Prefix Scroll', icon: '📜', description: 'Adds "Resilient" prefix: +18% defensive lifesteal', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'defensiveLifesteal', statValue: 18, slot: 'prefix', name: 'Resilient', description: 'Adds +18% defensive lifesteal to equipment - heals for 18% of damage taken from all sources' } },
  // Suffixes
  { lootId: 'suffix_defensive_lifesteal_legendary', name: 'Suffix of the Juggernaut Scroll', icon: '📜', description: 'Adds "of the Juggernaut" suffix: +12% defensive lifesteal', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'defensiveLifesteal', statValue: 12, slot: 'suffix', name: 'of the Juggernaut', description: 'Adds +12% defensive lifesteal to equipment - heals for 12% of damage taken from all sources' } },
  { lootId: 'suffix_defensive_lifesteal_legendary_2', name: 'Suffix of the Fortress Scroll', icon: '📜', description: 'Adds "of the Fortress" suffix: +18% defensive lifesteal', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'defensiveLifesteal', statValue: 18, slot: 'suffix', name: 'of the Fortress', description: 'Adds +18% defensive lifesteal to equipment - heals for 18% of damage taken from all sources' } },
];

// Thorns Inscription Scrolls (+thorns) - LEGENDARY ONLY (Boss drops)
// Reflects % of damage taken back to monster (uses pre-mitigation damage)
const INSCRIPTION_THORNS: LootItem[] = [
  // Prefixes
  { lootId: 'prefix_thorns_legendary', name: 'Spiked Prefix Scroll', icon: '📜', description: 'Adds "Spiked" prefix: +8% thorns damage', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'thorns', statValue: 8, slot: 'prefix', name: 'Spiked', description: 'Adds +8% thorns damage to equipment - reflects 8% of damage taken back to attacker' } },
  { lootId: 'prefix_thorns_legendary_2', name: 'Retaliating Prefix Scroll', icon: '📜', description: 'Adds "Retaliating" prefix: +12% thorns damage', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'thorns', statValue: 12, slot: 'prefix', name: 'Retaliating', description: 'Adds +12% thorns damage to equipment - reflects 12% of damage taken back to attacker' } },
  // Suffixes
  { lootId: 'suffix_thorns_legendary', name: 'Suffix of Vengeance Scroll', icon: '📜', description: 'Adds "of Vengeance" suffix: +8% thorns damage', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'thorns', statValue: 8, slot: 'suffix', name: 'of Vengeance', description: 'Adds +8% thorns damage to equipment - reflects 8% of damage taken back to attacker' } },
  { lootId: 'suffix_thorns_legendary_2', name: 'Suffix of Retaliation Scroll', icon: '📜', description: 'Adds "of Retaliation" suffix: +12% thorns damage', rarity: 'legendary', type: 'inscription_scroll', inscriptionData: { inscriptionType: 'thorns', statValue: 12, slot: 'suffix', name: 'of Retaliation', description: 'Adds +12% thorns damage to equipment - reflects 12% of damage taken back to attacker' } },
];

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
  // Phase 3.4: Inscription scrolls (all scrolls)
  ...INSCRIPTION_DAMAGE,
  ...INSCRIPTION_CRITICAL,
  ...INSCRIPTION_PROTECTION,
  ...INSCRIPTION_VITALITY,
  ...INSCRIPTION_HASTE,
  ...INSCRIPTION_FORTUNE,
  ...INSCRIPTION_HEALING,
  ...INSCRIPTION_LIFESTEAL,  // Special legendary (boss drops)
  ...INSCRIPTION_AUTOCLICK,  // Special legendary (boss drops)
  ...INSCRIPTION_DEFENSIVE_LIFESTEAL,  // Special legendary (boss drops)
  ...INSCRIPTION_THORNS,  // Special legendary (boss drops)
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
 * Get monster-specific drops for a given monster name
 */
export function getMonsterSpecificDrops(monsterName: string): LootItem[] {
  return MONSTER_SPECIFIC_LOOT[monsterName] || [];
}

/**
 * Randomly select N items from various loot pools
 * Guarantees at least 1 monster-specific item (can be more if lucky)
 * Fills remaining slots with COMMON_LOOT or RARE_LOOT
 * @param monsterName - The name of the monster that dropped the loot
 * @param count - Number of items to generate
 * @param winStreak - Current win streak (increases rare drop chance)
 */
/**
 * Weighted random selection from loot pool
 * Spell scrolls have 50% weight compared to other items (makes them 2x rarer)
 * @param pool - Available items to select from
 * @param count - Number of items to select
 * @param excludeLootIds - LootIds to exclude from selection (prevents duplicates)
 */
function selectWeightedLoot(pool: LootItem[], count: number, excludeLootIds: Set<string> = new Set()): LootItem[] {
  const results: LootItem[] = [];
  // Filter out already-selected items
  const poolCopy = pool.filter(item => !excludeLootIds.has(item.lootId));

  for (let i = 0; i < count && poolCopy.length > 0; i++) {
    // Calculate weights: spell scrolls get 0.5x weight, everything else gets 1.0x weight
    const weights = poolCopy.map(item => item.type === 'spell_scroll' ? 0.5 : 1.0);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Weighted random selection
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let j = 0; j < weights.length; j++) {
      random -= weights[j];
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }

    results.push(poolCopy[selectedIndex]);
    excludeLootIds.add(poolCopy[selectedIndex].lootId); // Track selected item
    poolCopy.splice(selectedIndex, 1); // Remove selected item to avoid duplicates
  }

  return results;
}

export function getRandomLoot(monsterName: string, count: number = 3, winStreak: number = 0): LootItem[] {
  const monsterLoot = MONSTER_SPECIFIC_LOOT[monsterName] || [];
  const results: LootItem[] = [];
  const selectedLootIds = new Set<string>(); // Track selected items to prevent duplicates

  if (monsterLoot.length === 0) {
    // Fallback: if no monster-specific loot, use weighted selection from common/rare loot
    const fallbackPool = [...COMMON_LOOT, ...RARE_LOOT];
    return selectWeightedLoot(fallbackPool, count, selectedLootIds);
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

  // Step 2: Pick random monster-specific items using weighted selection
  const selectedMonsterLoot = selectWeightedLoot(monsterLoot, Math.min(monsterItemCount, monsterLoot.length), selectedLootIds);
  results.push(...selectedMonsterLoot);

  // Step 3: Fill remaining slots with common or rare loot using weighted selection
  const remainingSlots = count - results.length;
  if (remainingSlots > 0) {
    // Calculate drop chance multiplier based on win streak
    // Multiplicative bonus: +3% per win streak (max +30% at 10 streak)
    // Example: 30% base rare → 39% at 10 streak (1.3x multiplier)
    const streakMultiplier = 1.0 + Math.min(winStreak * 0.03, 0.30); // 1.0x to 1.3x
    const rareChance = Math.min(0.30 * streakMultiplier, 0.95); // 30% base, capped at 95%
    const commonChance = 1 - rareChance;

    // For each remaining slot, decide if it's common or rare based on streak
    for (let i = 0; i < remainingSlots; i++) {
      const isCommon = Math.random() < commonChance;

      if (isCommon && COMMON_LOOT.length > 0) {
        // Use weighted selection for common loot (spell scrolls are rarer)
        const selected = selectWeightedLoot(COMMON_LOOT, 1, selectedLootIds);
        if (selected.length > 0) {
          results.push(selected[0]);
        }
      } else if (!isCommon && RARE_LOOT.length > 0) {
        // Use weighted selection for rare loot (spell scrolls are rarer)
        const selected = selectWeightedLoot(RARE_LOOT, 1, selectedLootIds);
        if (selected.length > 0) {
          results.push(selected[0]);
        }
      } else if (COMMON_LOOT.length > 0) {
        // Fallback to common if rare pool was chosen but empty
        const selected = selectWeightedLoot(COMMON_LOOT, 1, selectedLootIds);
        if (selected.length > 0) {
          results.push(selected[0]);
        }
      }
    }
  }

  return results;
}
