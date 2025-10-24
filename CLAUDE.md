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
- ⏳ NFT minting to inventory
- ⏳ Inventory page to view collected NFTs

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
  userId: string,        // Unique external identifier
  username: string,
  createdAt: Date,
  updatedAt: Date
}
```
**Indexes**: `userId` (unique), `username`

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
- Returns: `{ success, selectedLootId }`

---

### Loot System

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
- **Next Monster button**: Fixed right side after loot selection
- **Cheat detection modal**: Warning for suspicious click rates

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
- `POST /api/select-loot` - Save user's loot selection

**All routes require authentication** via JWT cookie (except `/api/login`)

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

- [ ] Destructure BattlePage into multiple components (loot modal, etc.)
- [ ] Implement NFT minting to blockchain
- [ ] Create inventory page to view collected loot
- [ ] Integrate BSV wallet for authentication
- [ ] Add user profile page
- [ ] Implement trading/marketplace for loot
- [ ] Add sound effects and animations
- [ ] Leaderboard for fastest defeats