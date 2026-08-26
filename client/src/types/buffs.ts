/**
 * Player Buff System
 *
 * Flexible buff system that supports:
 * - Temporary spell buffs (shield, damage boost, etc.)
 * - Permanent equipment prefix/suffix effects (future)
 * - Consumable buffs (future)
 *
 * Buffs are additive and stack by type (e.g., multiple damage boosts add together)
 */

export enum BuffType {
  // Defensive buffs
  SHIELD = 'shield',                    // Absorbs damage (value = HP amount)
  DAMAGE_REDUCTION = 'damage_reduction', // Reduces incoming damage (value = percentage)

  // DoT Resistance buffs (reduce DoT damage by percentage)
  FIRE_RESISTANCE = 'fire_resistance',   // Reduces burn DoT damage (value = percentage)
  POISON_RESISTANCE = 'poison_resistance', // Reduces poison DoT damage (value = percentage)
  BLEED_RESISTANCE = 'bleed_resistance', // Reduces bleed DoT damage (value = percentage)

  // Offensive buffs
  DAMAGE_BOOST = 'damage_boost',         // Increases player damage (value = flat amount)
  DAMAGE_MULT = 'damage_mult',           // Multiplies player damage (value = percentage)
  CRIT_BOOST = 'crit_boost',             // Increases crit chance (value = percentage)

  // Speed buffs
  ATTACK_SPEED = 'attack_speed',         // Reduces monster attack interval (value = percentage)
  COOLDOWN_REDUCTION = 'cooldown_reduction', // Reduces spell cooldowns (value = percentage)

  // Utility buffs
  COIN_BOOST = 'coin_boost',             // Increases coin drops (value = percentage)
  XP_BOOST = 'xp_boost',                 // Increases XP gain (value = percentage)
  HEAL_BOOST = 'heal_boost',             // Increases healing received (value = percentage)

  // Generic stat boost (for equipment prefix/suffix)
  STAT_BOOST = 'stat_boost',             // Generic stat boost (uses statType field)
}

export enum BuffSource {
  SPELL = 'spell',           // From casting spell scrolls
  EQUIPMENT = 'equipment',   // From equipment prefix/suffix (future)
  CONSUMABLE = 'consumable', // From consumables (future)
  MONSTER = 'monster',       // From monster special attacks (debuffs)
}

export interface Buff {
  buffId: string;            // Unique identifier (e.g., "shield_buff_1234")
  buffType: BuffType;        // What kind of buff is this
  value: number;             // Buff value (HP for shield, percentage for others)
  durationMs: number;        // Duration in milliseconds (0 = permanent for equipment)
  appliedAt: number;         // Timestamp when applied (Date.now())
  expiresAt: number;         // When buff expires (appliedAt + durationMs)
  source: BuffSource;        // Where it came from
  sourceId?: string;         // Specific source (spell lootTableId, equipment _id, etc.)
  statType?: string;         // For STAT_BOOST: which stat to affect (damageBonus, critChance, etc.)
  icon?: string;             // Optional icon for UI display
  name?: string;             // Optional name for UI display
}
