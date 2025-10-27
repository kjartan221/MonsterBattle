import { MongoClient, ServerApiVersion, Db, Collection } from 'mongodb';
import type { User, Monster, NFTLoot, UserInventory, BattleSession, PlayerStats } from './types';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MONGODB_URI to .env file');
}

const uri = process.env.MONGODB_URI;

// Create the MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  MONSTERS: 'monsters',
  NFT_LOOT: 'nft_loot',
  USER_INVENTORY: 'user_inventory',
  BATTLE_SESSIONS: 'battle_sessions',
  PLAYER_STATS: 'player_stats',
} as const;

// Database and collections
let db: Db;
let usersCollection: Collection<User>;
let monstersCollection: Collection<Monster>;
let nftLootCollection: Collection<NFTLoot>;
let userInventoryCollection: Collection<UserInventory>;
let battleSessionsCollection: Collection<BattleSession>;
let playerStatsCollection: Collection<PlayerStats>;

// Connect to MongoDB and initialize collections
async function connectToMongo() {
  if (!db) {
    try {
      // Connect the client to the server
      await client.connect();
      console.log("Connected to MongoDB!");

      // Initialize database
      db = client.db();

      // Check existing collections
      const existing = new Set(
        (await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name)
      );

      // Create collections if they don't exist
      if (!existing.has(COLLECTIONS.USERS)) {
        await db.createCollection(COLLECTIONS.USERS);
      }
      if (!existing.has(COLLECTIONS.MONSTERS)) {
        await db.createCollection(COLLECTIONS.MONSTERS);
      }
      if (!existing.has(COLLECTIONS.NFT_LOOT)) {
        await db.createCollection(COLLECTIONS.NFT_LOOT);
      }
      if (!existing.has(COLLECTIONS.USER_INVENTORY)) {
        await db.createCollection(COLLECTIONS.USER_INVENTORY);
      }
      if (!existing.has(COLLECTIONS.BATTLE_SESSIONS)) {
        await db.createCollection(COLLECTIONS.BATTLE_SESSIONS);
      }
      if (!existing.has(COLLECTIONS.PLAYER_STATS)) {
        await db.createCollection(COLLECTIONS.PLAYER_STATS);
      }

      // Get typed collection handles
      usersCollection = db.collection<User>(COLLECTIONS.USERS);
      monstersCollection = db.collection<Monster>(COLLECTIONS.MONSTERS);
      nftLootCollection = db.collection<NFTLoot>(COLLECTIONS.NFT_LOOT);
      userInventoryCollection = db.collection<UserInventory>(COLLECTIONS.USER_INVENTORY);
      battleSessionsCollection = db.collection<BattleSession>(COLLECTIONS.BATTLE_SESSIONS);
      playerStatsCollection = db.collection<PlayerStats>(COLLECTIONS.PLAYER_STATS);

      // Create indexes for better performance

      // Users indexes
      await usersCollection.createIndex({ userId: 1 }, { unique: true });
      await usersCollection.createIndex({ username: 1 });

      // Monsters indexes
      await monstersCollection.createIndex({ rarity: 1 });
      await monstersCollection.createIndex({ createdAt: -1 });

      // NFT Loot indexes
      await nftLootCollection.createIndex({ rarity: 1 });
      await nftLootCollection.createIndex({ lootTableId: 1 });
      await nftLootCollection.createIndex({ mintTransactionId: 1 }, {
        partialFilterExpression: { mintTransactionId: { $exists: true } }
      });

      // User Inventory indexes
      await userInventoryCollection.createIndex({ userId: 1 });
      await userInventoryCollection.createIndex({ lootTableId: 1 });
      await userInventoryCollection.createIndex({ nftLootId: 1 }, {
        partialFilterExpression: { nftLootId: { $exists: true } }
      });
      await userInventoryCollection.createIndex({ userId: 1, acquiredAt: -1 });
      await userInventoryCollection.createIndex({ fromMonsterId: 1 });

      // Battle Sessions indexes
      await battleSessionsCollection.createIndex({ userId: 1, startedAt: -1 });
      await battleSessionsCollection.createIndex({ userId: 1, isDefeated: 1 });
      await battleSessionsCollection.createIndex({ monsterId: 1 });

      // Player Stats indexes
      await playerStatsCollection.createIndex({ userId: 1 }, { unique: true });
      await playerStatsCollection.createIndex({ level: 1 });
      await playerStatsCollection.createIndex({ currentZone: 1, currentTier: 1 });

      console.log("MongoDB indexes created successfully");
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
      throw error;
    }
  }
  return {
    db,
    usersCollection,
    monstersCollection,
    nftLootCollection,
    userInventoryCollection,
    battleSessionsCollection,
    playerStatsCollection
  };
}

// Connect immediately when this module is imported
connectToMongo().catch(console.error);

// Handle application shutdown
process.on('SIGINT', async () => {
  try {
    await client.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error during MongoDB shutdown:', error);
    process.exit(1);
  }
});

// Export the connection function and collections
export {
  connectToMongo,
  usersCollection,
  monstersCollection,
  nftLootCollection,
  userInventoryCollection,
  battleSessionsCollection,
  playerStatsCollection
};

// Helper function to get database (for backward compatibility)
export async function getDatabase(): Promise<Db> {
  const { db } = await connectToMongo();
  return db;
}
