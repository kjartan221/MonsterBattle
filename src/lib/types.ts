import { ObjectId } from 'mongodb';
import { BiomeId, Tier } from './biome-config';

// ========== MongoDB Documents (Backend) ==========

// User document
export interface User {
  _id?: ObjectId;
  userId: string; // Unique user identifier (from external auth)
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

// Monster document
export interface Monster {
  _id?: ObjectId;
  name: string;
  imageUrl: string; // URL or path to monster PNG
  clicksRequired: number; // Number of clicks needed to defeat (scaled by tier)
  attackDamage: number; // Damage per second dealt to player (scaled by tier)
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  biome: BiomeId; // Which biome this monster belongs to
  tier: Tier; // Which tier this monster instance is at
  moveInterval: number; // Time in milliseconds between position changes (700-3000ms)
  isBoss?: boolean; // True for boss monsters (enables phase system)
  isCorrupted?: boolean; // True for corrupted monsters (+50% HP, +25% damage, drops empowered items)
  dotEffect?: DebuffEffect; // Optional DoT effect on attack
  buffs?: MonsterBuff[]; // Monster buffs (Shield, Fast, etc.)
  specialAttacks?: SpecialAttack[]; // Boss special attacks (fireball, etc.)
  bossPhases?: BossPhase[]; // Boss phase system (for multi-phase bosses)
  createdAt: Date;
}

// NFT Loot document
export interface NFTLoot {
  _id?: ObjectId;
  lootTableId: string;  // Reference to loot-table.ts lootId (e.g. "dragon_scale")
  name: string;
  description: string;
  icon: string;         // Emoji icon
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact' | 'spell_scroll';
  attributes?: Record<string, any>; // Custom NFT attributes (supports nested objects like borderGradient)
  mintTransactionId?: string; // BSV transaction ID when minted to blockchain
  createdAt: Date;
}

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'material' | 'artifact' | 'spell_scroll';

// User Inventory document
export interface UserInventory {
  _id?: ObjectId;
  userId: string;          // Reference to User.userId
  lootTableId: string;     // Reference to loot-table.ts lootId (e.g. "dragon_scale")
  itemType: ItemType;
  nftLootId?: ObjectId;    // Reference to NFTLoot._id (null until user mints it)
  tier: Tier;              // Which tier this item dropped from (1-5)
  borderGradient: { color1: string; color2: string }; // User-specific gradient (stored here, not in NFT until minted)
  acquiredAt: Date;
  fromMonsterId?: ObjectId; // Reference to Monster._id (undefined for crafted items)
  fromSessionId?: ObjectId; // Reference to BattleSession._id (undefined for crafted items)
  crafted?: boolean;        // True if item was crafted
  statRoll?: number;        // Stat roll multiplier (0.8 to 1.2) for crafted items
  rolledStats?: {           // Final stats after applying stat roll
    damageBonus?: number;
    critChance?: number;
    hpReduction?: number;
    maxHpBonus?: number;
    attackSpeed?: number;
    coinBonus?: number;
  };
  isEmpowered?: boolean;    // True if dropped by a corrupted monster (+20% to all stats)
}

// Player Stats document (RPG progression)
export interface PlayerStats {
  _id?: ObjectId;
  userId: string; // Reference to User.userId
  level: number;
  experience: number;
  coins: number;
  maxHealth: number;
  currentHealth: number;

  // Equipment slots (store inventory item IDs)
  equippedWeapon?: ObjectId;
  equippedArmor?: ObjectId;
  equippedAccessory1?: ObjectId;
  equippedAccessory2?: ObjectId;
  equippedConsumables?: [ObjectId | 'empty', ObjectId | 'empty', ObjectId | 'empty']; // Array of 3 ('empty' for empty slots)

  // Battle stats
  baseDamage: number;
  critChance: number;
  attackSpeed: number;

  // Progress tracking
  currentZone: number;
  currentTier: number;
  unlockedZones: string[]; // Array of "zone-tier" strings like "forest-1", "desert-1"

  // Statistics
  stats: {
    battlesWon: number;
    battlesWonStreak: number; // Current win streak (resets on death)
    monstersDefeated: number;
    bossesDefeated: number;
    totalDamageDealt: number;
    itemsCollected: number;
    legendariesFound: number;
  };

  createdAt: Date;
  lastBattleAt?: Date;
}

// Battle Session document
export interface BattleSession {
  _id?: ObjectId;
  userId: string; // Reference to User.userId
  monsterId: ObjectId; // Reference to Monster._id
  biome: BiomeId; // Which biome this battle is in
  tier: Tier; // Which tier this battle is at
  clickCount: number;
  isDefeated: boolean;
  lootOptions?: string[]; // Array of lootIds from loot-table (the 5 options shown)
  selectedLootId?: string; // The lootId the user chose, or 'SKIPPED' if user skipped loot selection
  usedItems: Array<{ lootTableId: string; usedAt: Date }>; // Track items used during battle (for HP verification)
  startedAt: Date; // When session was created (monster spawned)
  actualBattleStartedAt?: Date; // When user clicked "Start Battle" button (for HP verification)
  completedAt?: Date;
}

// ========== Consumable System ==========
// Note: Consumable data is retrieved directly from loot-table.ts using getLootItemById()
// Effects are determined by item name/description in MonsterBattleSection.tsx

// ========== Monster Buff System ==========

export type MonsterBuffType =
  | 'shield'    // Has shield HP that must be broken first
  | 'fast';     // Escapes if not defeated in time

export interface MonsterBuff {
  type: MonsterBuffType;
  value: number; // For shield: shield HP amount, for fast: escape time in seconds
}

// ========== Boss Special Attack System ==========

export type SpecialAttackType =
  | 'fireball'     // Direct damage attack with visual effect
  | 'lightning'    // Direct damage attack
  | 'meteor'       // AoE damage
  | 'heal'         // Boss heals
  | 'summon';      // Summons creatures to fight alongside boss

export interface SummonDefinition {
  name: string;
  hpPercent: number;       // % of boss max HP (e.g., 15 = 15% of boss HP)
  attackDamage: number;    // Damage per second
  imageUrl: string;        // Emoji icon
}

export interface SpecialAttack {
  type: SpecialAttackType;
  damage?: number;         // Damage to player (if applicable)
  healing?: number;        // Healing to monster (if applicable)
  cooldown: number;        // Seconds between attacks
  minTier?: number;        // Minimum tier for this attack to be available (1-5)
  visualEffect?: string;   // Color for screen flash (e.g., 'orange', 'blue', 'purple')
  message?: string;        // Message to display to player
  summons?: {              // Summon configuration (for summon type)
    count: number;         // Number of creatures to summon (typically 1-2)
    creature: SummonDefinition;
  };
  // Interactive attack configuration (spawns clickable object that must be destroyed)
  interactive?: boolean;   // If true, spawns clickable object instead of instant damage
  objectHpPercent?: number; // % of boss max HP for the interactive object (e.g., 20 = 20% of boss HP)
  impactDelay?: number;    // Seconds before object impacts (if not destroyed)
  imageUrl?: string;       // Emoji icon for interactive object (e.g., '☄️', '🌪️', '🗿')
}

// Active summoned creature in battle
export interface SummonedCreature {
  id: string;              // Unique ID for this summon instance
  name: string;
  currentHP: number;
  maxHP: number;
  attackDamage: number;
  imageUrl: string;
  position: 'left' | 'right';
}

// Active interactive attack in battle (meteor, comet, etc.)
export interface InteractiveAttack {
  id: string;              // Unique ID for this attack instance
  name: string;            // Attack name (e.g., "Meteor", "Death Comet")
  currentHP: number;
  maxHP: number;
  damage: number;          // Damage dealt to player if not destroyed
  impactTime: number;      // Timestamp when attack will impact (Date.now() + impactDelay)
  visualEffect?: string;   // Color for visual effect
  imageUrl: string;        // Emoji icon (e.g., "☄️", "💥")
}

export interface BossPhase {
  phaseNumber: number;     // Phase to trigger (2, 3, 4, etc.) - Phase 1 is always initial
  hpThreshold: number;     // % HP boundary for this phase (e.g., 50 = divides at 50%)
                          // Creates stacked HP bars: 100%→50% (Phase 1), 50%→0% (Phase 2)
                          // Phase triggers when previous phase HP bar depletes (reaches 0)
                          // Excess damage is ignored at phase boundaries (like shields)
  invulnerabilityDuration: number; // MS of invulnerability during phase transition
  specialAttacks?: SpecialAttack[]; // Attacks executed during transition (heal, summon, etc.)
  message?: string;        // Toast message shown when phase starts
}

// ========== Debuff System ==========

export type DebuffType =
  | 'poison'    // Green - gradual damage over time
  | 'burn'      // Orange - higher damage over time
  | 'bleed'     // Red - medium damage over time
  | 'slow'      // Blue - reduces attack/click speed
  | 'stun'      // Yellow - prevents actions temporarily
  | 'freeze';   // Cyan - slows movement/attacks

export type DamageType = 'flat' | 'percentage';

export interface DebuffEffect {
  type: DebuffType;
  damageType: DamageType;        // 'flat' or 'percentage'
  damageAmount: number;           // If percentage: 5 = 5% of max HP, if flat: raw damage
  tickInterval: number;           // MS between damage ticks (usually 1000)
  duration: number;               // Total duration in MS
  applyChance?: number;           // 0-100 chance to apply (optional, default 100)
}

export interface ActiveDebuff extends DebuffEffect {
  id: string;                     // Unique ID for tracking
  startTime: number;              // Timestamp when applied
  appliedBy?: string;             // Source (monster ID, spell ID, etc.)
  targetMaxHP: number;            // Max HP of target at time of application (for percentage calc)
}

// ========== Frontend Types (with string IDs) ==========

// Frontend Monster type (IDs as strings)
export interface MonsterFrontend {
  _id?: string;
  name: string;
  imageUrl: string;
  clicksRequired: number;
  attackDamage: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  biome: BiomeId;
  tier: Tier;
  moveInterval: number;           // Time in milliseconds between position changes (700-3000ms)
  createdAt: Date | string;
  isBoss?: boolean;               // True for boss monsters
  isCorrupted?: boolean;          // True for corrupted monsters (+50% HP, +25% damage)
  dotEffect?: DebuffEffect;       // Optional DoT effect on attack
  buffs?: MonsterBuff[];          // Monster buffs (Shield, Fast, etc.)
  specialAttacks?: SpecialAttack[]; // Boss special attacks
  bossPhases?: BossPhase[];       // Boss phase system
}

// Frontend Battle Session type (IDs as strings)
export interface BattleSessionFrontend {
  _id?: string;
  userId: string;
  monsterId: string;
  biome: BiomeId;
  tier: Tier;
  clickCount: number;
  isDefeated: boolean;
  lootOptions?: string[];
  selectedLootId?: string;
  usedItems?: Array<{ lootTableId: string; usedAt: Date | string }>; // Track items used during battle
  startedAt: Date | string;
  actualBattleStartedAt?: Date | string; // When user clicked "Start Battle" button
  completedAt?: Date | string;
}
