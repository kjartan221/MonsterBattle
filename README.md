# Monster Battle - BSV Blockchain Game

A BSV blockchain game — a **Vite + React SPA** talking to a **single-instance Express API** — demonstrating server-controlled minting, overlay network broadcasting, and on-chain provable item crafting.

---

## 🎯 Project Focus

This project showcases **production-ready BSV blockchain integration** for gaming:

- **Server-Side Minting**: Secure, fraud-proof item creation
- **OrdinalP2PKH Tokens**: BSV-20/BSV-21 compliant token implementation
- **Overlay Network**: Custom overlay for game transactions
- **Material Tokens**: Quantity-based tokens with smart updates
- **Hybrid Crafting**: Client material consumption with server-minted output
- **Auth Outputs**: On-chain provable links between transactions
- **Per-Output Derived Keys**: Type-42 (BRC-42) keys with a per-output nonce + wallet-basket storage (no key reuse)
- **OrderLock Marketplace**: P2P listing / buy / cancel for trading items

**📖 [Read More: Why BSV & Transaction Flow Pattern](./TRANSACTION_FLOW_PATTERN.md)**

---

## 🏗️ Blockchain Architecture

### Server-Side Minting Model

All game items are minted **server-side** for security and validation:

```
Client Request → Server Validates → Server Mints → Server Transfers → Database Update
```

**Why Server-Side?**
- ✅ Single source of truth (server wallet)
- ✅ Prevents fraudulent items
- ✅ Validates user ownership before minting
- ✅ Handles complex SIGHASH scenarios
- ✅ All mints provably originate from server

### Per-Output Derived Keys & Wallet Baskets

Every token output is locked to a unique, freshly-derived child key (type-42 / BRC-42) using a per-output **nonce**, instead of one reused key — improving privacy/linkability and key-exposure hygiene.

- **Protocol**: `TOKEN_PROTOCOL = [2, 'monsterbattle token']` (security level 2, counterparty-bound). Helpers in `shared/tokenDerivation.ts`.
- **Nonce storage (dual)**: written to the owner's **wallet basket** via `internalizeAction` (basket `monsterbattle.tokens`) for self-custody/recovery, **and** to a DB index (`tokenId → {keyId, counterparty}`) for O(1) hot-path lookup. The wallet basket is the source of truth; the DB index is a rebuildable cache (`reindexFromBasket`).
- **Creator carries the BEEF**: whoever builds a transfer provides its BEEF (the server holds what it built; clients post base64 BEEF in the request body). The overlay is a fallback only (`fetchTokenSourceTx`). BEEFs cross the wire **base64**-encoded.
- **Dual-path unlock**: the `OrdinalsP2PKH` template defaults to the legacy fixed scheme, so pre-migration tokens still spend; new outputs use the derived scheme.
- **Marketplace**: OrderLock listings are backed up in the `marketplace_listing_beefs` collection so buy/cancel never depend on the overlay.

See the design/plan in `docs/specs/2026-06-11-derived-key-basket-storage-*.md`.

### Three Minting Flows

#### 1. Regular Items (Weapons, Armor, Artifacts)

**Two-Transaction Flow**:
```
Mint TX:     Server → Server (1 sat, OrdinalP2PKH)
Transfer TX: Server → User   (1 sat, OrdinalP2PKH)
```

**API**: `POST /api/items/mint-and-transfer`

**Tracking**:
- `NFTLoot.mintOutpoint` - Server mint proof (txid.vout)
- `UserInventory.tokenId` - User's current outpoint (txid.vout)

#### 2. Material Tokens (Iron, Wood, Dragon Scales)

**Quantity-Based Tokens**:
```
Each material = 1 token with quantity field
Updates reuse same token (no duplication)
```

**Smart Update System**:
- Checks for existing token via `/api/materials/check-token`
- If exists: Updates quantity on existing token
- If new: Mints new token with initial quantity

**API**: `POST /api/materials/mint-and-transfer`

**Tracking**:
- `MaterialToken.mintOutpoint` - Server mint proof
- `MaterialToken.tokenId` - Current outpoint
- `MaterialToken.quantity` - Current material count

#### 3. Crafted Items (Hybrid Flow)

**Most Complex**: Client controls material consumption, server controls item minting.

**Client Transaction**:
```typescript
// useCraftItemNFT.ts
Inputs:  Material tokens (user unlocks)
Outputs: Material change (if excess) + Auth output (locked to server)
```

**Server Transactions**:
```typescript
// /api/crafting/mint-and-transfer
Mint TX:     Auth input → Crafted item (server mints)
Transfer TX: Crafted item → User
```

**Auth Output**:
- Uses `OrdinalP2PKH` (overlay requirement)
- Locked to server public key
- Proves on-chain link: materials → crafted item
- Server validation: "If server can unlock it, it's valid"

**API**: `POST /api/crafting/mint-and-transfer`

**Tracking**:
- `craftingProof.consumptionTxId` - Client material consumption tx
- `craftingProof.authOutpoint` - Auth output linking transactions
- `craftingProof.recipeId` - Recipe used for crafting

---

## 🔗 BSV Blockchain Integration

### OrdinalP2PKH Token Standard

All game tokens use `OrdinalP2PKH` for BSV-20/BSV-21 compliance:

```typescript
import { OrdinalsP2PKH } from '@shared/ordinalP2PKH';

const ordinalP2PKH = new OrdinalsP2PKH();

// Minting (deploy+mint)
const mintLockingScript = ordinalP2PKH.lock(
  publicKey,
  '',              // Empty assetId for new mint
  metadata,        // Token metadata
  'deploy+mint'
);

// Transferring
const transferLockingScript = ordinalP2PKH.lock(
  userPublicKey,
  assetId,         // mintOutpoint with '.' replaced by '_'
  metadata,
  'transfer'
);

// Unlocking
const unlockTemplate = ordinalP2PKH.unlock(wallet, "single");
const unlockingScript = await unlockTemplate.sign(transaction, outputIndex);
```

**Key Features**:
- OP_FALSE OP_RETURN prefix with JSON metadata
- P2PKH locking for ownership
- Asset ID format: `${mintTxId}_${vout}` (BSV-21 standard)
- SIGHASH_SINGLE for multi-output transactions

### Overlay Network

Custom overlay for broadcasting and querying game transactions:

```typescript
// shared/overlayFunctions.ts
import { LookupResolver, TopicBroadcaster } from "@bsv/sdk";

const overlay = new LookupResolver({
  slapTrackers: ['https://overlay-us-1.bsvb.tech'],
  hostOverrides: {
    'ls_monsterbattle': ['https://overlay-us-1.bsvb.tech']
  }
});

// Broadcasting
export const broadcastTX = async (tx: Transaction) => {
  const tb = new TopicBroadcaster(['tm_monsterbattle'], {
    resolver: overlay,
  });
  return await tx.broadcast(tb);
}

// Querying
export async function getTransactionByTxID(txid: string) {
  return await overlay.query({
    service: 'ls_monsterbattle',
    query: { txid: txid }
  }, 10000);
}
```

**Overlay Requirements**:
- All outputs must be `OrdinalP2PKH` or `OrderLock`
- Regular P2PKH outputs are **rejected**
- Includes "helper" outputs like auth tokens

### Transaction Flow Pattern

All blockchain operations in this application follow a **standardized 3-step pattern** for transaction creation and signing:

**📖 [Read Full Documentation: Transaction Flow Pattern](./TRANSACTION_FLOW_PATTERN.md)**

**Quick Summary**:
```
1. createAction  → Prepare transaction with estimated script lengths
2. Sign          → Generate actual unlocking scripts using SDK
3. signAction    → Finalize transaction with actual scripts
```

This pattern provides:
- ✅ **Consistency**: Same flow across the wallet-touching Express routes
- ✅ **BSV-20/21 Support**: Handles fungible (materials) and non-fungible (items) tokens
- ✅ **On-Chain Credibility**: Full provenance for every game item and operation
- ✅ **Server Control**: Prevents fraudulent minting and ensures game rule enforcement
- ✅ **Scalability**: Handles single and multiple input transactions seamlessly

Every item minted, crafted, transferred, or updated has a **verifiable on-chain record**, demonstrating a production-ready blockchain-based game economy.

All wallet-touching work runs through **one serialized wallet queue** (`server/lib/walletQueue.ts`) in the single-instance server, so concurrent mints can never race the server wallet's UTXOs.

**Example Routes Using This Pattern** (all in `server/routes/`):
- `server/routes/items.ts` — Item NFT minting (`POST /api/items/mint-and-transfer`)
- `server/routes/materials.ts` — Material token minting + merging (`/mint-and-transfer`, `/add-and-merge`)
- `server/routes/crafting.ts` — Crafting with material consumption (`/mint-and-transfer`)
- `server/routes/equipment.ts` — Equipment inscription updates (`/update`)
- `server/routes/marketplace.ts` — Purchase (`/purchase-listing`)

### Outpoint Tracking

**Critical**: Always store full outpoints (txid.vout), never just txid.

**Why?**
```
❌ WRONG: transactionId: "abc123..."
   Problem: Which output? Could be vout 0, 1, 2...

✅ CORRECT: tokenId: "abc123...def.0"
   Clear: Exact UTXO location (output 0 of tx abc123...def)
```

**Benefits**:
- Exact UTXO location tracking
- No ambiguity in multi-output transactions
- Correct material token linking
- Easier debugging (paste outpoint in explorer)

**Format**: `${txid}.${vout}`

**Examples**:
```typescript
mintOutpoint:  "abc123...def.0"  // Mint transaction output 0
tokenId:       "ghi789...jkl.0"  // Transfer transaction output 0
authOutpoint:  "mno012...pqr.2"  // Consumption transaction output 2
```

---

## 🛒 OrderLock Marketplace

**OrderLock** enables trustless P2P trading using BSV smart contracts — implemented and live.

```
Seller → list-item        (locks the item in an OrderLock UTXO at a set price) → listing browsable
Buyer  → purchase-listing  (pays the seller's address, unlocks the item to self) → atomic item↔BSV swap
```

### Routes (`server/routes/marketplace.ts`)

| Method | Path | Guard | Purpose |
|---|---|---|---|
| POST | `/api/marketplace/list-item` | authProof `list` | Create an OrderLock listing (validates client BEEF + recomputes the lock) |
| GET  | `/api/marketplace/items` | public | Browse listings (filter: search / itemType / rarity / tier / price) |
| GET  | `/api/marketplace/listing/:id` | session | One listing (+ its stored BEEF) |
| GET  | `/api/marketplace/my-sales` | session | The caller's active/sold listings |
| POST | `/api/marketplace/purchase-listing` | authProof `purchase` | Buy — atomic item↔BSV swap |
| POST | `/api/marketplace/cancel-listing` | authProof `cancel` | Seller reclaims the item |
| POST | `/api/marketplace/claim-proceeds` | authProof `claim` | Seller internalizes the sale payout |

**Safety:**
- **BEEF backup** — each listing's OrderLock tx is stored in the `marketplace_listing_beefs` collection, so buy/cancel never depend on the overlay being reachable.
- **Concurrency-safe purchase** — the buy path atomically claims the listing (`status: active → pending` via `findOneAndUpdate`, 409 if already taken), runs the wallet op through the serialized queue, finalizes in a Mongo `withTransaction`, and rolls the claim back (`releaseListing`) on any failure.

**References**: `shared/orderLock.ts` (OrderLock template), `_tests/orderLock.test.ts` (tests), `MarketplaceItem` / `MarketplaceListingBeef` in `shared/types.ts`.

---

## 🔧 Technology Stack

**Monorepo (npm workspaces):** `client/` (SPA) · `server/` (API) · `shared/` (framework-agnostic game logic + BSV utils, imported by both). Split-origin — the static SPA and the API deploy separately.

### Frontend (`client/`)
- **Vite 6** + **@vitejs/plugin-react** - build/dev
- **React 19** + **React Router v7** - SPA routing
- **TypeScript** - strict mode
- **TailwindCSS v4** - via `@tailwindcss/vite`
- **@bsv/sdk** / **@bsv/wallet-helper** - browser wallet, BEEF/proof building

### Backend (`server/`)
- **Express 4** - the API (single always-on instance)
- **Serialized wallet queue** - one server `WalletClient`, one UTXO op at a time (the concurrency-safe minting primitive)
- **MongoDB** - native driver
- **JWT** (jose) - httpOnly-cookie sessions + single-use `@bsv/auth` ownership proofs on value-moving routes
- **BSV server wallet** - minting/transfer

### Blockchain
- **BSV Blockchain** - Layer 1
- **OrdinalP2PKH** - Token standard (BSV-20/BSV-21)
- **Overlay Network** - Custom transaction routing
- **OrderLock** - P2P trading smart contracts

---

## 📦 Environment Setup

### Required Environment Variables

**`server/.env`** (the API — server-only; these must never reach the client bundle):
```bash
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key-minimum-32-chars
SERVER_PRIVATE_KEY=your-server-wallet-private-key-hex
WALLET_STORAGE_URL=https://store-us-1.bsvb.tech   # optional (has a default)
BSV_NETWORK=main                                   # 'main' | 'test' (default 'main')
ALLOWED_ORIGINS=http://localhost:5173              # comma-separated SPA origins allowed via CORS
PORT=4000                                          # optional (default 4000)
NODE_ENV=development
```

**`client/.env`** (Vite — only `VITE_`-prefixed vars are exposed to the browser):
```bash
VITE_API_BASE=http://localhost:4000    # the API origin the SPA calls
```

### Installation

```bash
# Install all workspaces (client + server + shared)
npm install

# Dev — API + SPA in two terminals (split-origin):
npm run server:dev     # Express API on :4000 (tsx watch)
npm run client:dev     # Vite SPA on :5173

# Build the SPA (static output → client/dist)
npm run client:build

# Run tests (server-route + logic suites)
npm test

# Type-check
npx tsc --noEmit                          # root/server + shared
npx tsc -p client/tsconfig.json --noEmit  # client

# Lint
npm run lint
```

> Dev is split-origin: set `client/.env` `VITE_API_BASE=http://localhost:4000` and `server/.env` `ALLOWED_ORIGINS` to the Vite origin (`:5173`, or whatever port Vite prints). The API server must be running for the SPA to work.

---

## Database migration

Index creation is **not** on the app's request path and **not** a deploy step. MongoDB is a persistent cloud cluster, so indexes created once **persist**. This is a **dev/ops one-off**: run it against the cluster only when indexes change (a fresh DB, or after editing `ensureSchema()`).

```bash
npm run db:migrate    # needs MONGODB_URI in env / server/.env; runs against whatever cluster that points to
```

This runs `ensureSchema()` (`server/lib/mongodb.ts`) against `MONGODB_URI`, creating every index the app relies on. Run it once per cluster you deploy to (e.g. if prod and staging are separate DBs). On boot the API only **verifies** (does not create) the security-critical unique indexes via `verifyCriticalIndexes()` — if any are missing it **fails fast** with an error telling you to run `npm run db:migrate`. That fail-fast is the safety net against deploying a schema change without migrating the cluster first.

---

## 📂 Project Structure

```
client/                     # Vite + React Router SPA (builds to static)
├── index.html · vite.config.ts · tsconfig.json
└── src/
    ├── main.tsx · App.tsx           # entry, router, providers, route guard
    ├── components/ contexts/ hooks/ # React UI + state (Player, Equipment, Challenge, ...)
    ├── lib/                         # apiFetch, apiFetchStepUp (the API choke-points)
    ├── utils/                       # client wallet utils (orderLock, createWalletPayment, authProofClient)
    └── shared/                      # client-only framework-agnostic utils (internalizeToBasket, tierUtils, reindexFromBasket, ...)

server/                     # Express API — single always-on instance; owns the wallet
├── index.ts · app.ts · config.ts    # boot, buildApp, validated env (self-loads dotenv)
├── routes/                          # /api/* handlers (items, materials, crafting, equipment,
│                                    #   marketplace, spells, consumables, inscriptions,
│                                    #   battle, inventory, player, challenge, auth)
├── middleware/                      # requireSession, requireAuthProof, errorHandler
└── lib/                             # walletQueue, serverWallet, mongodb, jwt, authNonceStore, ...

shared/                     # framework-agnostic — imported by BOTH client and server
├── types.ts · loot-table.ts · monster-table.ts · biome-config.ts · recipe-table.ts
├── equipmentCalculations.ts · playerProgression.ts · monsterBuffs.ts · streakHelpers.ts
└── ordinalP2PKH.ts · overlayFunctions.ts · tokenDerivation.ts · beefEncoding.ts · authProof.ts

_tests/                     # jest — server-route + blockchain/logic tests
docs/                       # design docs & implementation plans (gitignored)
```

---

## 🧪 Testing

### Run All Tests
```bash
npm run test
```

### Test Coverage

**OrdinalP2PKH Token Scripts** (`_tests/ordinalP2PKH.test.ts`):
- ✅ Mint transaction creation
- ✅ Transfer transaction creation
- ✅ Script structure validation
- ✅ Metadata encoding/decoding
- ✅ Asset ID format (BSV-21)

**OrderLock Smart Contracts** (`_tests/orderLock.test.ts`):
- ✅ Order creation and locking
- ✅ Order fulfillment (atomic swap)
- ✅ Order cancellation
- ✅ Multi-signature scenarios
- ✅ Edge cases and failure modes

### Integration Testing _(manual)_

**Regular Items**:
1. Mint weapon/armor/artifact
2. Verify `mintOutpoint` in database
3. Verify `tokenId` in UserInventory
4. Check transaction on overlay

**Material Tokens**:
1. Mint new material (e.g., 10 iron)
2. Mint same material again (should update quantity)
3. Verify `mintOutpoint` doesn't change
4. Verify `tokenId` updates to new outpoint
5. Verify quantity = 20

**Crafted Items**:
1. Craft item with exact materials (no change)
2. Craft item with excess materials (check change outputs)
3. Verify auth output on-chain
4. Verify crafting proof in database
5. Verify material quantities updated

---

## 🎮 Game Overview (Brief)

A click-based monster battler where:
- Fight monsters across 5 biomes (Forest → Desert → Ocean → Volcano → Castle)
- Defeat monsters to earn loot (materials, equipment, consumables)
- Craft powerful items using materials
- Equip gear for stat bonuses (damage, crit, defense, HP)
- Level up and progress through tiers (1-5)

**Blockchain Integration**:
- All items/materials are BSV blockchain tokens
- Crafting creates provable on-chain links
- Future: Trade items on P2P marketplace (OrderLock)

---

## 🔐 Security Features

### Server-Side Validation
- User ownership verified before minting
- JWT authentication on all API routes
- MongoDB queries filtered by userId

### Anti-Cheat System
- Server-side time tracking (database timestamps)
- Click rate validation (max 15 clicks/sec)
- HP verification (did player survive monster damage?)

### Blockchain Security
- Server wallet private key secured in environment
- All mints provably from server wallet (mintOutpoint)
- Auth outputs prove material consumption for crafting
- Outpoint tracking prevents UTXO confusion


## 🤝 Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes (ensure TypeScript compiles: `npx tsc --noEmit`)
3. Run tests: `npm run test`
4. Commit with clear message
5. Push and create PR

## 📝 License

MIT

---

**Built with BSV Blockchain, Vite, and Express**
