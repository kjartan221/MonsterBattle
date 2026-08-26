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
 * Deadline for a Fast-buff escape — deliberately `(seconds + 1) * 1000`, not `seconds * 1000`.
 *
 * The pre-refactor loop checked `escapeTimer <= 0` BEFORE decrementing, so a value of V took
 * V+1 seconds to fire. The `+ 1` reproduces that; removing it is a balance change, not a fix.
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
