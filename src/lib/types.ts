import { ObjectId } from 'mongodb';

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
  clicksRequired: number; // Number of clicks needed to defeat
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  createdAt: Date;
}

// NFT Loot document
export interface NFTLoot {
  _id?: ObjectId;
  name: string;
  description: string;
  imageUrl: string; // URL or path to NFT image
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  attributes?: Record<string, string | number>; // Custom NFT attributes
  mintTransactionId?: string; // BSV transaction ID when minted
  createdAt: Date;
}

// User Inventory document
export interface UserInventory {
  _id?: ObjectId;
  userId: string; // Reference to User.userId
  lootId: ObjectId; // Reference to NFTLoot._id
  acquiredAt: Date;
  fromMonsterId: ObjectId; // Reference to Monster._id
  transactionId?: string; // BSV transaction ID
}

// Battle Session document
export interface BattleSession {
  _id?: ObjectId;
  userId: string; // Reference to User.userId
  monsterId: ObjectId; // Reference to Monster._id
  clickCount: number;
  isDefeated: boolean;
  lootOptions?: string[]; // Array of lootIds from loot-table (the 5 options shown)
  selectedLootId?: string; // The lootId the user chose
  startedAt: Date;
  completedAt?: Date;
}

// ========== Frontend Types (with string IDs) ==========

// Frontend Monster type (IDs as strings)
export interface MonsterFrontend {
  _id?: string;
  name: string;
  imageUrl: string;
  clicksRequired: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  createdAt: Date | string;
}

// Frontend Battle Session type (IDs as strings)
export interface BattleSessionFrontend {
  _id?: string;
  userId: string;
  monsterId: string;
  clickCount: number;
  isDefeated: boolean;
  lootOptions?: string[];
  selectedLootId?: string;
  startedAt: Date | string;
  completedAt?: Date | string;
}
