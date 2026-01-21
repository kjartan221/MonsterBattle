# Transaction Flow Pattern: createAction → signAction

This document explains the standardized transaction flow pattern used throughout this application for creating and signing BSV blockchain transactions using brc-100 wallets.

---

## Overview

All blockchain operations in this application follow a **consistent 3-step pattern** for transaction creation and signing:

1. **createAction** - Prepare transaction structure with estimated unlocking script lengths
2. **Sign** - Generate actual unlocking scripts using SDK's signing mechanism
3. **signAction** - Finalize transaction with actual unlocking scripts

This pattern is used across **all backend routes** that interact with the blockchain, ensuring consistency, reliability, and on-chain credibility for every game item and operation.

---

## Why BSV Blockchain?

This application is built on the **Bitcoin SV (BSV) blockchain** for several critical advantages that make it uniquely suited for gaming applications:

### ⚡ Low Transaction Fees

**~$0.0001 per transaction** (fraction of a cent) enables:
- **Micro-transactions**: Mint and manage large numbers of items affordably
- **Frequent operations**: Players can craft, trade, and update without cost friction
- **Sustainable economics**: Game economies remain viable at scale
- **No layer-2 complexity**: Everything happens on layer 1 (base blockchain)

**Cost Comparison:**
```
BSV:      $0.0001-0.001 per tx    ✅ Consistently low, predictable
Ethereum: $0.50-50+ per tx        ❌ Highly variable during congestion
Bitcoin:  $0.50-20+ per tx        ❌ Variable due to block space competition
```

**Why This Matters:**
- BSV fees are **predictable** - you can budget for game operations
- Other chains have potential **unpredictable spikes** - a $0.50 tx can become tens of dollars during congestion
- For a game with frequent crafting/trading, **consistent low fees** are critical

### 🚀 Real-Time Transaction Experience

BSV supports instant transaction acceptance (zero-confirmation), which enables:

- Responsive gameplay: Crafting and item actions feel immediate
- Smooth UX: Players don’t wait minutes for basic actions
- High activity environments: Supports many concurrent player transactions

**Final settlement occurs in standard Bitcoin-style blocks (~10 minutes), while gameplay interactions can proceed immediately upon transaction broadcast.**

### 📦 Scalable On-Chain Data

BSV removes small fixed block-size limits found on other chains, enabling:

- Rich on-chain metadata: Item stats, descriptions, and game state
- Complex transactions: Multi-input crafting and composable items
- Long-term scalability: Capacity grows with usage rather than being capped
- Fully on-chain architecture: Reduced reliance on external storage systems

**Practical Benefits:**
```typescript
// You can store extensive game data directly on-chain:
const itemMetadata = {
  name: 'game_item',
  itemName: 'Legendary Dragon Sword',
  description: 'A blade forged from dragon fire and ancient steel...',
  icon: '⚔️',
  rarity: 'legendary',
  itemType: 'weapon',
  tier: 5,
  stats: {
    damageBonus: 25,
    critChance: 40,
    attackSpeed: 15,
    lifesteal: 8
  },
  enhancements: {
    prefix: { name: 'Vampiric', stats: { lifesteal: 3 } },
    suffix: { name: 'of Haste', stats: { attackSpeed: 5 } }
  },
  visual: {
    borderGradient: { color1: '#ff0000', color2: '#8b0000' }
  },
  lore: 'Crafted by the legendary blacksmith Thorin...',
  craftingProof: {
    recipeId: 'legendary_weapon_tier5',
    materialTokens: ['txid1.0', 'txid2.0', 'txid3.0'],
    craftedAt: '2026-01-21T12:00:00Z'
  }
};
// All of this fits in a single transaction!
```

### 🎮 Perfect for Gaming

BSV's combination of **low fees + fast confirmations + large blocks** creates the ideal environment for blockchain gaming:

✅ **Affordable**: Players can mint/craft/trade without worrying about costs
✅ **Responsive**: Transactions confirm in seconds, not minutes
✅ **Scalable**: System can handle millions of items and players
✅ **Self-contained**: All data lives on-chain, no external dependencies
✅ **Verifiable**: Every item has full on-chain provenance

---

## The 3-Step Pattern

### Step 1: createAction (Prepare Transaction)

The first step uses `serverWallet.createAction()` to prepare the transaction structure. This requires **estimated unlocking script lengths** for all inputs.

```typescript
// Estimate unlocking script length first
const unlockTemplate = ordinalP2PKH.unlock(serverWallet, "all", false);
const unlockingScriptLength = await unlockTemplate.estimateLength();

// Prepare transaction
const actionRes = await serverWallet.createAction({
  description: "Minting new item",
  inputBEEF: paymentTx,  // Source transaction BEEF
  inputs: [
    {
      inputDescription: "User payment for fees",
      outpoint: "txid.0",
      unlockingScriptLength: unlockingScriptLength,  // Estimate only
    }
  ],
  outputs: [
    {
      outputDescription: "New item NFT",
      lockingScript: lockingScript.toHex(),
      satoshis: 1,
    }
  ],
  options: {
    randomizeOutputs: false,  // Keep deterministic output ordering
  }
});
```

**Key Points:**
- `unlockingScriptLength` is an **estimate** - actual scripts are generated in Step 2
- `inputBEEF` provides the source transaction data for inputs
- Returns `signableTransaction` object with `reference` and `tx` BEEF

---

### Step 2: Sign (Generate Unlocking Scripts)

The second step uses the BSV SDK's signing mechanism to generate the **actual unlocking scripts** for all inputs.

```typescript
// Extract signable transaction
const reference = actionRes.signableTransaction.reference;
const txToSign = Transaction.fromBEEF(actionRes.signableTransaction.tx);

// Add unlocking script template and source transaction to EACH input
txToSign.inputs[0].unlockingScriptTemplate = unlockTemplate;
txToSign.inputs[0].sourceTransaction = sourceTransaction;

// Sign the transaction (generates unlocking scripts)
await txToSign.sign();

// Extract the actual unlocking script
const unlockingScript = txToSign.inputs[0].unlockingScript;

if (!unlockingScript) {
  throw new Error('Missing unlocking script after signing');
}
```

**Key Points:**
- Must attach `unlockingScriptTemplate` to each input
- Must attach `sourceTransaction` (from `Transaction.fromBEEF(inputBEEF)`)
- `txToSign.sign()` generates the actual unlocking scripts
- Extract scripts from `inputs[i].unlockingScript` after signing

---

### Step 3: signAction (Finalize Transaction)

The final step uses `serverWallet.signAction()` to finalize the transaction with the **actual unlocking scripts** from Step 2.

```typescript
// Finalize with actual unlocking scripts
const action = await serverWallet.signAction({
  reference: reference,  // From Step 1
  spends: {
    '0': { unlockingScript: unlockingScript.toHex() }  // From Step 2
  }
});

if (!action.tx) {
  throw new Error('Failed to sign action');
}

// Broadcast transaction
const tx = Transaction.fromAtomicBEEF(action.tx);
const broadcast = await broadcastTX(tx);
const txid = broadcast.txid;
```

**Key Points:**
- `reference` links back to the prepared transaction from Step 1
- `spends` provides the actual unlocking scripts for each input (keyed by input index)
- Returns final signed transaction in `action.tx` (Atomic BEEF format)
- Ready for broadcasting to the blockchain

---

## Simplifying with @bsv/wallet-helper

While this application implements the 3-step pattern manually for educational purposes and full control, the **`@bsv/wallet-helper`** library can significantly simplify this process for your own applications.

### What is @bsv/wallet-helper?

The `@bsv/wallet-helper` library provides high-level abstractions that handle the createAction → sign → signAction flow automatically, reducing boilerplate and potential errors.

**Installation:**
```bash
npm install @bsv/wallet-helper
```

**Learn More:**
- 📖 [Wallet Helper Documentation](https://github.com/bsv-blockchain/bsv-wallet-helper)

---

## Using with BSV-20/21 Tokens

This pattern seamlessly supports **BSV-20** (fungible) and **BSV-21** (non-fungible) tokens using the `amt` field in token inscriptions.

### BSV-20 Fungible Tokens (Materials)

BSV-20 tokens use the `amt` field to represent quantities. This application uses them for **crafting materials** where quantities can be merged, split, and consumed.

```typescript
// Mint BSV-20 token with quantity
const materialMetadata = {
  name: 'material_token',
  lootTableId: 'dragon_scale',
  itemName: 'Dragon Scale',
  icon: '🐲',
  rarity: 'legendary',
  tier: 1,
};

const lockingScript = ordinalP2PKH.lock(
  serverPublicKey,
  '',  // Empty for new mint
  materialMetadata,
  'deploy+mint',
  quantity  // BSV-20 amt field (e.g., 10)
);
```

**Key Operations:**
- **Mint**: `deploy+mint` with `amt=10` creates 10 units
- **Transfer**: Reference assetId, `amt=10` transfers all units
- **Split**: Input `amt=10` → Outputs `amt=6` and `amt=4` (change)
- **Merge**: Inputs `amt=5` + `amt=3` → Output `amt=8`

---

### BSV-21 Non-Fungible Tokens (Items/Equipment)

BSV-21 tokens always use `amt=1` to represent unique items. This application uses them for **equipment, weapons, and crafted items** where each token is unique.

```typescript
// Mint BSV-21 token (unique item)
const itemMetadata = {
  name: 'game_item',
  itemName: 'Excalibur',
  icon: '⚔️',
  rarity: 'legendary',
  itemType: 'weapon',
  tier: 3,
  stats: { damageBonus: 18, critChance: 35 },
  enhancements: { prefix: null, suffix: null },
};

const lockingScript = ordinalP2PKH.lock(
  userPublicKey,
  assetId,  // Reference to mint outpoint
  itemMetadata,
  'transfer',
  1  // BSV-21 amt field (always 1 for unique items)
);
```

**Key Operations:**
- **Mint**: `deploy+mint` with `amt=1` creates unique item
- **Transfer**: Reference assetId, `amt=1` transfers ownership
- **Update**: Input `amt=1` → Output `amt=1` with modified metadata (inscriptions)

---

## Architecture Patterns

This application uses two primary transaction patterns for server-controlled operations:

### Pattern 1: Mint-and-Transfer (Items, Materials)

**Flow:**
1. User creates WalletP2PKH payment transaction (100 sats to server)
2. Server mints token (user payment as input for fees)
3. Server immediately transfers token to user

**Example Files:**
- `src/app/api/items/mint-and-transfer/route.ts` - Item NFTs
- `src/app/api/materials/mint-and-transfer/route.ts` - Material tokens

**Benefits:**
- Server controls minting (prevents fraudulent tokens)
- User owns token immediately after minting
- On-chain proof: mintOutpoint (server mint) → tokenId (user ownership)

---

### Pattern 2: Transfer-to-Server (Crafting, Equipment Updates)

**Flow:**
1. User transfers tokens to server (materials, equipment, scrolls)
2. User creates WalletP2PKH payment transaction (100 sats to server)
3. Server performs operation (crafting, merging, updating)
4. Server transfers result back to user

**Example Files:**
- `src/app/api/crafting/mint-and-transfer/route.ts` - Crafting recipes
- `src/app/api/equipment/update/route.ts` - Equipment inscription updates
- `src/app/api/materials/add-and-merge/route.ts` - Material merging

**Benefits:**
- Server has full control during operation
- All operations recorded on-chain
- Material consumption is verifiable (inputs spent)
- Change tokens maintain provenance chain

---

## Deep Dive: Crafting System (Token Inputs → New Item)

The crafting system demonstrates the most sophisticated use of the transaction pattern, where **multiple fungible token inputs (BSV-20 materials) are consumed to create a single non-fungible token output (BSV-21 crafted item)**.

### Crafting Flow Overview

```
Player has:
  - Dragon Scale token (amt=15)
  - Phoenix Feather token (amt=8)
  - Demon Horn token (amt=5)

Recipe requires:
  - Dragon Scale x10
  - Phoenix Feather x5
  - Demon Horn x3

Result:
  - Legendary Sword (amt=1, unique item)
  - Dragon Scale x5 (change)
  - Phoenix Feather x3 (change)
  - Demon Horn x2 (change)
```

### Step-by-Step Transaction Breakdown

#### Phase 1: User Transfers Materials to Server

The user must first transfer control of their material tokens to the server. This is done in **a single transaction with multiple inputs/outputs**:

```typescript
// Transaction 1: Transfer all materials to server (batched)
Inputs:
  [0] Dragon Scale token    (amt=15, locked to user)
  [1] Phoenix Feather token (amt=8,  locked to user)
  [2] Demon Horn token      (amt=5,  locked to user)

Outputs:
  [0] Dragon Scale token    (amt=15, locked to server)
  [1] Phoenix Feather token (amt=8,  locked to server)
  [2] Demon Horn token      (amt=5,  locked to server)
```

**Why transfer to server?**
- Server needs control to spend the materials
- Prevents double-spending (user can't use same materials elsewhere)
- Creates on-chain proof of material commitment
- **Batching in one transaction** reduces fees and complexity

#### Phase 2: Server Mints Crafted Item

Once materials are transferred, the server mints the new crafted item:

```typescript
// Transaction 4: Mint crafted item
Input:  User WalletP2PKH payment (100 sats for fees)
Output: Legendary Sword (amt=1, locked to server)
```

**Metadata includes crafting proof:**
```typescript
const craftedItemMetadata = {
  name: 'game_item',
  itemName: 'Legendary Sword',
  itemType: 'weapon',
  tier: 3,
  stats: { damageBonus: 18, critChance: 35 },
  craftingProof: {
    recipeId: 'legendary_weapon_tier3',
    materialTokens: [
      'dragon_scale_txid.0',     // References the transferred materials
      'phoenix_feather_txid.0',
      'demon_horn_txid.0'
    ],
    craftedAt: '2026-01-21T12:00:00Z'
  }
};
```

This creates **verifiable on-chain provenance**: anyone can see which material tokens were consumed to create this item.

#### Phase 3: Server Transfers Everything Back to User

The final transaction is the most complex - it consumes all transferred materials + crafted item, and outputs the crafted item + material change:

```typescript
// Transaction 5: Atomic transfer (materials + item → user)
Inputs:
  [0] Dragon Scale token    (amt=15, server unlocks)
  [1] Phoenix Feather token (amt=8,  server unlocks)
  [2] Demon Horn token      (amt=5,  server unlocks)
  [3] Legendary Sword       (amt=1,  server unlocks)

Outputs:
  [0] Legendary Sword       (amt=1,  locked to user)   ← Crafted item
  [1] Dragon Scale token    (amt=5,  locked to user)   ← Change (15-10=5)
  [2] Phoenix Feather token (amt=3,  locked to user)   ← Change (8-5=3)
  [3] Demon Horn token      (amt=2,  locked to user)   ← Change (5-3=2)
```

### Why This Design?

This multi-phase approach provides several critical guarantees:

**0. Batched Transfers**
- All materials transferred in **one transaction** (not separate transactions per material)
- Reduces total transaction count from N+2 to just 3 transactions (transfer, mint, return)
- Lower fees and simpler UX
- BSV's unlimited block size makes batching trivial

**1. Atomicity**
- All material consumption happens in a single transaction (Phase 3)
- If any part fails, the entire operation rolls back
- User either gets crafted item + change, or nothing (no partial loss)

**2. On-Chain Provenance**
- Material consumption is verifiable (spent UTXOs)
- Crafted item references the material tokens used
- Anyone can audit: "Was this item legitimately crafted?"

**3. Material Change Handling**
- Excess materials are returned as change tokens
- Change tokens maintain original `mintOutpoint` (provenance preserved)
- Only the `amt` field changes (15 → 5)
- No unnecessary token minting (reuses existing tokens)

**4. Server Control**
- Server validates recipe requirements
- Server enforces game rules (level requirements, etc.)
- Server prevents fraudulent crafting (wrong materials, insufficient quantity)
- Player can't craft items they shouldn't have

### Real-World Example: Crafting Excalibur

**Recipe:** Excalibur (Legendary Weapon)
- Requires: Soul Stone x2, Phoenix Feather x3, Dragon Heart x2
- Requires: Level 20, 50 Rare Steel, 30 Rare Gems

**Blockchain Transactions:**

```
Step 1: User transfers all materials to server (single batched transaction)
  Inputs (6 total):
    - soul_stone (amt=2, user unlocks)
    - phoenix_feather (amt=5, user unlocks) ← Has 5, needs 3 (will get 2 back)
    - dragon_heart (amt=2, user unlocks)
    - rare_steel (amt=50, user unlocks)
    - rare_gem (amt=40, user unlocks) ← Has 40, needs 30 (will get 10 back)
    - millennium_root (amt=5, user unlocks)

  Outputs (6 total):
    - soul_stone (amt=2, locked to server)
    - phoenix_feather (amt=5, locked to server)
    - dragon_heart (amt=2, locked to server)
    - rare_steel (amt=50, locked to server)
    - rare_gem (amt=40, locked to server)
    - millennium_root (amt=5, locked to server)

Step 2: Server mints Excalibur
  Input:  User payment (100 sats)
  Output: Excalibur (amt=1, server owns)

Step 3: Server atomic transfer
  Inputs (7 total):
    - All 6 transferred material tokens (server unlocks)
    - Excalibur token (server unlocks)

  Outputs (3 total):
    - Excalibur (amt=1, to user)
    - Phoenix Feather change (amt=2, to user)
    - Rare Gem change (amt=10, to user)
```

**On-Chain Result:**
- ✅ User owns Excalibur with full crafting proof
- ✅ All required materials are spent (verifiable)
- ✅ Change materials returned (phoenix feather x2, rare gem x10)
- ✅ Material tokens without change are fully consumed (deleted)
- ✅ Database tracks `consumed: true` for inventory items

### Material Token Lifecycle

**Before Crafting:**
```typescript
MaterialToken {
  userId: "user123",
  lootTableId: "dragon_scale",
  tokenId: "abc123...def.0",     // Current UTXO location
  quantity: 15,
  mintOutpoint: "xyz789...ghi.0"  // Original mint (never changes)
}
```

**After Crafting (with change):**
```typescript
MaterialToken {
  userId: "user123",
  lootTableId: "dragon_scale",
  tokenId: "jkl456...mno.1",      // NEW UTXO location (change output)
  quantity: 5,                    // REDUCED quantity (15 → 5)
  mintOutpoint: "xyz789...ghi.0", // SAME mint proof (provenance preserved)
  updateHistory: [
    {
      operation: 'subtract',
      previousQuantity: 15,
      newQuantity: 5,
      transactionId: "jkl456...mno",
      reason: "Consumed in crafting recipe: legendary_weapon_tier3"
    }
  ]
}
```

### Why Not Burn and Mint?

**Alternative approach (not used):**
```
❌ Burn old tokens → Mint new tokens with reduced quantities
   Problem: Breaks provenance chain (new mintOutpoint)
   Problem: More transactions = higher fees
   Problem: More complex = more failure points
```

**Our approach (used):**
```
✅ Spend old tokens → Output change tokens with same mintOutpoint
   Benefit: Provenance preserved (same mintOutpoint)
   Benefit: Single transaction = lower fees
   Benefit: Simpler = more reliable
```

### Database Tracking

After crafting completes, the database reflects the new state:

**Crafted Item (UserInventory):**
```typescript
{
  userId: "user123",
  lootTableId: "excalibur",
  itemType: "weapon",
  nftLootId: ObjectId("..."),
  tokenId: "jkl456...mno.0",      // Crafted item output
  mintOutpoint: "pqr789...stu.0", // Server mint proof
  tier: 3,
  acquiredAt: "2026-01-21T12:00:00Z"
}
```

**Consumed Materials (UserInventory):**
```typescript
// Original inventory items marked consumed
{
  _id: ObjectId("item1"),
  consumed: true,
  consumedAt: "2026-01-21T12:00:00Z",
  consumedInRecipe: "legendary_weapon_tier3",
  consumptionTxId: "jkl456...mno"
}
```

**Material Changes (MaterialToken):**
```typescript
// Phoenix feather change (5 → 3 after crafting)
{
  userId: "user123",
  lootTableId: "phoenix_feather",
  tokenId: "jkl456...mno.2",      // Change output
  quantity: 2,
  mintOutpoint: "original_mint.0" // Preserved
}
```

### Verification Example

Anyone can verify the crafting was legitimate:

1. **Look up crafted item on-chain**: `jkl456...mno.0`
2. **Read metadata**: See `craftingProof.materialTokens`
3. **Check those material transactions**: Verify they were spent in `jkl456...mno`
4. **Verify quantities**: Add up inputs (2+3+2) match recipe requirements
5. **Verify server signature**: Minting transaction signed by server wallet

This creates **trustless verification** - no need to trust the database, everything is provable on-chain.

---

## Multiple Input Handling

For transactions with multiple inputs, the pattern scales naturally:

```typescript
// Step 1: Create action with all inputs
const actionRes = await serverWallet.createAction({
  description: "Multi-input operation",
  inputBEEF: mergedBeef.toBinary(),  // Merged BEEFs
  inputs: [
    { outpoint: "txid1.0", unlockingScriptLength: lengthA },
    { outpoint: "txid2.0", unlockingScriptLength: lengthB },
    { outpoint: "txid3.0", unlockingScriptLength: lengthC },
  ],
  outputs: [...],
});

// Step 2: Sign all inputs
const txToSign = Transaction.fromBEEF(actionRes.signableTransaction.tx);
for (let i = 0; i < txToSign.inputs.length; i++) {
  txToSign.inputs[i].unlockingScriptTemplate = templates[i];
  txToSign.inputs[i].sourceTransaction = sources[i];
}
await txToSign.sign();

// Step 3: Provide all unlocking scripts
const spends: Record<string, any> = {};
for (let i = 0; i < txToSign.inputs.length; i++) {
  spends[String(i)] = { unlockingScript: txToSign.inputs[i].unlockingScript.toHex() };
}

const action = await serverWallet.signAction({
  reference: actionRes.signableTransaction.reference,
  spends,
});
```

**Example:** Crafting with 3 material inputs + 1 crafted item input = 4 total inputs

---

## On-Chain Credibility

Every game item in this application has **full on-chain provenance**:

### Item Lifecycle

1. **Loot Drop** → User defeats monster
   - Database: `UserInventory` entry (unminted)
   - Blockchain: No transaction yet

2. **Mint** → User pays 100 sats to mint
   - Database: `NFTLoot` entry + `mintOutpoint`
   - Blockchain: Server mint transaction (`deploy+mint`)
   - Blockchain: Transfer transaction (server → user)

3. **Transfer** → User trades or updates item
   - Database: Updated `tokenId` reference
   - Blockchain: Transfer transaction with updated metadata

4. **Update** → User applies inscription scroll
   - Database: New `UserInventory` entry, old marked `consumed: true`
   - Blockchain: Equipment + Scroll → Updated Equipment transaction

5. **Consume** → User uses item in crafting
   - Database: Marked `consumed: true` with recipe reference
   - Blockchain: Material inputs spent in crafting transaction

### Verification

Anyone can verify:
- **Mint Proof**: `mintOutpoint` stored in database → check blockchain
- **Ownership**: `tokenId` stored in database → check blockchain for current UTXO
- **Provenance**: Follow transaction chain from mint to current location
- **Authenticity**: Only server can mint (server pubkey in mint transaction)

---

## WalletP2PKH Payment System

All server operations require a **100 satoshi payment** from the user using WalletP2PKH (hierarchical deterministic wallet):

### Server-Side Payment Unlocking

```typescript
const walletp2pkh = new WalletP2PKH(serverWallet);
const unlockTemplate = walletp2pkh.unlock({
  protocolID: walletParams.protocolID,
  keyID: walletParams.keyID,
  counterparty: walletParams.counterparty,
});

// Used in Step 2 (signing)
txToSign.inputs[0].unlockingScriptTemplate = unlockTemplate;
await txToSign.sign();
```

**Benefits:**
- Deterministic key derivation (no key management complexity)
- Server can unlock without storing user's private key
- Pays for transaction fees (user funds the operation)
- Can be integrated with BSV wallets for automated payments

---

## Implementation Examples

### Example 1: Mint Item NFT

See: `src/app/api/items/mint-and-transfer/route.ts`

**Transaction Flow:**
```
Input:  User WalletP2PKH payment (100 sats)
Output: Item NFT (server pubkey, amt=1)
↓
Input:  Item NFT (server unlocks)
Output: Item NFT (user pubkey, amt=1)
```

### Example 2: Craft Equipment

See: `src/app/api/crafting/mint-and-transfer/route.ts`

**Transaction Flow:**
```
Materials transferred to server (single batched transaction):
Inputs:  Material A, B, C (user unlocks all)
Outputs: Material A, B, C (locked to server)
↓
Server mints crafted item:
Input:  User WalletP2PKH payment (100 sats)
Output: Crafted Item (server pubkey, amt=1)
↓
Server transfers all to user:
Inputs:  Material A, B, C + Crafted Item (server unlocks all)
Outputs: Crafted Item (user pubkey, amt=1)
         Material A change (user pubkey, amt=reduced)
         Material B change (user pubkey, amt=reduced)
```

### Example 3: Merge Materials

See: `src/app/api/materials/add-and-merge/route.ts`

**Transaction Flow:**
```
User transfers existing materials to server:
Input:  Material (user → server, amt=10)
↓
Server mints additional materials:
Input:  User WalletP2PKH payment (100 sats)
Output: Material (server pubkey, amt=5)
↓
Server merges and returns:
Inputs:  Transferred Material (amt=10) + Minted Material (amt=5)
Output:  Merged Material (user pubkey, amt=15)
```

---

## Error Handling

All routes implement consistent error handling:

```typescript
try {
  // Step 1: createAction
  if (!actionRes.signableTransaction) {
    throw new Error('Failed to create signable transaction');
  }

  // Step 2: Sign
  await txToSign.sign();
  const unlockingScript = txToSign.inputs[0].unlockingScript;
  if (!unlockingScript) {
    throw new Error('Missing unlocking script after signing');
  }

  // Step 3: signAction
  if (!action.tx) {
    throw new Error('Failed to sign action');
  }

  // Broadcast
  const broadcast = await broadcastTX(tx);
  if (!broadcast.txid) {
    throw new Error('Failed to get transaction ID from broadcast');
  }

} catch (error) {
  console.error('Transaction error:', error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Transaction failed' },
    { status: 500 }
  );
}
```

---

## Summary

This application demonstrates a **production-ready pattern** for creating blockchain transactions with:

✅ **Consistency**: Same 3-step flow across all operations
✅ **BSV-20/21 Support**: Fungible and non-fungible token handling
✅ **On-Chain Credibility**: Full provenance for every game item
✅ **Server Control**: Prevents fraudulent minting and ensures game rules
✅ **Scalability**: Handles single and multiple input transactions
✅ **Reliability**: Proper error handling and validation at each step

Every item minted, crafted, transferred, or updated in this game has a **verifiable on-chain record**, making it a real-world example of blockchain-based game economies.

---

## Further Reading

- **WalletP2PKH**: Hierarchical deterministic wallet pattern for payment derivation
- **OrdinalsP2PKH**: Custom P2PKH implementation with inscription support

---

*Last Updated: 2026-01-21*
