import { ObjectId } from 'mongodb';
import { BiomeId, Tier } from './biome-config';

// ========== MongoDB Documents (Backend) ==========

// User document
export interface User {
  _id?: ObjectId;
  userId: string; // Unique user identifier (from external auth)
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

// Monster document
export interface Monster {
  _id?: ObjectId;
  name: string;
  imageUrl: string; // URL or path to monster PNG
  clicksRequired: number; // Number of clicks needed to defeat (scaled by tier)
  attackDamage: number; // Damage per second dealt to player (scaled by tier)
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  biome: BiomeId; // Which biome this monster belongs to
  tier: Tier; // Which tier this monster instance is at
  createdAt: Date;
}

// NFT Loot document
export interface NFTLoot {
  _id?: ObjectId;
  lootTableId: string;  // Reference to loot-table.ts lootId (e.g. "dragon_scale")
  name: string;
  description: string;
  icon: string;         // Emoji icon
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact' | 'spell_scroll';
  attributes?: Record<string, any>; // Custom NFT attributes (supports nested objects like borderGradient)
  mintTransactionId?: string; // BSV transaction ID when minted to blockchain
  createdAt: Date;
}

// User Inventory document
export interface UserInventory {
  _id?: ObjectId;
  userId: string;          // Reference to User.userId
  lootTableId: string;     // Reference to loot-table.ts lootId (e.g. "dragon_scale")
  nftLootId?: ObjectId;    // Reference to NFTLoot._id (null until user mints it)
  tier: Tier;              // Which tier this item dropped from (1-5)
  borderGradient: { color1: string; color2: string }; // User-specific gradient (stored here, not in NFT until minted)
  acquiredAt: Date;
  fromMonsterId: ObjectId; // Reference to Monster._id
  fromSessionId: ObjectId; // Reference to BattleSession._id
}

// Player Stats document (RPG progression)
export interface PlayerStats {
  _id?: ObjectId;
  userId: string; // Reference to User.userId
  level: number;
  experience: number;
  coins: number;
  maxHealth: number;
  currentHealth: number;

  // Equipment slots (store inventory item IDs)
  equippedWeapon?: ObjectId;
  equippedArmor?: ObjectId;
  equippedAccessory1?: ObjectId;
  equippedAccessory2?: ObjectId;
  equippedConsumables: ObjectId[]; // Array of 5

  // Battle stats
  baseDamage: number;
  critChance: number;
  attackSpeed: number;

  // Progress tracking
  currentZone: number;
  currentTier: number;
  unlockedZones: string[]; // Array of "zone-tier" strings like "forest-1", "desert-1"

  // Statistics
  stats: {
    battlesWon: number;
    battlesWonStreak: number; // Current win streak (resets on death)
    monstersDefeated: number;
    bossesDefeated: number;
    totalDamageDealt: number;
    itemsCollected: number;
    legendariesFound: number;
  };

  createdAt: Date;
  lastBattleAt?: Date;
}

// Battle Session document
export interface BattleSession {
  _id?: ObjectId;
  userId: string; // Reference to User.userId
  monsterId: ObjectId; // Reference to Monster._id
  biome: BiomeId; // Which biome this battle is in
  tier: Tier; // Which tier this battle is at
  clickCount: number;
  isDefeated: boolean;
  lootOptions?: string[]; // Array of lootIds from loot-table (the 5 options shown)
  selectedLootId?: string; // The lootId the user chose, or 'SKIPPED' if user skipped loot selection
  usedItems: Array<{ lootTableId: string; usedAt: Date }>; // Track items used during battle (for HP verification)
  startedAt: Date; // When session was created (monster spawned)
  actualBattleStartedAt?: Date; // When user clicked "Start Battle" button (for HP verification)
  completedAt?: Date;
}

// ========== Frontend Types (with string IDs) ==========

// Frontend Monster type (IDs as strings)
export interface MonsterFrontend {
  _id?: string;
  name: string;
  imageUrl: string;
  clicksRequired: number;
  attackDamage: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  biome: BiomeId;
  tier: Tier;
  createdAt: Date | string;
}

// Frontend Battle Session type (IDs as strings)
export interface BattleSessionFrontend {
  _id?: string;
  userId: string;
  monsterId: string;
  biome: BiomeId;
  tier: Tier;
  clickCount: number;
  isDefeated: boolean;
  lootOptions?: string[];
  selectedLootId?: string;
  usedItems?: Array<{ lootTableId: string; usedAt: Date | string }>; // Track items used during battle
  startedAt: Date | string;
  actualBattleStartedAt?: Date | string; // When user clicked "Start Battle" button
  completedAt?: Date | string;
}
