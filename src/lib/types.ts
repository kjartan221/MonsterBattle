import { ObjectId } from 'mongodb';

// User document
export interface User {
  _id?: ObjectId;
  userId: string; // Unique user identifier
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

// Monster document
export interface Monster {
  _id?: ObjectId;
  monsterId: string; // Unique monster identifier
  name: string;
  imageUrl: string; // URL or path to monster PNG
  clicksRequired: number; // Number of clicks needed to defeat
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  lootTableIds: string[]; // References to possible loot drops
  createdAt: Date;
}

// NFT Loot document
export interface NFTLoot {
  _id?: ObjectId;
  lootId: string; // Unique loot identifier
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
  lootId: string; // Reference to NFTLoot.lootId
  acquiredAt: Date;
  fromMonsterId: string; // Which monster dropped this
  transactionId?: string; // BSV transaction ID
}

// Battle Session document
export interface BattleSession {
  _id?: ObjectId;
  sessionId: string; // Unique session identifier
  userId: string; // Reference to User.userId
  monsterId: string; // Reference to Monster.monsterId
  clickCount: number;
  isDefeated: boolean;
  lootDropped?: string[]; // Array of lootIds that were dropped
  startedAt: Date;
  completedAt?: Date;
}
