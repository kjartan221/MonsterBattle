// The debuff shape the battle UI actually produces and renders. `@/types/buffs` declares a
// second, incompatible `MonsterDebuff` that nothing constructs; this is the live one.
import type { MonsterDebuff } from '@/components/battle/effect-indicators/MonsterDebuffIndicators';

/** Counters submitted to /api/attack-monster for server-side battle reconstruction. */
export const ACCUMULATOR_KEYS = [
  'totalDamage',
  'totalHealing',
  'totalShieldGained',
  'totalDamageReduction',
  'invulnerabilityTime',
  'summonDamage',
  'thornsDamage',
  'totalStunTime',
  'skillshotBonusDamage',
  'clickCount',
] as const;

export type AccumulatorKey = (typeof ACCUMULATOR_KEYS)[number];

/** Everything scoped to a single attempt at a single monster. */
export type BattleAttempt = Record<AccumulatorKey, number> & {
  shieldHP: number;
  escapeAt: number | null;
  isStunned: boolean;
  stunStartTime: number;
  stunEndTime: number;
  damageWindow: number;
  damageWindowEndTime: number;
  monsterDebuffs: MonsterDebuff[];
  lastHPPercent: number;
  triggeredThresholds: Set<number>;
};

/**
 * Deadline for a monster's Fast-buff escape, given the buff's seconds value.
 *
 * NOT `now + fastBuffSeconds * 1000`. The pre-refactor loop stored the countdown as a
 * decrementing integer and checked `escapeTimer <= 0` BEFORE decrementing on each 1000ms
 * tick, so a value of V actually took V+1 seconds to fire: one tick per decrement from V
 * down to 0 (V ticks), then one more tick where 0 <= 0 was observed and the escape fired.
 * The visible countdown (which only rendered while the value was > 0) reached 1 and vanished
 * a full second before the monster actually escaped.
 *
 * This function reproduces that exact timing so the deadline-based refactor does not
 * silently change game balance. The `+ 1` is intentional, not a typo — removing it changes
 * when Fast monsters escape, which is a balance decision for the game owner to make
 * separately, not a side effect of moving timers out of React effects.
 */
export function escapeDeadlineFrom(now: number, fastBuffSeconds: number): number {
  return now + (fastBuffSeconds + 1) * 1000;
}

/** The only way an attempt is created. Fresh collections every call. */
export function freshAttempt(): BattleAttempt {
  const counters = Object.fromEntries(
    ACCUMULATOR_KEYS.map(key => [key, 0])
  ) as Record<AccumulatorKey, number>;

  return {
    ...counters,
    shieldHP: 0,
    escapeAt: null,
    isStunned: false,
    stunStartTime: 0,
    stunEndTime: 0,
    damageWindow: 1.0,
    damageWindowEndTime: 0,
    monsterDebuffs: [],
    lastHPPercent: 100,
    triggeredThresholds: new Set<number>(),
  };
}
