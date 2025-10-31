import { MongoClient, ServerApiVersion, Db, Collection } from 'mongodb';
import type { User, Monster, NFTLoot, UserInventory, BattleSession, PlayerStats } from './types';

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
} as const;

// Database and collections cache
let db: Db | null = null;
let usersCollection: Collection<User> | null = null;
let monstersCollection: Collection<Monster> | null = null;
let nftLootCollection: Collection<NFTLoot> | null = null;
let userInventoryCollection: Collection<UserInventory> | null = null;
let battleSessionsCollection: Collection<BattleSession> | null = null;
let playerStatsCollection: Collection<PlayerStats> | null = null;
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
          nftLootCollection.createIndex({ mintTransactionId: 1 }, {
            partialFilterExpression: { mintTransactionId: { $exists: true } }
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
    playerStatsCollection: playerStatsCollection!
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
