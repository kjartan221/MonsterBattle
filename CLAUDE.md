# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude agents

Claude agents are stored in the following directory:
C:\Users\user\.claude\agents

---

## 📚 Documentation Workflow

**IMPORTANT: Where to Create Documentation Files**

### Documentation Structure:
- **CLAUDE.md** (this file) - Project-level instructions for Claude Code
  - Location: Root directory
  - Purpose: Configuration, architecture, rules for Claude
  - Git: Tracked (committed to repository)

- **README.md** - Standard project readme
  - Location: Root directory
  - Purpose: User-facing project documentation
  - Git: Tracked (committed to repository)

- **docs/ folder** - Implementation details and system documentation
  - Location: `/docs/` directory
  - Purpose: Design documents, implementation notes, system changes
  - Git: **Ignored** (not committed to repository)
  - Examples:
    - `GAME_DESIGN_PROPOSAL.md` - Game design specifications
    - `EQUIPMENT_STATS_IMPLEMENTATION.md` - Equipment system details
    - `TIER_SCALING_IMPLEMENTATION.md` - Implementation notes
    - `REFACTORING_PLAN.md` - Code refactoring documentation

### Rule for Future Sessions:
**When creating new documentation:**
1. ✅ **System/implementation docs** → Create in `/docs/` folder
2. ✅ **Project instructions** → Update `CLAUDE.md` (root)
3. ✅ **User-facing info** → Update `README.md` (root)
4. ❌ **Never create loose .md files** in root (except CLAUDE.md and README.md)

### Benefits:
- Keeps root directory clean
- Separates public docs (tracked) from private notes (ignored)
- All implementation details stay local and private
- Easy to find related documentation in `/docs/` folder

---

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
- 🚧 Implementing Phase 2 of docs/GAME_DESIGN_PROPOSAL.md (RPG transformation)

**IMPORTANT: Phased Implementation Rule**
When implementing features from docs/GAME_DESIGN_PROPOSAL.md:
- **Only implement ONE phase item per prompt/session**
- Wait for user review and testing before proceeding
- This ensures code quality and allows for adjustments
- Reference: See Phase 1, Phase 2, Phase 3 sections in docs/GAME_DESIGN_PROPOSAL.md

---

## 🎯 Current Implementation Progress

**Last Updated**: 2025-10-30 (Phase 2.4: HP System Architecture Refactor + Boss Phase Polish)

**Reference**: docs/GAME_DESIGN_PROPOSAL.md lines 1062-1079 (Implementation Checklist)

### ✅ Recently Completed (This Session)

#### **Phase 2.4: HP System Architecture Refactor**
- **Hook Separation** (Proper separation of concerns):
  - Created `useMonsterHP` hook (src/hooks/useMonsterHP.ts) for regular monsters
    - Simple HP tracking: currentHP, maxHP, damageHP()
    - ~60 lines vs 280 lines in useBossPhases
    - No phase logic, no special attacks - just clean HP management
  - Refactored `useBossPhases` hook to ONLY handle bosses
    - Only called when `monster.isBoss && monster.bossPhases.length > 0`
    - Eliminated "No monster, resetting state" spam for regular monsters
  - MonsterBattleSection conditionally uses correct hook:
    - `const isBoss = monster?.isBoss && ...` (determined first)
    - Boss: `useBossPhases({ monster: isBoss ? monster : null })`
    - Regular: `useMonsterHP({ monster: !isBoss ? monster : null })`
    - Unified interface for both paths (currentPhaseHP, maxPhaseHP, damagePhase)
- **Bug Fixes**:
  - Fixed boss appearing defeated on spawn (checked `maxPhaseHP > 0` for initialization)
  - Fixed console log spam (only log on state transitions, not every render)
  - Fixed duplicate key warning in crit badges (use `Date.now()` instead of trigger count)
  - Fixed backend click validation for bosses with healing (exempt from strict click count)
  - Fixed frontend error handling (properly reset state on API errors)
- **Performance Improvements**:
  - Regular monsters no longer trigger boss phase logic
  - Hooks use ref-based initialization tracking (prevents rerender spam)
  - Removed debug logging from BossPhaseIndicator renders

#### **Phase 2.4: Boss Phase Visual Polish**
- **Depleting HP Bars with Color Progression** (BossPhaseIndicator.tsx):
  - Single bar that depletes, showing next phase color underneath
  - Color scheme: 4th phase → very dark gray, 3rd → purple, 2nd → orange, last → red
  - Layered rendering: Background (next phase color) + Foreground (current phase, depletes)
  - Phase counter badge positioned bottom-right outside bar (no overlap)
  - HP numbers displayed: "48 / 48 HP" (not just "HP")
  - Overheal indicator: Green text with ↑ arrow when HP > maxHP
- **Shield Buff Integration**:
  - Shield bar shows phase color underneath when depleting
  - Dynamic background color matches current phase (gray/purple/orange/red)
  - Shield remains enabled for bosses at all tiers (especially Tier 5)
  - Visual: Blue shield → depletes → reveals phase color beneath
- **Special Attack Visual Improvements** (SpecialAttackFlash.tsx):
  - Added 'heal' case to color mapping (was missing, defaulted to white)
  - Increased z-index from 50 to 999 (always on top)
  - Extended heal flash duration: 2s → 3.5s
  - Increased heal pulses: 3 → 5, slower animation (0.6s per pulse)
  - Shows healing amount: "+15 HP" in green text
  - Phase attacks now trigger visual feedback (separate state from regular attacks)

#### **Phase 2.4: System Cleanup**
- **Removed Testing Overrides**:
  - Removed Treant Guardian forced spawn in Forest biome (monster-table.ts:282-286)
  - Monsters now spawn naturally based on rarity weights
- **Code Documentation**:
  - Updated hook comments to reflect architectural separation
  - Added initialization guard explanations (maxPhaseHP > 0 checks)
  - Documented unified HP interface pattern

#### **Phase 2.2-2.3: Boss Phase System + Summon Mechanic**
- **Stacked HP Bar System** (MonsterBattleSection.tsx):
  - Refactored boss phases to use separate HP bars per phase
  - Phase HP tracking: currentPhaseHP, maxPhaseHP, phasesRemaining
  - Damage system caps at phase boundaries (ignores excess like shields)
  - Phase transitions trigger when phase HP reaches 0 (not percentage-based)
  - Badge shows "x2", "x3", etc. for multiple phases (bottom-right)
  - Last phase displays as regular HP bar (no badge for clean UI)
- **Summon Mechanic** (useSummonedCreatures.ts, SummonCard.tsx):
  - Click-to-target system for summoned creatures
  - 3-card horizontal layout: [Left Summon] [Boss] [Right Summon]
  - Summon HP calculated as % of boss max HP
  - Summon damage added to total monster attack (not reduced by armor)
  - Auto-removal of defeated summons after 500ms
- **Treant Guardian Configuration** (monster-table.ts:68-115):
  - Phase 2 triggers at 50% HP boundary
  - Heals 15 HP + Summons 2 Forest Sprites (15% boss HP each)
  - Visual: x2 badge → phase transition → heal + summons → x1 badge → regular HP bar
- **Documentation Updates**:
  - Updated BossPhase interface comments (types.ts:170-179)
  - Updated monster-table.ts with stacked HP bar system comments
  - Updated CLAUDE.md with comprehensive boss phase + summon documentation
  - Moved boss phase system from "Next Steps" to "Recently Completed"

#### **Loot System Balance Changes**
- **Spell Scroll Rarity Adjustment**
  - Removed generic "Magic Scroll" from RARE_LOOT pool
  - Changed "Minor Heal Scroll" → **legendary** (only drops from Treant Guardian boss)
  - Changed "Fireball Scroll" → **legendary** (only drops from Sand Djinn mini-boss)
  - Result: Spell scrolls now VERY rare, only from bosses

- **Inventory Item Stacking**
  - Items with same name + tier stack into single card
  - Count badge displays in bottom-right corner ("x#")
  - Details modal shows "You have # of these"
  - Visual: Tier badge (bottom-left), Count badge (bottom-right)
  - Code: InventoryPage.tsx stackItems() function

#### **Phase 2.1: Monster Buffs System** (types.ts:116-150)
- **Buff Types**: Shield (🛡️), Fast (⚡)
- **Spawn Rules** (utils/monsterBuffs.ts):
  - T1: No buffs
  - T2: 40% for 1 buff (Shield 30% HP, Fast 90s) - Weakened intro
  - T3: 60% for 1 buff, 20% for 2 buffs (Shield 50% HP, Fast 60s)
  - T4: 70% for 1 buff, 30% for 2 buffs
  - T5: 80% for 1 buff, 40% for 2 buffs
  - **Bosses**: No buffs except Tier 5
- **Shield Buff**:
  - Blue HP bar above monster HP (components/battle/BuffIndicators.tsx)
  - **-25% player damage** while shield is active
  - Shield absorbs all damage (excess ignored)
  - Visual: "-25% Damage" badge on shield bar
  - Future: Can be removed with consumables (Acid Bottle) or spells
- **Fast Buff**:
  - Yellow countdown timer above monster
  - Monster escapes if timer reaches 0
  - Escape = Battle loss (10% gold, streak reset)
  - Visual: Pulsing warning with countdown
- **Boss Exclusions**: Treant Guardian, Sand Djinn marked `isBoss: true` (no buffs except T5)

#### **Phase 2.1: Boss Special Attacks** (types.ts:127-150)
- **Special Attack System**:
  - SpecialAttackType: fireball, lightning, meteor, heal
  - SpecialAttack interface: damage, cooldown, visualEffect, message
  - BossPhase interface: For future multi-phase bosses
- **Sand Djinn Fireball** (monster-table.ts:134-141):
  - Direct damage: 15 HP
  - Cooldown: 5 seconds
  - Visual: Orange screen flash
  - Message: "🔥 The Sand Djinn hurls a blazing fireball!"
- **Implementation**:
  - useSpecialAttacks hook (hooks/useSpecialAttacks.ts)
  - SpecialAttackFlash component (visual feedback)
  - Auto-triggers based on cooldown
  - Fully extensible for multiple attacks per boss

#### **Phase 2.2: Boss Phase System with Stacked HP Bars** (types.ts:170-179)
- **Stacked HP Bar System**:
  - Boss HP divided into separate phase bars based on hpThreshold (e.g., 50% = 2 phases)
  - Each phase is a separate HP bar that depletes independently
  - Excess damage ignored at phase boundaries (like shields)
  - Phase counter badge shows phases remaining (x3 → x2 → x1 → no badge)
  - Last phase displays as regular HP bar for clean UI
- **Phase Transitions**:
  - Triggered when phase HP bar reaches 0
  - Boss becomes invulnerable during transition (2s default)
  - Executes ALL phase-specific special attacks (heal, summon, etc.)
  - Visual: Cyan border + pulsing animation + shield badge
  - Toast message displays phase transition message
- **Implementation** (MonsterBattleSection.tsx):
  - Phase HP tracking: currentPhaseHP, maxPhaseHP, currentPhaseNumber, phasesRemaining
  - handleClick: Damages phase HP, caps at 0, ignores excess
  - useEffect: Watches for phase HP = 0, triggers transition automatically
  - Phase HP calculation: Divides total HP by thresholds (100%→50%→0%)
  - Healing: Adds HP to current phase bar (can exceed maxPhaseHP)
- **Visual Components**:
  - BossPhaseIndicator: Shows current phase HP bar or stacked bars
  - Badge positioning: Bottom-right for multi-phase, hidden for last phase
  - Invulnerability effects: Cyan HP bar + shield badge at top-center
- **Treant Guardian Example** (monster-table.ts:68-115):
  - 2-phase boss (100 total HP at T1, 96 HP at T2)
  - Phase 1: 50% HP bar (48 HP at T2)
  - Phase 1 depletes → Invulnerable → Heal 15 HP → Summon 2 sprites
  - Phase 2: 50% HP bar + heal = 63 HP at T2
  - Badge shows x2 → x1 (then removed for clean final phase)

#### **Phase 2.3: Summon Mechanic** (types.ts:138-167)
- **Summon System**:
  - Bosses can summon creatures during phase transitions
  - summons.count: Number to spawn (typically 1-2)
  - summons.creature: SummonDefinition (name, hpPercent, attackDamage, icon)
  - Spawns on left and right sides of boss card
  - Each summon is a clickable target (click-to-attack)
- **Summon Stats**:
  - HP: Calculated as % of boss max HP (e.g., 15% = 14 HP for 96 HP boss)
  - Attack: Added to total monster damage (not reduced by armor)
  - Position: 'left' or 'right' for visual layout
- **UI Layout**:
  - 3-card horizontal layout: [Left Summon] [Boss] [Right Summon]
  - SummonCard: 140x140 purple-themed card (smaller than boss 288x288)
  - Placeholder divs maintain alignment when no summons
  - Defeated summons show grayed-out with "DEFEATED!" text
- **Implementation**:
  - useSummonedCreatures hook: addSummons, damageSummon, getTotalSummonDamage
  - SummonCard component: Click handler, HP bar, attack stat display
  - handleSummonClick: Applies player damage to specific summon
  - handleSpecialAttack: Detects 'summon' type, calls addSummons()
  - Auto-removal: Defeated summons removed after 500ms for visual feedback
- **Treant Guardian Summons**:
  - Summons 2 Forest Sprites on Phase 2 transition
  - Each sprite: 15% boss HP (~14 HP at T2), 2 HP/sec attack
  - Total: 4 HP/sec additional damage from summons

### ✅ Previously Completed
- **Phase 2.1: Debuff/DoT System** (docs/DEBUFF_SYSTEM_IMPLEMENTATION.md)
  - Backend: Debuff types and interfaces (types.ts:117-141)
    - DebuffType: poison, burn, bleed, slow, stun, freeze
    - DamageType: flat or percentage-based
    - DebuffEffect and ActiveDebuff interfaces
  - Backend: DoT effects on monsters (monster-table.ts)
    - Added dotEffect field to MonsterTemplate interface
    - Sand Scorpion: 2% poison, 5s duration, 50% chance
    - Fire Elemental: 3% burn, 4s duration, 75% chance
    - Wild Boar: 1.5% bleed, 6s duration, 30% chance
  - Backend: start-battle API passes dotEffect to frontend
  - Frontend: useDebuffs hook (hooks/useDebuffs.ts - 172 lines)
    - Percentage-based damage calculation (scales with target max HP)
    - Apply chance rolling (RNG-based debuff application)
    - Individual tick intervals for each debuff type
    - Bidirectional support (works for player and monster debuffs)
    - Methods: applyDebuff(), clearDebuffs(), removeDebuff(), hasDebuff()
  - Frontend: DebuffIndicators component (components/battle/DebuffIndicators.tsx - 120 lines)
    - Color-coded icons with borders (poison green, burn orange, etc.)
    - Real-time countdown timers
    - Pulse animations during active ticks
    - Hover tooltips with damage info
  - Frontend: useMonsterAttack integration
    - Accepts applyDebuff callback prop
    - Applies debuffs on monster hit with chance rolling
    - Console logs for debugging
  - Frontend: MonsterBattleSection integration
    - useDebuffs hook initialized with player maxHP and takeDamage
    - activeDebuffs passed to PlayerStatsDisplay
    - clearDebuffs() called on death, victory, and new monster
    - PlayerStatsDisplay moved into MonsterBattleSection for direct access to debuff state
  - Documentation: Complete system documentation (docs/DEBUFF_SYSTEM_IMPLEMENTATION.md - 493 lines)

- **Phase 1.2: Monster Attack Loop** (docs/GAME_DESIGN_PROPOSAL.md:1076-1082)
  - Backend: Monster attack damage defined in monster-table.ts (2-12 DPS)
  - Frontend: setInterval loop to damage player every second (BattlePage.tsx:63-79)
  - Frontend: Visual feedback for monster attacks (BattlePage.tsx:423, 426)
    - Red pulse border and shadow on attack
    - Monster sprite scales up during attack
  - Frontend: Battle start screen (BattleStartScreen.tsx)
    - Prevents immediate damage on /battle navigation
    - Shows monster preview with "Start Battle" button
    - Attack loop only starts after user confirmation
    - Only displays on initial load or after death (not during Next Monster flow)
    - Maintains battle engagement during consecutive victories
  - Frontend: Battle defeat screen (BattleDefeatScreen.tsx)
    - Shows after player HP reaches 0
    - Displays monster that defeated player
    - Shows gold lost (10% of current gold, rounded) - TODO: make dynamic per biome+tier
    - Shows win streak lost
    - "Try Again" button restarts battle
    - Gold loss mechanism (BattlePage.tsx:108-120)

- **Phase 1.3: Biome & Tier System** (docs/GAME_DESIGN_PROPOSAL.md:959-965)
  - Backend: Biome configuration system (biome-config.ts)
    - BiomeId type: 'forest' | 'desert' | 'ocean' | 'volcano' | 'castle'
    - Tier type: 1-5 with multipliers (1x, 2x, 4x, 8x, 15x)
    - BIOMES config with maxTier and monster lists
    - Helper functions: getNextUnlock(), applyTierScaling(), formatBiomeTierKey()
  - Backend: Monster organization by biome (monster-table.ts)
    - MonsterTemplate with biomes array and base stats
    - Tier scaling for clicksRequired and attackDamage
    - getRandomMonsterTemplateForBiome() function
  - Backend: Updated types.ts with biome/tier fields (Monster, BattleSession)
  - Backend: start-battle API validates unlocked zones and creates monsters with tier scaling
  - Backend: attack-monster API unlocks next biome/tier in circular progression
  - Frontend: BiomeContext with localStorage persistence (BiomeContext.tsx)
  - Frontend: BiomeMapWidget component (BiomeMapWidget.tsx)
    - Collapsed/expanded views with current biome display
    - Visual indicators: current (blue), unlocked (green), locked (gray)
    - Click to select unlocked biome/tiers
    - Mobile responsive design (320px width, adjustable on small screens)
  - Frontend: Integration with BattlePage using useBiome() hook
  - Frontend: PlayerStatsDisplay mobile responsive updates (320px width match)

- **Phase 1.4: Equipment System** (docs/GAME_DESIGN_PROPOSAL.md:967-971)
  - Backend: Equipment slot fields in PlayerStats (types.ts:64-68)
    - equippedWeapon, equippedArmor, equippedAccessory1, equippedAccessory2
    - Store ObjectId references to UserInventory items
  - Backend: EquipmentStats interface in loot-table.ts
    - damageBonus, critChance, hpReduction, maxHpBonus, attackSpeed, coinBonus
    - Added equipmentStats to 20+ equippable items across all rarities
  - Backend: API routes for equipment management
    - GET /api/equipment/get - Fetch equipped items
    - POST /api/equipment/equip - Equip item to slot with validation
    - POST /api/equipment/unequip - Unequip item from slot
  - Frontend: EquipmentContext with React Context (EquipmentContext.tsx)
    - Global state for equipped items
    - equipItem(), unequipItem(), refreshEquipment() functions
    - Optimistic UI updates with server confirmation
  - Frontend: EquipmentWidget component (EquipmentWidget.tsx)
    - Positioned left middle, under BiomeMapWidget (top: 380px)
    - Shows 4 equipment slots with icons and names
    - Click to open selection modal
    - Rarity-colored borders for equipped items
    - Mobile responsive (320px width)
  - Frontend: EquipmentSelectionModal component (EquipmentSelectionModal.tsx)
    - Filters inventory items by slot type (weapon/armor/artifact)
    - Shows currently equipped item with Unequip button
    - Grid display of available items with equipment stats
    - User-specific gradient borders on item cards
    - Equip/unequip functionality with toast notifications
  - Frontend: Integration with BattlePage
    - Added EquipmentProvider to layout.tsx
    - Equipment widget disabled during battle submission

- **Performance Optimizations**
  - Extracted MonsterBattleSection component (MonsterBattleSection.tsx)
    - Moved all battle logic from BattlePage to separate component
    - Only monster section re-renders on new battle, not entire page
    - BattlePage refactored to layout-only component
  - Non-blocking API calls for non-critical operations
    - start-battle-timer API call fires in background
    - resetHealth() and fetchPlayerStats() in background on Next Monster
    - Equipment refresh remains blocking (affects battle stats)
  - Toast notification cleanup
    - Removed redundant "Battle started!" toast
    - Removed redundant "Victory!" toast (green UI is clear)
    - Removed redundant "You claimed [item]!" toast
    - Removed redundant "Summoning new monster..." toast
    - Kept informational "Resuming battle" toast
    - Kept all error toasts for critical feedback
    - Reduced loot modal delay from 1500ms to 500ms

- **Phase 1.5: Player Progression** (docs/GAME_DESIGN_PROPOSAL.md:973-977)
  - Backend: XP and reward utilities (playerProgression.ts)
    - getXPForLevel() - Calculate XP requirement (100 * 1.5^(level-1))
    - getMonsterRewards() - XP/coins by rarity (Common: 10XP/5g, Legendary: 80XP/50g)
    - checkLevelUp() - Detect level-ups and calculate stat increases
    - getBaseDamageForLevel() - Base damage scaling (1 + level/5)
    - getMaxHealthForLevel() - Max HP scaling (100 + (level-1)*5)
    - getBaseCritChance() - Returns 5% base crit
  - Backend: attack-monster API rewards (attack-monster/route.ts)
    - Award XP and coins based on monster rarity
    - Check for level-ups automatically
    - Update player stats: level, experience, coins, maxHealth, baseDamage
    - Full HP restore on level-up
    - Return rewards and levelUp info in response
  - Frontend: Total stats display (PlayerStatsDisplay.tsx)
    - Added XP progress bar (blue gradient)
    - Shows total damage (base + equipment) with breakdown
    - Shows total crit chance (5% base + equipment) with breakdown
    - Base damage: 1 at level 1, +1 every 5 levels
    - Base crit: Always 5%
    - Equipment bonuses shown in parentheses
  - Frontend: Level-up notifications (MonsterBattleSection.tsx)
    - Toast notification on level-up (5s duration)
    - Shows level progression and stat increases
    - Auto-refresh player stats after battle completion

### 📋 Next Steps (To Implement)

**Priority 1: More Boss Special Attacks**
- **Lightning Attack** ⚡ (Blue visual effect)
  - Damage: 10-15 HP
  - Cooldown: 8 seconds
  - Visual: Blue screen flash
  - Can be added to existing boss special attack system
- **Meteor Strike** ☄️ (Red visual effect)
  - Damage: 20 HP
  - Cooldown: 15 seconds
  - Visual: Red screen flash with falling meteor icon
  - High-damage, long-cooldown attack for harder bosses
- **Repeating Special Attacks** (outside phase transitions)
  - Add cooldown-based attacks during normal combat (not just phase transitions)
  - Example: Sand Djinn fireball every 5 seconds throughout battle
  - Requires separate useEffect timer system

**Priority 2: Shield-Breaking Consumables/Spells**
- **Acid Bottle** (Consumable)
  - Instantly removes monster shield
  - Single-use item
  - Craftable or rare drop
- **Shield Break Spell** (Legendary scroll drop)
  - 45-second cooldown
  - Removes shield instantly
  - Visual: Purple shatter effect
- **Integration**: Add shield removal to battle UI
  - Quick-use bar for consumables
  - Spell hotkey system

**Priority 3: More Monster Buffs**
- **Regeneration** 💚
  - Boss heals 5-10% HP every 10 seconds
  - Visual: Green pulse effect
  - Can stack with other buffs
- **Enraged** 😡
  - +50% attack damage
  - Visual: Red aura around monster
  - Triggered at low HP (< 30%)

**Priority 4: Phase 1.6 - Core Items (Tier 1-3)** (docs/GAME_DESIGN_PROPOSAL.md lines 979-983)
- Tiered weapons: Wooden Sword, Iron Sword, Steel Sword
- Tiered armor: Leather Armor, Chainmail
- Accessories: Lucky Coin, Ring of Haste
- Item tier scaling: Multiply stats by tier

### 📝 Instructions for Claude
**IMPORTANT**: After completing each implementation session:
1. Update the "Recently Completed" section with what was implemented
2. Move the completed item from "Next Steps" to "Recently Completed"
3. Update the "Last Updated" field
4. Keep only the most recent 2-3 completed items in "Recently Completed"
5. Always reference docs/GAME_DESIGN_PROPOSAL.md line numbers for traceability

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
  - `app/`: App Router
    - `api/`: API routes
    - `layout.tsx`: Root layout with Geist font configuration and PlayerProvider
    - `page.tsx`: Homepage component
    - `globals.css`: Global styles and TailwindCSS imports
  - `components/`: Page and UI components
    - `battle/`: Battle-specific components (modals, displays, etc.)
  - `contexts/`: React Context providers for global state
  - `lib/`: MongoDB connection and utilities
  - `hooks/`: Custom React hooks
  - `utils/`: Utility functions
- `public/`: Static assets

### State Management Architecture

**Global State with React Context**

The application uses React Context for managing global player state to:
- **Prevent refetching** on page navigation
- **Share state** across components
- **Centralize player operations** (HP changes, coin updates, etc.)
- **Simplify component logic** by extracting state management

**Key Files**:
- `src/contexts/PlayerContext.tsx` - Player stats context provider
  - Exports `PlayerProvider` (wrap around app in layout.tsx)
  - Exports `usePlayer()` hook for consuming player data
  - Provides helper methods: `resetHealth()`, `takeDamage()`, `healHealth()`, `addCoins()`, `addExperience()`
- `src/app/layout.tsx` - Wraps entire app with `<PlayerProvider>`

**Component Structure Best Practices**

To keep components manageable and maintainable:

1. **Extract UI into specialized components** when files exceed ~300-400 lines
2. **Create domain-specific folders** under `components/` (e.g., `battle/`, `inventory/`)
3. **Use React Context for cross-cutting concerns** (player stats, auth, etc.)
4. **Keep page components lean** - they should primarily orchestrate child components

**Example: BattlePage Refactoring**

The `BattlePage` component was refactored to use:
- `PlayerStatsDisplay` component for HP/level display
- `LootSelectionModal` component for loot selection UI
- `CheatDetectionModal` component for cheat warnings
- `usePlayer()` hook from PlayerContext for player stats

This pattern should be followed for future complex components.

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
  name: string,          // e.g. "Forest Wolf", "Sand Djinn"
  imageUrl: string,      // Emoji icon (e.g. "🐺", "🧞")
  clicksRequired: number,
  attackDamage: number,
  rarity: 'common' | 'rare' | 'epic' | 'legendary',
  biome: 'forest' | 'desert' | 'ocean' | 'volcano' | 'castle',
  tier: 1 | 2 | 3 | 4 | 5,
  isBoss: boolean,       // True for boss monsters
  buffs: MonsterBuff[], // Shield/Fast buffs (optional)
  specialAttacks: SpecialAttack[], // Boss special attacks (optional)
  dotEffect: DebuffEffect, // Poison/Burn/Bleed effects (optional)
  createdAt: Date
}
```
**Indexes**: `rarity`, `biome`, `tier`, `createdAt`

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

**Flow**: Start → Attack → Victory/Death → Select Loot (if victory) → Next Monster

#### 1. Start Battle (`POST /api/start-battle`)
- Checks for existing active session with `isDefeated: false` and no `completedAt`
- If active session found: resumes with existing monster
- If no active session: creates new monster from selected biome/tier with random stats based on rarity
- Creates new battle session
- Returns: `{ session, monster, isNewSession }`

**Monster Generation**:
- Monsters are biome-specific (Forest, Desert, Ocean, Volcano, Castle)
- Rarity distribution: Common (60%), Rare (25%), Epic (12%), Legendary (3%)
- Stats scale with tier multiplier (1x, 2x, 4x, 8x, 15x)
- Bosses marked with `isBoss: true` for special mechanics

#### 2. Click Tracking (`POST /api/update-clicks`)
- **Auto-saves every 5 clicks** from frontend
- **Auto-saves every 10 seconds** if unsaved clicks exist
- Only updates if new count > saved count
- Enables session resumption after refresh

#### 3. Battle Completion (`POST /api/attack-monster`)
- **Server-side time calculation**: `Date.now() - session.startedAt`
- **Anti-cheat systems**:
  1. **Click Rate Detection**: Detects rates > 15 clicks/second
     - Punishment: Doubles monster HP, shows warning modal
     - Player can retry same battle
  2. **HP Verification**: Calculates if player should have survived monster damage
     - Formula: `expectedHP = maxHP - (timeInSeconds × attackDamage) + healing`
     - If expectedHP <= 0: Player should have died
     - Punishment: End session, apply death penalties (10% gold loss, streak reset)
     - Shows defeat screen, player must start new battle
- **Loot generation**: 5 random items based on monster type
- **Saves loot options** to session for persistence
- Returns: `{ success, monster, session, lootOptions, stats }` or `{ hpCheatDetected, goldLost, streakLost }` or `{ cheatingDetected, newClicksRequired }`

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

#### 5. Player Death (`POST /api/end-battle`)
**Flow when player HP reaches 0**:
1. Frontend detects `playerStats.currentHealth <= 0`
2. `handlePlayerDeath()` executes:
   - Calculates gold loss (10% of total, TODO: make biome/tier specific)
   - Deducts gold from player stats
   - Resets win streak to 0
   - Calls `/api/end-battle` to mark session as defeated
3. API marks session as `isDefeated: true` with `completedAt` timestamp
4. **No loot is awarded** (no `lootOptions` or `selectedLootId`)
5. Shows defeat screen with penalties
6. When player clicks "Try Again":
   - Restores HP to full
   - Calls `startBattle()` which creates a NEW session (old one is marked defeated)
   - Shows battle start screen with new monster

**Why this matters**:
- Without marking the session as defeated, `/api/start-battle` would resume the old session
- Player would be stuck fighting the same monster in an endless loop
- This ensures clean separation between battle attempts

#### 6. Mint NFT (`POST /api/mint-nft`)
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
1. **COMMON_LOOT**: Shared by all monsters, common rarity items
2. **RARE_LOOT**: Shared by all monsters, rare rarity items
3. **Monster-Specific Loot**: Unique items per monster (varies by biome)
   - Each monster has 3-10 unique drops including materials, equipment, and consumables
   - Boss monsters drop legendary spell scrolls
   - Loot tables organized by biome (forest, desert, ocean, volcano, castle)

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
  - Punishment: Doubles monster HP, shows warning modal
  - Player retries same battle with harder monster
- **HP verification**: Calculates if player should have survived
  - Formula: `expectedHP = maxHP - (time × attackDamage) + healing`
  - Detects if player defeated monster despite having HP <= 0
  - Punishment: End session, apply death penalties (10% gold loss, streak reset)
  - Player must start new battle (prevents stuck state)
- **Client can't manipulate**: All calculations done server-side with database timestamps

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
- `POST /api/end-battle` - End battle session when player dies (marks session as defeated with no loot)

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