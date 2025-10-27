# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude agents

Claude agents are stored in the following directory:
C:\Users\user\.claude\agents

## Project Overview

This is a Next.js 16 application using React 19, TypeScript, and TailwindCSS v4. The project uses the App Router architecture.

### Monster Battle Game

This is a demo application where:
- Monster PNG images appear in the middle of the screen
- Users must click a certain number of times to "defeat" each monster
- Defeated monsters drop "loot" in the form of NFTs
- Collected loot/NFTs are stored and displayed in an inventory page

**Current Implementation Status:**
- ✅ Authentication system (JWT-based with manual login)
- ✅ Monster battle system (create, attack, defeat with click tracking)
- ✅ Loot drop system (5 items per victory, user selects 1)
- ✅ Session persistence (survives page refreshes)
- ✅ Anti-cheat system (server-side time validation)
- ✅ Toast notifications (react-hot-toast)
- ✅ Inventory system (userInventory collection stores collected items)
- ✅ Inventory page with treasure chest UI
- ⏳ NFT minting to blockchain (placeholder for future BSV integration)

## Build and Development Commands

```bash
# Start development server (with webpack bundler)
npm run dev

# Production build (with webpack bundler)
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

Note: This project explicitly uses webpack bundler (not Turbopack) via the `--webpack` flag.

## Architecture

### Framework Configuration

- **Next.js 16**: Uses App Router (not Pages Router)
- **React 19**: Latest version with new features
- **TypeScript**: Strict mode enabled with `jsx: "react-jsx"` transform
- **Module Resolution**: Uses `bundler` mode with path alias `@/*` mapping to `./src/*`

### Directory Structure

- `src/`: src directory
  - `app/`: App Router-
    - `api/`: API routes
    - `layout.tsx`: Root layout with Geist font configuration
    - `page.tsx`: Homepage component
    - `globals.css`: Global styles and TailwindCSS imports
  - `components/`: Page components
  - `lib/`: mongoDB
  - `hooks/`: Hook functions
  - `utils/`: Utilities
- `public/`: Static assets

### Styling

- **TailwindCSS v4**: Configured via PostCSS with `@tailwindcss/postcss` plugin
- Global styles include light/dark mode support with `dark:` variants
- Geist and Geist Mono fonts loaded via `next/font/google`

### TypeScript Configuration

- Path aliases: `@/*` resolves to `./src/*`
- Target: ES2017
- Strict mode enabled
- JSX transform: Uses new automatic runtime (`react-jsx`)

### Linting

ESLint configured with:
- `eslint-config-next/core-web-vitals`
- `eslint-config-next/typescript`
- Custom ignores for `.next/`, `out/`, `build/`, and `next-env.d.ts`

## Important Implementation Notes

### Webpack Configuration

This project is configured to use webpack bundler explicitly. When running dev or build commands, the `--webpack` flag is required (already configured in package.json scripts).

### Dark Mode

The application supports dark mode via Tailwind's `dark:` variant. Components use `dark:` classes for dark mode styling.

### Image Optimization

Use Next.js `<Image>` component from `next/image` for optimized image loading. The template demonstrates this with SVG logos using the `dark:invert` utility.

### Creating new pages

When creating a new page within the Nextjs project, use the proper folder and page.tsx file naming for the App Router. Leave the page.tsx for a new page as bare bones as possible, only referencing a component like `<HomePage />`. The component should be created in the components folder, with all the actual html and code for the page.

---

## Application Systems

### Authentication System

**Implementation**: JWT-based authentication with HTTP-only cookies

**Files**:
- `src/app/api/login/route.ts` - Login endpoint
- `src/app/api/logout/route.ts` - Logout endpoint (clears cookie)
- `src/utils/jwt.ts` - JWT creation and verification using `jose` library
- `src/middleware.ts` - Protected route middleware
- `src/components/LoginPage.tsx` - Login UI

**Features**:
- **Manual Login**: Users provide username + identity key (userId)
- **Wallet Login**: Placeholder for future BSV wallet integration
- **JWT Tokens**: 7-day expiration, HS256 algorithm
- **Secure Cookies**: httpOnly, sameSite: 'lax', secure in production
- **Protected Routes**: Middleware redirects unauthenticated users to login
- **Auto-redirect**: Authenticated users on `/` redirect to `/battle`

**Environment Variables Required**:
```bash
JWT_SECRET=your-secret-key-here  # Used for signing JWTs
```

---

### Database Architecture (MongoDB)

**Connection**: `src/lib/mongodb.ts`
- Auto-connects on module import
- Uses MongoDB's native `_id` (ObjectId) for all collections
- Graceful shutdown handling

**Collections**:

#### Users Collection
```typescript
{
  _id: ObjectId,
  userId: string,        // BSV public key (serves as unique identifier)
  username: string,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes**: `userId` (unique), `username`

**Note**: `userId` IS the BSV public key - it serves as both the unique identifier and source for generating personalized item gradients

#### Monsters Collection
```typescript
{
  _id: ObjectId,
  name: string,          // e.g. "Dragon", "Goblin"
  imageUrl: string,      // Emoji icon (e.g. "🐉")
  clicksRequired: number,
  rarity: 'common' | 'rare' | 'epic' | 'legendary',
  createdAt: Date
}
```
**Indexes**: `rarity`, `createdAt`

#### NFT Loot Collection
```typescript
{
  _id: ObjectId,
  lootTableId: string,   // Reference to loot-table.ts lootId (e.g. "dragon_scale")
  name: string,          // Item name (e.g. "Dragon Scale")
  description: string,   // Item description
  icon: string,          // Emoji icon (e.g. "🐲")
  rarity: 'common' | 'rare' | 'epic' | 'legendary',
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact',
  attributes: Record<string, any>, // Custom NFT metadata
  mintTransactionId: string, // BSV transaction ID when minted to blockchain
  createdAt: Date
}
```
**Indexes**: `rarity`, `lootTableId`, `mintTransactionId` (partial, only when exists)

**Purpose**:
- Stores actual item instances as database documents
- Each document represents a unique collectible item
- References loot-table.ts via `lootTableId` for template data
- Will store blockchain transaction ID when minted as NFT
- Separates item template (loot-table.ts) from item instances (database)

#### User Inventory Collection
```typescript
{
  _id: ObjectId,
  userId: string,          // Reference to User.userId (BSV public key)
  lootTableId: string,     // Reference to loot-table.ts lootId (e.g. "dragon_scale")
  nftLootId: ObjectId,     // Reference to NFTLoot._id (null until user mints it)
  borderGradient: { color1: string, color2: string }, // User-specific gradient colors
  acquiredAt: Date,
  fromMonsterId: ObjectId, // Reference to Monster._id
  fromSessionId: ObjectId  // Reference to BattleSession._id
}
```
**Indexes**: `userId`, `lootTableId`, `nftLootId` (partial, only when exists), `userId + acquiredAt` (compound), `fromMonsterId`

**Purpose**:
- Tracks items collected by users from defeated monsters
- Items are stored as templates initially (via lootTableId reference)
- User decides if they want to mint the item as an NFT (costs BSV)
- nftLootId is null until user pays to mint it
- Reduces server costs by only creating NFTs for items users value
- Tracks which monster/session the item came from for provenance

#### Battle Sessions Collection
```typescript
{
  _id: ObjectId,
  userId: string,        // Reference to User.userId
  monsterId: ObjectId,   // Reference to Monster._id
  clickCount: number,
  isDefeated: boolean,
  lootOptions: string[], // Array of 5 lootIds (from loot-table.ts)
  selectedLootId: string, // The loot user chose (undefined if not selected)
  startedAt: Date,
  completedAt: Date
}
```
**Indexes**: `userId + startedAt`, `userId + isDefeated`, `monsterId`

**Key Rules**:
- Only 1 active session per user (isDefeated: false, no completedAt)
- Server-side time tracking using `startedAt`
- Loot options persisted for refresh recovery

---

### Battle System

**Flow**: Start → Attack → Defeat → Select Loot → Next Monster

#### 1. Start Battle (`POST /api/start-battle`)
- Checks for existing active session (resumes if found)
- Creates new monster with random stats based on rarity
- Creates new battle session
- Returns: `{ session, monster, isNewSession }`

**Monster Generation**:
- 8 monster types: Goblin, Orc, Zombie, Troll, Ghost, Dragon, Vampire, Demon
- Rarity distribution: Common (60%), Rare (25%), Epic (12%), Legendary (3%)
- Click requirements scale with rarity (5-10 for common, 40-50 for legendary)

#### 2. Click Tracking (`POST /api/update-clicks`)
- **Auto-saves every 5 clicks** from frontend
- **Auto-saves every 10 seconds** if unsaved clicks exist
- Only updates if new count > saved count
- Enables session resumption after refresh

#### 3. Battle Completion (`POST /api/attack-monster`)
- **Server-side time calculation**: `Date.now() - session.startedAt`
- **Anti-cheat**: Detects click rates > 15 clicks/second
- **Cheat punishment**: Doubles monster HP, shows warning modal
- **Loot generation**: 5 random items based on monster type
- **Saves loot options** to session for persistence
- Returns: `{ success, monster, session, lootOptions, stats }`

#### 4. Loot Selection (`POST /api/select-loot`)
- User chooses 1 of 5 loot items
- Validates: session exists, defeated, not already selected, valid lootId
- Saves `selectedLootId` to session
- **Adds item to inventory** (does NOT create NFT yet)
- Returns: `{ success, selectedLootId, inventoryItemId }`

**Item Storage Flow**:
1. Fetch item template from `loot-table.ts` using `lootTableId`
2. **Generate unique gradient colors** from user's public key (userId)
3. Create `UserInventory` document with:
   - `lootTableId` (reference to loot-table template)
   - `borderGradient` (user-specific colors)
   - `nftLootId: undefined` (will be set when user mints)
4. Item is now in user's inventory but NOT as an NFT yet

**Important**: No NFT is created at this stage. User must explicitly mint the item later (paying with BSV).

#### 5. Mint NFT (`POST /api/mint-nft`)
- **User-initiated**: Called when user clicks "Mint as NFT" in inventory modal
- **Validates ownership**: Verifies user owns the inventory item
- **Checks if already minted**: Returns error if item already has nftLootId
- **TODO: Process payment**: Request BSV payment from user's wallet
- **Creates NFTLoot document** with enhanced attributes
- **Updates UserInventory** with nftLootId reference
- **TODO: Mint to blockchain** with high-quality image/metadata
- Returns: `{ success, nftLootId, itemName }`

**Minting Flow**:
1. Verify user authentication and item ownership
2. Check item hasn't been minted yet (nftLootId is null)
3. Request payment from BSV wallet (amount based on rarity)
4. Create NFTLoot document with:
   - Template data from loot-table
   - User's borderGradient colors
   - Enhanced attributes (acquiredFrom, acquiredAt, etc.)
5. Update UserInventory with nftLootId
6. Generate fancy NFT image (can afford higher quality since fewer NFTs)
7. Upload to storage (IPFS or similar)
8. Mint to BSV blockchain with metadata + image URL
9. Update NFTLoot with mintTransactionId

**Cost Savings**:
- Only creates NFTs for items users value
- Reduces server/blockchain costs dramatically
- Enables higher quality NFT images (more KBs per image)
- User decides what to preserve on-chain

**Item Personalization**:
- Each item gets a unique 2-color gradient border based on the user's public key (userId)
- Uses `publicKeyToGradient()` utility to deterministically generate two complementary colors
- Gradient stored in `NFTLoot.attributes.borderGradient` as `{ color1, color2 }`
- Same user always gets the same gradient across all their items
- Creates premium visual effect with dual-color glow
- Makes items instantly recognizable as belonging to specific users

**Why Async Minting?**
- Keeps user flow fast - no waiting for blockchain transactions
- User can continue battling immediately after selecting loot
- NFTs are minted in background via `/api/mint-nft` route
- UI shows "Minting..." status until `mintTransactionId` is added

#### 5. Background NFT Minting (`POST /api/mint-nft`)
- Called by background job/queue system (not by users)
- Processes NFTLoot documents without `mintTransactionId`
- Mints to BSV blockchain (TODO: implement BSV SDK integration)
- Updates `mintTransactionId` field once transaction is confirmed
- GET endpoint lists all pending mints for monitoring

---

### Loot System

#### Architecture Overview

The loot system uses a **template + instance** architecture:

- **Loot Table** (`src/lib/loot-table.ts`): Static templates defining all possible items
- **NFTLoot Collection** (MongoDB): Individual item instances created when user collects loot
- **UserInventory Collection** (MongoDB): Links users to their NFTLoot items

**Why this design?**
- Templates are reusable and easy to manage in code
- Each collected item becomes a unique database document
- Supports future NFT minting with unique transaction IDs per item
- Allows tracking item ownership and provenance

**File**: `src/lib/loot-table.ts`

**Loot Pools**:
1. **COMMON_LOOT** (9 items): Shared by all monsters, 70% drop rate
2. **RARE_LOOT** (7 items): Shared by all monsters, 30% drop rate
3. **Monster-Specific Loot**: Unique items per monster type
   - Goblin/Orc: 4 items
   - Zombie: 3 items
   - Troll/Ghost: 8 items
   - Dragon/Vampire: 10 items (includes legendary drops)
   - Demon: 10 items (all legendary)

**Loot Distribution** (for 5 items):
- **1-3 monster-specific items** (70% chance of 1, 25% chance of 2, 5% chance of 3)
- **Remaining slots filled with common/rare shared loot**

**Loot Item Structure**:
```typescript
{
  lootId: string,        // Unique identifier (e.g. "dragon_scale")
  name: string,          // Display name
  icon: string,          // Emoji
  description: string,
  rarity: 'common' | 'rare' | 'epic' | 'legendary',
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact'
}
```

**Helper Functions**:
- `getRandomLoot(monsterName, count)` - Generate loot for defeated monster
- `getLootItemById(lootId)` - Retrieve full item by ID
- `getLootItemsByIds(lootIds[])` - Batch retrieve for session restoration

---

### Frontend Components

#### LoginPage (`src/components/LoginPage.tsx`)
- Two login methods: Wallet (placeholder) or Manual (username + identity key)
- Form validation with toast notifications
- Loading states and error handling

#### BattlePage (`src/components/BattlePage.tsx`)
- **State management**: Handles session, monster, clicks, loot
- **Auto-save**: Periodic click persistence to backend
- **Session restoration**: Detects and restores pending loot selection
- **Three UI states**:
  1. Battle in progress (show monster, click counter, health bar)
  2. Loot selection (modal with 5 options, select 1)
  3. Battle complete (show "Next Monster" button)
- **Logout button**: Top-right corner
- **Inventory button**: Navigate to inventory page
- **Next Monster button**: Fixed right side after loot selection
- **Cheat detection modal**: Warning for suspicious click rates

#### InventoryPage (`src/components/inventory/InventoryPage.tsx`)
- **Treasure chest UI**: Decorative container displaying collected items
- **Item grid**: Responsive grid (2-6 columns based on screen size)
- **Item cards**: Click to view detailed modal
- **Personalized gradient borders**: Each item has unique 2-color gradient border based on user's public key
- **Dual-color glow effects**: Subtle shadows/glows using both gradient colors
- **Rarity-based backgrounds**: Color-coded gradients (common, rare, epic, legendary)
- **Minting status badges**: Shows "Minting..." on items without blockchain transaction
- **Stats section**: Shows count by rarity (common, rare, epic, legendary)
- **Empty state**: Prompts user to start battling
- **Navigation**: Back to Battle and Logout buttons

#### InventoryDetailsModal (`src/components/inventory/InventoryDetailsModal.tsx`)
- **Item metadata display**: Name, icon, rarity, type, description
- **Custom gradient border & glow**: Modal border uses user's unique gradient with dual-color glow effect
- **Unique Gradient Section**:
  - Large gradient preview bar showing both colors
  - Individual color swatches with hex codes
  - Both colors displayed side-by-side
  - Label: "Generated from your public key"
- **NFT Status Section**:
  - Shows "Minting Your NFT..." with spinner for pending items
  - Shows "Minted on Blockchain" with transaction ID for completed items
- **Acquisition date**: Shows when item was collected
- **Item ID**: Reference for debugging

---

### Security Features

#### Anti-Cheat System
- **Server-side time tracking**: Uses `session.startedAt` (database timestamp)
- **Click rate validation**: Max 15 clicks/second
- **Punishment**: Doubles monster HP on detection
- **Client can't manipulate**: Time calculated on server only

#### Session Security
- **JWT verification**: All API routes check valid token
- **User isolation**: Queries filter by `userId` from JWT
- **Input validation**: Session IDs converted to ObjectId with error handling
- **Loot validation**: Can't select loot twice or invalid options

#### State Persistence
- **Refresh-proof**: All critical data in database
- **Recoverable states**: Battle progress, pending loot selection
- **No client-side manipulation**: Server is source of truth

---

### API Routes Reference

#### Authentication
- `POST /api/login` - Create session, set JWT cookie
- `POST /api/logout` - Clear JWT cookie

#### Battle
- `POST /api/start-battle` - Start new battle or resume active session
- `POST /api/update-clicks` - Save click progress (called periodically)
- `POST /api/attack-monster` - Submit battle completion, generate loot

#### Loot
- `POST /api/select-loot` - Save user's loot selection, add to inventory (does NOT create NFT)

#### Inventory
- `GET /api/inventory/get` - Fetch all items in user's inventory (includes unminted and minted items)

#### NFT Minting (User-Initiated)
- `POST /api/mint-nft` - Mint inventory item as NFT (requires BSV payment, user-initiated)

**All routes require authentication** via JWT cookie (except `/api/login` and mint-nft endpoints)

---

### Toast Notifications

**Library**: `react-hot-toast` v2.6.0

**Configuration**: `src/app/layout.tsx`
- Position: top-center
- Duration: 4 seconds
- Dark theme styling
- Success (green) and error (red) variants

**Usage Examples**:
```typescript
toast.success('Monster defeated!');
toast.error('Failed to save progress');
toast.loading('Summoning monster...');
```

**Integration**:
- Login/logout feedback
- Battle state changes
- Loot selection confirmation
- Error handling (replaces inline error UI)

---

### Utility Functions

#### publicKeyToGradient (`src/utils/publicKeyToColor.ts`)

Generates deterministic, vibrant gradient colors from public key hex strings for item personalization.

**Purpose**:
- Creates unique 2-color gradient borders for each user's items
- Ensures same user always gets same gradient (deterministic)
- Generates visually distinct, vibrant colors suitable for dark backgrounds
- Creates premium visual effect with complementary colors

**Algorithm**:
1. Extracts six segments from different positions in the public key hex
2. Generates two distinct colors from different key segments
3. For each color:
   - Converts segments to RGB values (0-255)
   - Applies brightness boost if color is too dark (min 80/255 average)
   - Applies saturation boost if color is too gray (min 30% saturation)
4. Returns object with two hex color codes

**Functions**:
- `publicKeyToGradient(publicKeyHex: string): { color1: string; color2: string }` - Gradient generator
- `publicKeyToColor(publicKeyHex: string): string` - Backward compatible single color (returns color1)
- `colorToRGBA(colorHex: string, opacity: number): string` - Converts to RGBA for backgrounds/glows

**Example**:
```typescript
const publicKey = "0317aa2014cc6f42b31c54fa0bcd3d8904e40e5c5ea35d0ecee7c12d326d756d09";
const gradient = publicKeyToGradient(publicKey);
// Returns: { color1: "#aa8e53", color2: "#5392d4" } (deterministic)

// Backward compatible:
const color = publicKeyToColor(publicKey);
// Returns: "#aa8e53" (just color1)
```

---

## Development Guidelines

### Adding New API Routes

1. Create route in `src/app/api/[route-name]/route.ts`
2. Verify JWT token using `verifyJWT()` from `@/utils/jwt`
3. Connect to MongoDB using `connectToMongo()`
4. Validate input and convert string IDs to ObjectId
5. Return JSON responses with proper status codes
6. Handle errors with try/catch and log to console

### Adding New Loot Items

1. Add to appropriate pool in `src/lib/loot-table.ts`:
   - `COMMON_LOOT` for shared common items
   - `RARE_LOOT` for shared rare items
   - `[MONSTER]_SPECIFIC` for monster-exclusive items
2. Ensure unique `lootId`
3. Follow naming convention: `rarity_itemname` (e.g. `dragon_scale`)

### Database Queries

- Always use MongoDB's `_id` (ObjectId) for document references
- Filter user-specific queries by `userId` from JWT
- Use indexes for frequently queried fields
- Convert ObjectId to string when sending to frontend

### Frontend State Management

- Use React hooks (useState, useEffect)
- Separate concerns: UI state vs. server state
- Persist critical data to backend (don't rely on client state)
- Handle loading and error states with toast notifications

---

## Environment Setup

Required environment variables (`.env.local`):
```bash
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key-minimum-32-chars
NODE_ENV=development
```

---

## Known TODOs

### Inventory & NFT System
- [x] Create inventory page to view collected loot
- [x] Create user_inventory collection to store collected items
- [x] Refactor to user-initiated NFT minting (not automatic)
- [x] Add "Mint as NFT" button in inventory details modal
- [x] Update inventory to show unminted vs minted status
- [ ] Implement BSV wallet payment for minting
- [ ] Generate fancy NFT images for minted items
- [ ] Implement blockchain minting with BSV SDK
- [ ] Upload NFT images to IPFS or storage service

### UI & Components
- [ ] Destructure BattlePage into multiple components (loot modal, etc.)
- [ ] Add user profile page
- [ ] Add sound effects and animations
- [ ] Leaderboard for fastest defeats

### Features
- [ ] Integrate BSV wallet for authentication (currently manual login only)
- [ ] Implement trading/marketplace for loot
- [ ] Add item rarity-based pricing for minting
- [ ] Batch minting for multiple items