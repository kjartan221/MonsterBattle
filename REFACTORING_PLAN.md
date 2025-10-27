# BattlePage Refactoring Plan
## Component & Hook Extraction to Prevent State Coupling Issues

**Problem**: BattlePage has 15+ state variables and 4 useEffects. When any state updates (like `playerStats.currentHealth` every second), it can trigger unnecessary re-renders and cause infinite loop risks.

**Solution**: Extract logic into custom hooks and UI into smaller components to isolate state updates.

---

## 🎯 Recommended Extractions

### 1. **Custom Hook: `useMonsterAttack`**
**Purpose**: Handle monster attack interval and visual feedback
**Location**: `src/hooks/useMonsterAttack.ts`

**Current State (BattlePage.tsx:68-91)**:
```typescript
const [monsterAttacking, setMonsterAttacking] = useState(false);

useEffect(() => {
  // Monster attack loop logic
}, [monster, session, playerStats, isSubmitting, takeDamage, battleStarted]);
```

**After Extraction**:
```typescript
// In BattlePage:
const { isAttacking } = useMonsterAttack({
  monster,
  session,
  battleStarted,
  isSubmitting,
  takeDamage
});

// In MonsterCard component:
<MonsterCard isAttacking={isAttacking} />
```

**Benefits**:
- ✅ `monsterAttacking` state isolated to the hook
- ✅ Attack interval cleanup automatic
- ✅ No re-renders of BattlePage when attack animation toggles

---

### 2. **Custom Hook: `useClickPersistence`**
**Purpose**: Auto-save clicks to backend periodically
**Location**: `src/hooks/useClickPersistence.ts`

**Current State (BattlePage.tsx:47-66)**:
```typescript
const [lastSavedClicks, setLastSavedClicks] = useState(0);

useEffect(() => {
  // Periodic save logic
}, [clicks, lastSavedClicks, session, monster, isSubmitting]);
```

**After Extraction**:
```typescript
// In BattlePage:
useClickPersistence({
  sessionId: session?._id,
  clicks,
  isSubmitting,
  monster
});
```

**Benefits**:
- ✅ `lastSavedClicks` state hidden inside hook
- ✅ Automatic save every 5 clicks or 10 seconds
- ✅ No BattlePage re-render when `lastSavedClicks` updates

---

### 3. **Custom Hook: `useDeathMechanic`**
**Purpose**: Handle death detection, gold loss, and defeat screen
**Location**: `src/hooks/useDeathMechanic.ts`

**Current State (BattlePage.tsx:93-139)**:
```typescript
const [defeatScreen, setDefeatScreen] = useState({...});

useEffect(() => {
  if (playerStats.currentHealth <= 0) {
    handlePlayerDeath();
  }
}, [playerStats?.currentHealth, session]);
```

**After Extraction**:
```typescript
// In BattlePage:
const { defeatScreenData, handleDefeatContinue } = useDeathMechanic({
  playerStats,
  session,
  monster,
  onDeath: () => {
    resetStreak();
    setBattleStarted(false);
    updatePlayerStats({ coins: ... });
  }
});
```

**Benefits**:
- ✅ `defeatScreen` state isolated to hook
- ✅ Gold loss calculation encapsulated
- ✅ Death detection doesn't cause full page re-render

---

### 4. **Component: `MonsterCard`**
**Purpose**: Display monster sprite, handle clicks, show attack animations
**Location**: `src/components/battle/MonsterCard.tsx`

**Current State (BattlePage.tsx:415-436)**:
```typescript
// Embedded in BattlePage return statement
<button onClick={handleClick}>
  <div className={monsterAttacking ? 'animate-pulse' : ''}>
    {monster.imageUrl}
  </div>
</button>
```

**After Extraction**:
```typescript
// In BattlePage:
<MonsterCard
  monster={monster}
  isAttacking={isAttacking}
  isDefeated={session?.isDefeated}
  onAttack={handleClick}
/>
```

**Benefits**:
- ✅ Click handling isolated
- ✅ Animation state doesn't affect parent
- ✅ Reusable for different monster types

---

### 5. **Component: `BattleProgress`**
**Purpose**: Show click counter and progress bar
**Location**: `src/components/battle/BattleProgress.tsx`

**Current State (BattlePage.tsx:437-455)**:
```typescript
// Embedded progress bar and health display
const progress = (clicks / monster.clicksRequired) * 100;
<div style={{ width: `${progress}%` }} />
```

**After Extraction**:
```typescript
// In BattlePage:
<BattleProgress
  currentClicks={clicks}
  requiredClicks={monster.clicksRequired}
/>
```

**Benefits**:
- ✅ Progress calculation isolated
- ✅ No re-calculation on every parent render
- ✅ Can memo this component easily

---

### 6. **Custom Hook: `useBattleSession`**
**Purpose**: Manage battle initialization, session loading, monster fetching
**Location**: `src/hooks/useBattleSession.ts`

**Current State (BattlePage.tsx:160-250)**:
```typescript
const [session, setSession] = useState(null);
const [monster, setMonster] = useState(null);
const [loading, setLoading] = useState(true);

const startBattle = async () => {
  // Fetch monster and session
};
```

**After Extraction**:
```typescript
// In BattlePage:
const { session, monster, loading, startNewBattle } = useBattleSession({
  autoStart: !battleStarted
});
```

**Benefits**:
- ✅ Session/monster state encapsulated
- ✅ Loading state automatic
- ✅ Retry logic built-in

---

## 📊 Before vs After Architecture

### **Before (Current)**:
```
BattlePage (580 lines)
├─ 15+ useState declarations
├─ 4 useEffects (tightly coupled)
├─ 10+ handler functions
└─ Inline JSX with embedded logic
```
**Problems**:
- ❌ Any state update can trigger useEffect chains
- ❌ Hard to track which state affects what
- ❌ Difficult to test individual features
- ❌ High risk of infinite loops

### **After (Proposed)**:
```
BattlePage (200 lines - orchestration only)
├─ useMonsterAttack() → returns { isAttacking }
├─ useClickPersistence() → side effect only
├─ useDeathMechanic() → returns { defeatData, onContinue }
├─ useBattleSession() → returns { session, monster, loading }
├─ <MonsterCard /> → self-contained
├─ <BattleProgress /> → self-contained
└─ Minimal orchestration state
```
**Benefits**:
- ✅ State updates isolated to responsible hooks/components
- ✅ Each hook has clear dependencies
- ✅ Easy to test individual features
- ✅ Minimal risk of cross-contamination

---

## 🚀 Implementation Priority

**Phase 1** (High Impact) - ✅ COMPLETED:
1. ✅ Extract `useMonsterAttack` (fixes attack animation re-renders) - `src/hooks/useMonsterAttack.ts`
2. ✅ Extract `MonsterCard` component (isolates click state) - `src/components/battle/MonsterCard.tsx`

**Phase 2** (Medium Impact):
3. Extract `useClickPersistence` (cleanup periodic save logic)
4. Extract `useDeathMechanic` (isolate death detection)

**Phase 3** (Nice to Have):
5. Extract `BattleProgress` component
6. Extract `useBattleSession` hook

---

## ✅ Completed Refactoring

### Phase 1 Results:
- **BattlePage.tsx reduced** from 580 lines to ~550 lines
- **State isolated**: `monsterAttacking` now `isAttacking` inside `useMonsterAttack` hook
- **Re-render prevention**: Attack animation toggles no longer trigger BattlePage re-renders
- **Cleaner code**: Monster rendering logic encapsulated in `MonsterCard` component
- **Build status**: ✅ Compiles successfully with no TypeScript errors

### Bug Fixes Applied (Post-Refactoring):
1. **Fixed loot modal not appearing**: Changed to use `data.session` from API response instead of patching old session state
2. **Fixed monster continuing to attack**: Added missing `playerStats` prop to `useMonsterAttack` hook
3. **Fixed start battle button**: Updated `handleDefeatContinue` to call `startBattle()` instead of just routing
4. **Fixed TypeScript types**: Added missing `usedItems` field to `BattleSessionFrontend` interface
5. **Fixed player death session cleanup**: Created `/api/end-battle` route to mark session as defeated when player dies (prevents endless loop with same monster)
6. **Fixed HP cheat detection**: HP verification now properly ends session, applies death penalties (gold loss, streak reset), and shows defeat screen instead of leaving player in broken state
7. **Cleaned up duplicate data**: Removed redundant `lootOptions` and `usedItems` from API response session object (debugging artifacts)

---

## 🎯 Key Principles

1. **State Colocation**: Keep state close to where it's used
2. **Single Responsibility**: Each hook/component does one thing
3. **Clear Dependencies**: useEffect deps should be minimal and obvious
4. **Memoization Opportunities**: Smaller components are easier to memo
5. **Testing**: Hooks and components can be unit tested separately

---

## 📝 Next Steps

1. Test battle flow in development to verify Phase 1 refactoring
2. Decide whether to proceed with Phase 2 (medium impact extractions)
3. Monitor for any state coupling issues during gameplay

**Note**: This is a gradual refactor. We can do one extraction at a time and test before moving to the next.
