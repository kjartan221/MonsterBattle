import { MongoClient, ServerApiVersion, Db, Collection } from 'mongodb';
import type { User, Monster, NFTLoot, UserInventory, BattleSession, PlayerStats, MaterialToken, MarketplaceItem } from './types';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MONGODB_URI to .env file');
}

const uri = process.env.MONGODB_URI;

// Connection options with pooling configuration
const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 10, // Maximum number of connections in the pool
  minPoolSize: 2,  // Minimum number of connections to maintain
  maxIdleTimeMS: 30000, // Close connections that have been idle for 30 seconds
};

// Global cached connection (persists across serverless function invocations)
declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

// Use global caching in both development and production to prevent connection leaks
// This ensures the same connection is reused across serverless function invocations
if (!global.mongoClientPromise) {
  const client = new MongoClient(uri, options);
  global.mongoClientPromise = client.connect();
  console.log('Creating new MongoDB client connection');
}
clientPromise = global.mongoClientPromise;

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  MONSTERS: 'monsters',
  NFT_LOOT: 'nft_loot',
  USER_INVENTORY: 'user_inventory',
  BATTLE_SESSIONS: 'battle_sessions',
  PLAYER_STATS: 'player_stats',
  MATERIAL_TOKENS: 'material_tokens',
  MARKETPLACE_ITEMS: 'marketplace_items',
} as const;

// Database and collections cache
let db: Db | null = null;
let usersCollection: Collection<User> | null = null;
let monstersCollection: Collection<Monster> | null = null;
let nftLootCollection: Collection<NFTLoot> | null = null;
let userInventoryCollection: Collection<UserInventory> | null = null;
let battleSessionsCollection: Collection<BattleSession> | null = null;
let playerStatsCollection: Collection<PlayerStats> | null = null;
let materialTokensCollection: Collection<MaterialToken> | null = null;
let marketplaceItemsCollection: Collection<MarketplaceItem> | null = null;
let collectionsInitialized = false;

// Connect to MongoDB and initialize collections
async function connectToMongo() {
  if (!db) {
    try {
      // Use the cached client promise
      const client = await clientPromise;
      console.log("🔌 Initializing MongoDB database connection...");

      // Initialize database
      db = client.db();

      // Get typed collection handles
      usersCollection = db.collection<User>(COLLECTIONS.USERS);
      monstersCollection = db.collection<Monster>(COLLECTIONS.MONSTERS);
      nftLootCollection = db.collection<NFTLoot>(COLLECTIONS.NFT_LOOT);
      userInventoryCollection = db.collection<UserInventory>(COLLECTIONS.USER_INVENTORY);
      battleSessionsCollection = db.collection<BattleSession>(COLLECTIONS.BATTLE_SESSIONS);
      playerStatsCollection = db.collection<PlayerStats>(COLLECTIONS.PLAYER_STATS);
      materialTokensCollection = db.collection<MaterialToken>(COLLECTIONS.MATERIAL_TOKENS);
      marketplaceItemsCollection = db.collection<MarketplaceItem>(COLLECTIONS.MARKETPLACE_ITEMS);

      // Only create indexes once (not on every connection)
      if (!collectionsInitialized) {
        console.log("Initializing MongoDB indexes...");

        // Create indexes for better performance
        // Using Promise.all for parallel index creation
        await Promise.all([
          // Users indexes
          usersCollection.createIndex({ userId: 1 }, { unique: true }),
          usersCollection.createIndex({ username: 1 }),

          // Monsters indexes
          monstersCollection.createIndex({ rarity: 1 }),
          monstersCollection.createIndex({ createdAt: -1 }),

          // NFT Loot indexes
          nftLootCollection.createIndex({ rarity: 1 }),
          nftLootCollection.createIndex({ lootTableId: 1 }),
          nftLootCollection.createIndex({ mintOutpoint: 1 }, {
            partialFilterExpression: { mintOutpoint: { $exists: true } }
          }),

          // User Inventory indexes
          userInventoryCollection.createIndex({ userId: 1 }),
          userInventoryCollection.createIndex({ lootTableId: 1 }),
          userInventoryCollection.createIndex({ nftLootId: 1 }, {
            partialFilterExpression: { nftLootId: { $exists: true } }
          }),
          userInventoryCollection.createIndex({ userId: 1, acquiredAt: -1 }),
          userInventoryCollection.createIndex({ fromMonsterId: 1 }),

          // Battle Sessions indexes
          battleSessionsCollection.createIndex({ userId: 1, startedAt: -1 }),
          battleSessionsCollection.createIndex({ userId: 1, isDefeated: 1 }),
          battleSessionsCollection.createIndex({ monsterId: 1 }),

          // Player Stats indexes
          playerStatsCollection.createIndex({ userId: 1 }, { unique: true }),
          playerStatsCollection.createIndex({ level: 1 }),
          playerStatsCollection.createIndex({ currentZone: 1, currentTier: 1 }),

          // Material Tokens indexes
          materialTokensCollection.createIndex({ userId: 1 }),
          materialTokensCollection.createIndex({ lootTableId: 1 }),
          materialTokensCollection.createIndex({ userId: 1, lootTableId: 1 }),
          materialTokensCollection.createIndex({ tokenId: 1 }),
          materialTokensCollection.createIndex({ consumed: 1 }),

          // Marketplace Items indexes
          marketplaceItemsCollection.createIndex({ sellerId: 1 }),
          marketplaceItemsCollection.createIndex({ status: 1 }),
          marketplaceItemsCollection.createIndex({ status: 1, listedAt: -1 }), // Active listings by date
          marketplaceItemsCollection.createIndex({ itemType: 1, status: 1 }), // Filter by type
          marketplaceItemsCollection.createIndex({ rarity: 1, status: 1 }), // Filter by rarity
          marketplaceItemsCollection.createIndex({ tier: 1, status: 1 }), // Filter by tier
          marketplaceItemsCollection.createIndex({ itemName: 1 }), // Regular index for name search
        ]);

        collectionsInitialized = true;
        console.log("MongoDB indexes created successfully");
      }
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
      throw error;
    }
  }

  // Type assertion: collections will be initialized after the check above
  // Also get client for transaction support
  const client = await clientPromise;
  return {
    client,
    db: db!,
    usersCollection: usersCollection!,
    monstersCollection: monstersCollection!,
    nftLootCollection: nftLootCollection!,
    userInventoryCollection: userInventoryCollection!,
    battleSessionsCollection: battleSessionsCollection!,
    playerStatsCollection: playerStatsCollection!,
    materialTokensCollection: materialTokensCollection!,
    marketplaceItemsCollection: marketplaceItemsCollection!
  };
}

// Export connection function
export { connectToMongo };

// Helper function to get database (for backward compatibility)
export async function getDatabase(): Promise<Db> {
  const { db } = await connectToMongo();
  return db;
}

// Export collection getters (lazy initialization)
export async function getUsersCollection() {
  const { usersCollection } = await connectToMongo();
  return usersCollection;
}

export async function getMonstersCollection() {
  const { monstersCollection } = await connectToMongo();
  return monstersCollection;
}

export async function getNftLootCollection() {
  const { nftLootCollection } = await connectToMongo();
  return nftLootCollection;
}

export async function getUserInventoryCollection() {
  const { userInventoryCollection } = await connectToMongo();
  return userInventoryCollection;
}

export async function getBattleSessionsCollection() {
  const { battleSessionsCollection } = await connectToMongo();
  return battleSessionsCollection;
}

export async function getPlayerStatsCollection() {
  const { playerStatsCollection } = await connectToMongo();
  return playerStatsCollection;
}

export async function getMaterialTokensCollection() {
  const { materialTokensCollection } = await connectToMongo();
  return materialTokensCollection;
}

export async function getMarketplaceItemsCollection() {
  const { marketplaceItemsCollection } = await connectToMongo();
  return marketplaceItemsCollection;
}
