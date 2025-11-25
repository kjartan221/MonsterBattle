# Badge Components

Reusable badge components for consistent UI across the application.

## Available Badges

### 1. **EmpoweredBadge** (`EmpoweredBadge.tsx`)
Shows +20% bonus for items from corrupted monsters.

```tsx
import EmpoweredBadge from '@/components/badges/EmpoweredBadge';

<EmpoweredBadge
  size="medium"        // 'small' | 'medium' | 'large'
  position="top-right" // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline'
/>
```

**Styling**: Purple gradient with lightning bolt icon (⚡ +20%)
**Standard position**: top-right (loot cards) or top-left (crafted items)

---

### 2. **TierBadge** (`TierBadge.tsx`)
Shows item tier as Roman numerals (I-V).

```tsx
import TierBadge from '@/components/badges/TierBadge';

<TierBadge
  tier={3}             // 1-5
  position="bottom-left"
/>
```

**Styling**: Black background with white text and border
**Standard position**: bottom-left corner

---

### 3. **CountBadge** (`CountBadge.tsx`)
Shows item stack count (e.g., "x3").

```tsx
import CountBadge from '@/components/badges/CountBadge';

<CountBadge
  count={5}            // Only renders if count > 1
  position="bottom-right"
/>
```

**Styling**: Dark gray with white border and text
**Standard position**: bottom-right corner

---

### 4. **MintingStatusBadge** (`MintingStatusBadge.tsx`)
Shows NFT minting status.

```tsx
import MintingStatusBadge from '@/components/badges/MintingStatusBadge';

<MintingStatusBadge
  status="minting"     // 'not-minted' | 'minting' | 'minted'
  position="top-right"
/>
```

**Styling**:
- `not-minted`: Gray badge
- `minting`: Yellow pulsing badge
- `minted`: Hidden (returns null)

**Standard position**: top-right corner

---

### 5. **StatRangeIndicator** (`../crafting/StatRangeIndicator.tsx`)
Shows crafted item stat roll quality (-20% to +20%).

```tsx
import StatRangeIndicator from '@/components/crafting/StatRangeIndicator';

<StatRangeIndicator statRoll={1.15} /> // 0.8 to 1.2
```

**Styling**: Color-coded by quality tier (Masterwork, Superior, Standard, Inferior, Poor)
**Position**: Inline only (centered below item in inventory)

---

## Badge Positioning Guide

### Typical Item Card Layout:
```
┌─────────────────────────┐
│ [Empowered]  [Minting]  │ ← top-left / top-right
│                         │
│       [ITEM ICON]       │
│                         │
│ [Tier]          [Count] │ ← bottom-left / bottom-right
└─────────────────────────┘
```

### Example Usage:
```tsx
<div className="relative">
  {/* Item content */}
  <div className="item-card">...</div>

  {/* Badges (absolute positioning) */}
  {item.isEmpowered && <EmpoweredBadge size="small" position="top-left" />}
  <TierBadge tier={item.tier} position="bottom-left" />
  <CountBadge count={item.count} position="bottom-right" />
  <MintingStatusBadge status="not-minted" position="top-right" />
</div>
```

---

## Badge Standard Sizes

- **small**: For item thumbnails/cards (inventory, loot selection)
- **medium**: Standard size (default)
- **large**: For modals and detail views

## Badge z-index Hierarchy

All badges use `z-20` for absolute positioning to ensure they appear above item content but below modals.

---

## Migration Notes

### Before (Hardcoded):
```tsx
<div className="absolute top-2 right-2 bg-purple-600/90 text-purple-100 px-2 py-1 rounded text-xs font-bold border border-purple-400 z-20">
  ⚡ +20%
</div>
```

### After (Component):
```tsx
<EmpoweredBadge size="small" position="top-right" />
```

**Benefits**:
- Consistent styling across app
- Easy to update (change once, applies everywhere)
- Responsive sizing built-in
- Clear semantic meaning
