import { MongoClient, ServerApiVersion, Db, Collection, Document } from 'mongodb';
import type { User, NFTLoot, UserInventory, BattleSession, PlayerStats, MaterialToken, MarketplaceItem, MarketplaceListingBeef, BattleHistory } from '@shared/types';

// Extract database name from URI
function getDatabaseNameFromUri(connectionUri: string): string {
  try {
    // Parse the URI to extract the database name
    const url = new URL(connectionUri.replace('mongodb+srv://', 'http://').replace('mongodb://', 'http://'));
    const dbName = url.pathname.slice(1).split('?')[0]; // Remove leading '/' and query params

    if (!dbName) {
      throw new Error('Database name not found in MONGODB_URI. Please include the database name in the connection string (e.g., mongodb+srv://user:pass@cluster.mongodb.net/supplychain)');
    }

    return dbName;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Database name not found')) {
      throw error;
    }
    throw new Error('Failed to parse MONGODB_URI. Please ensure it is a valid MongoDB connection string with a database name.');
  }
}

// Lazy initialization - only get env vars when actually connecting
function getMongoConfig() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  const dbName = getDatabaseNameFromUri(uri);
  return { uri, dbName };
}

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

// Cache the client on globalThis so warm serverless invocations and Next dev HMR
// re-evaluation reuse one connection instead of leaking a new one each reload.
// Only cached AFTER a successful client.connect() - never cache an in-flight/rejectable promise.
const globalForMongo = globalThis as unknown as {
  _mbMongoClient?: MongoClient;
};

// Client will be initialized on first connection (seeded from globalThis cache, if any)
let client: MongoClient | null = globalForMongo._mbMongoClient ?? null;

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  NFT_LOOT: 'nft_loot',
  USER_INVENTORY: 'user_inventory',
  BATTLE_SESSIONS: 'battle_sessions',
  BATTLE_HISTORY: 'battle_history',
  PLAYER_STATS: 'player_stats',
  MATERIAL_TOKENS: 'material_tokens',
  MARKETPLACE_ITEMS: 'marketplace_items',
  MARKETPLACE_LISTING_BEEFS: 'marketplace_listing_beefs',
  AUTH_NONCES: 'auth_nonces',
} as const;

// Database and collections cache
let db: Db | null = null;
let usersCollection: Collection<User> | null = null;
let nftLootCollection: Collection<NFTLoot> | null = null;
let userInventoryCollection: Collection<UserInventory> | null = null;
let battleSessionsCollection: Collection<BattleSession> | null = null;
let battleHistoryCollection: Collection<BattleHistory> | null = null;
let playerStatsCollection: Collection<PlayerStats> | null = null;
let materialTokensCollection: Collection<MaterialToken> | null = null;
let marketplaceItemsCollection: Collection<MarketplaceItem> | null = null;
let marketplaceListingBeefsCollection: Collection<MarketplaceListingBeef> | null = null;

// Track whether required-index verification has already run this process (cold start).
// Guards connectToMongo's call to verifyCriticalIndexes - NOT part of connectRaw.
let collectionsInitialized = false;

// Promise to handle concurrent connection attempts
let connectingPromise: Promise<void> | null = null;

/**
 * Verify that every security/uniqueness-critical index actually exists.
 * Called on first connect instead of creating indexes on the request path.
 * Throws (fail-fast) if any required unique index is missing, rather than
 * letting the app boot with a collection that can silently accept duplicates.
 */
interface RequiredUniqueIndex {
  collectionName: string;
  key: Record<string, 1 | -1>;
  partial?: boolean; // requires a partialFilterExpression to be present
}

const REQUIRED_UNIQUE_INDEXES: RequiredUniqueIndex[] = [
  { collectionName: COLLECTIONS.USERS, key: { userId: 1 } },
  { collectionName: COLLECTIONS.PLAYER_STATS, key: { userId: 1 } },
  { collectionName: COLLECTIONS.MATERIAL_TOKENS, key: { tokenId: 1 } },
  { collectionName: COLLECTIONS.BATTLE_HISTORY, key: { sessionId: 1 } },
  { collectionName: COLLECTIONS.MARKETPLACE_ITEMS, key: { inventoryItemId: 1 }, partial: true },
  { collectionName: COLLECTIONS.MARKETPLACE_ITEMS, key: { materialTokenId: 1 }, partial: true },
  { collectionName: COLLECTIONS.MARKETPLACE_LISTING_BEEFS, key: { listingId: 1 } },
  { collectionName: COLLECTIONS.AUTH_NONCES, key: { nonce: 1 } },
];

function indexKeysEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k, i) => bKeys[i] === k && a[k] === b[k]);
}

export async function verifyCriticalIndexes(db: Db): Promise<void> {
  for (const spec of REQUIRED_UNIQUE_INDEXES) {
    let indexes: Array<{ key: Record<string, unknown>; unique?: boolean; partialFilterExpression?: unknown }> = [];
    try {
      indexes = await db.collection(spec.collectionName).listIndexes().toArray();
    } catch {
      // Collection doesn't exist yet (or listIndexes failed) -> treat as missing
      indexes = [];
    }

    const found = indexes.some(
      (idx) =>
        idx.unique === true &&
        indexKeysEqual(idx.key, spec.key) &&
        (!spec.partial || !!idx.partialFilterExpression)
    );

    if (!found) {
      throw new Error(
        `Missing required unique index on "${spec.collectionName}" for ${JSON.stringify(spec.key)}. ` +
          'Run `npm run db:migrate` to create required indexes.'
      );
    }
  }
}

/**
 * Create/verify every index the app relies on. This is a deploy-time operation,
 * NOT run on the request path - invoke via `npm run db:migrate` (scripts/db-migrate.ts).
 */
export async function ensureSchema(db: Db): Promise<void> {
  const usersCollection = db.collection<User>(COLLECTIONS.USERS);
  const nftLootCollection = db.collection<NFTLoot>(COLLECTIONS.NFT_LOOT);
  const userInventoryCollection = db.collection<UserInventory>(COLLECTIONS.USER_INVENTORY);
  const battleSessionsCollection = db.collection<BattleSession>(COLLECTIONS.BATTLE_SESSIONS);
  const battleHistoryCollection = db.collection<BattleHistory>(COLLECTIONS.BATTLE_HISTORY);
  const playerStatsCollection = db.collection<PlayerStats>(COLLECTIONS.PLAYER_STATS);
  const materialTokensCollection = db.collection<MaterialToken>(COLLECTIONS.MATERIAL_TOKENS);
  const marketplaceItemsCollection = db.collection<MarketplaceItem>(COLLECTIONS.MARKETPLACE_ITEMS);
  const marketplaceListingBeefsCollection = db.collection<MarketplaceListingBeef>(COLLECTIONS.MARKETPLACE_LISTING_BEEFS);
  const authNoncesCollection = db.collection(COLLECTIONS.AUTH_NONCES);

  async function safeCreateIndex<T extends Document>(
    collection: Collection<T>,
    indexSpec: any,
    options?: any
  ) {
    try {
      await collection.createIndex(indexSpec, options);
    } catch (error: any) {
      if (error?.code === 86 || error?.codeName === 'IndexKeySpecsConflict') {
        const indexName =
          options?.name ||
          Object.keys(indexSpec)
            .map((k) => `${k}_${indexSpec[k]}`)
            .join('_');
        try {
          await collection.dropIndex(indexName);
          await collection.createIndex(indexSpec, options);
        } catch (dropError) {
          throw dropError;
        }
        return;
      }
      throw error;
    }
  }

  // Create indexes for better performance
  // Using Promise.all for parallel index creation
  await Promise.all([
    // Users indexes
    safeCreateIndex(usersCollection, { userId: 1 }, { unique: true }),
    usersCollection.createIndex({ username: 1 }),

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
    battleSessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

    // Battle History indexes
    safeCreateIndex(battleHistoryCollection, { sessionId: 1 }, { unique: true }),
    battleHistoryCollection.createIndex({ userId: 1, createdAt: -1 }),

    // Player Stats indexes
    playerStatsCollection.createIndex({ userId: 1 }, { unique: true }),
    playerStatsCollection.createIndex({ level: 1 }),
    playerStatsCollection.createIndex({ currentZone: 1, currentTier: 1 }),

    // Material Tokens indexes
    materialTokensCollection.createIndex({ userId: 1 }),
    materialTokensCollection.createIndex({ lootTableId: 1 }),
    materialTokensCollection.createIndex({ userId: 1, lootTableId: 1, tier: 1 }), // Compound index for check-token query
    safeCreateIndex(materialTokensCollection, { tokenId: 1 }, { unique: true }), // Unique blockchain token ID
    materialTokensCollection.createIndex({ consumed: 1 }),

    // Marketplace Items indexes
    marketplaceItemsCollection.createIndex({ sellerId: 1 }),
    marketplaceItemsCollection.createIndex({ status: 1 }),
    marketplaceItemsCollection.createIndex({ status: 1, listedAt: -1 }), // Active listings by date
    marketplaceItemsCollection.createIndex({ itemType: 1, status: 1 }), // Filter by type
    marketplaceItemsCollection.createIndex({ rarity: 1, status: 1 }), // Filter by rarity
    marketplaceItemsCollection.createIndex({ tier: 1, status: 1 }), // Filter by tier
    marketplaceItemsCollection.createIndex({ itemName: 1 }), // Regular index for name search

    // At most one active listing per item (partial: only indexes active listings)
    safeCreateIndex(
      marketplaceItemsCollection,
      { inventoryItemId: 1 },
      { unique: true, partialFilterExpression: { status: 'active', inventoryItemId: { $exists: true } } }
    ),
    safeCreateIndex(
      marketplaceItemsCollection,
      { materialTokenId: 1 },
      { unique: true, partialFilterExpression: { status: 'active', materialTokenId: { $exists: true } } }
    ),

    // Marketplace listing BEEF backups, keyed by listingId
    safeCreateIndex(marketplaceListingBeefsCollection, { listingId: 1 }, { unique: true }),

    // Auth nonces: replay protection (unique) + TTL eviction after proof expiry
    safeCreateIndex(authNoncesCollection, { nonce: 1 }, { unique: true }),
    authNoncesCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);

}

// Connect + assign collection handles ONLY. Creates nothing, verifies nothing.
// Used directly by scripts/db-migrate.ts (which must bootstrap a fresh DB before any
// index can exist) and internally by connectToMongo.
async function connectRaw() {
  // Return immediately if already connected
  if (db) {
    return {
      db: db!,
      usersCollection: usersCollection!,
      nftLootCollection: nftLootCollection!,
      userInventoryCollection: userInventoryCollection!,
      battleSessionsCollection: battleSessionsCollection!,
      battleHistoryCollection: battleHistoryCollection!,
      playerStatsCollection: playerStatsCollection!,
      materialTokensCollection: materialTokensCollection!,
      marketplaceItemsCollection: marketplaceItemsCollection!,
      marketplaceListingBeefsCollection: marketplaceListingBeefsCollection!
    };
  }

  // If already connecting, wait for that connection
  if (connectingPromise) {
    await connectingPromise;
    return {
      db: db!,
      usersCollection: usersCollection!,
      nftLootCollection: nftLootCollection!,
      userInventoryCollection: userInventoryCollection!,
      battleSessionsCollection: battleSessionsCollection!,
      battleHistoryCollection: battleHistoryCollection!,
      playerStatsCollection: playerStatsCollection!,
      materialTokensCollection: materialTokensCollection!,
      marketplaceItemsCollection: marketplaceItemsCollection!,
      marketplaceListingBeefsCollection: marketplaceListingBeefsCollection!
    };
  }

  // Start connection process
  connectingPromise = (async () => {
    try {
      // Get config only when actually connecting (lazy - allows a script to load
      // dotenv before this first runs)
      const { uri, dbName } = getMongoConfig();

      // Initialize client if not already done. Only cache on globalThis AFTER a
      // successful connect() - never cache a promise that could stay rejected.
      if (!client) {
        client = new MongoClient(uri, options);
        await client.connect();
        globalForMongo._mbMongoClient = client;
      } else {
        // Reuse existing client if already connected
      }

      // Initialize database with explicit name
      db = client.db(dbName);

      // Get typed collection handles (no schema/index setup, no verification here)
      usersCollection = db.collection<User>(COLLECTIONS.USERS);
      nftLootCollection = db.collection<NFTLoot>(COLLECTIONS.NFT_LOOT);
      userInventoryCollection = db.collection<UserInventory>(COLLECTIONS.USER_INVENTORY);
      battleSessionsCollection = db.collection<BattleSession>(COLLECTIONS.BATTLE_SESSIONS);
      battleHistoryCollection = db.collection<BattleHistory>(COLLECTIONS.BATTLE_HISTORY);
      playerStatsCollection = db.collection<PlayerStats>(COLLECTIONS.PLAYER_STATS);
      materialTokensCollection = db.collection<MaterialToken>(COLLECTIONS.MATERIAL_TOKENS);
      marketplaceItemsCollection = db.collection<MarketplaceItem>(COLLECTIONS.MARKETPLACE_ITEMS);
      marketplaceListingBeefsCollection = db.collection<MarketplaceListingBeef>(COLLECTIONS.MARKETPLACE_LISTING_BEEFS);

    } catch (error) {
      console.error("❌ Error connecting to MongoDB:", error);
      try { await client?.close(); } catch { /* ignore */ }
      client = null; // Reset failed/unconnected client so the next call reconnects (self-heal)
      connectingPromise = null; // Reset on error so retry is possible
      throw error;
    } finally {
      // Clear the connecting promise
      connectingPromise = null;
    }
  })();

  // Wait for connection to complete
  await connectingPromise;

  return {
    db: db!,
    usersCollection: usersCollection!,
    nftLootCollection: nftLootCollection!,
    userInventoryCollection: userInventoryCollection!,
    battleSessionsCollection: battleSessionsCollection!,
    battleHistoryCollection: battleHistoryCollection!,
    playerStatsCollection: playerStatsCollection!,
    materialTokensCollection: materialTokensCollection!,
    marketplaceItemsCollection: marketplaceItemsCollection!,
    marketplaceListingBeefsCollection: marketplaceListingBeefsCollection!
  };
}

// Connect to MongoDB - connects, assigns handles, and fail-fasts if required indexes are
// missing. Creates nothing. Run `npm run db:migrate` (which calls ensureSchema) to create
// schema/indexes.
async function connectToMongo() {
  const handles = await connectRaw();

  // Only verify once per process (indexes themselves are created out-of-band via
  // `npm run db:migrate` -> ensureSchema()). Fail fast if required indexes are missing.
  if (!collectionsInitialized) {
    await verifyCriticalIndexes(handles.db);
    collectionsInitialized = true;
  }

  return handles;
}

// Export connection functions
export { connectToMongo, connectRaw };

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
  throw new Error('Monsters collection is no longer used. Monster snapshots are stored on battle sessions.');
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

export async function getClient() {
  if (!client) {
    throw new Error('MongoDB client not initialized');
  }
  return client;
}

// Graceful shutdown handler (for development)
if (process.env.NODE_ENV === 'development') {
  process.on('SIGINT', async () => {
    try {
      if (client) {
        await client.close();
      }
      process.exit(0);
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
      process.exit(1);
    }
  });
}
