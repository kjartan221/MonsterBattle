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
  escapeTimer: number | null;
  isStunned: boolean;
  stunStartTime: number;
  stunEndTime: number;
  damageWindow: number;
  damageWindowEndTime: number;
  monsterDebuffs: MonsterDebuff[];
  lastHPPercent: number;
  triggeredThresholds: Set<number>;
};

/** The only way an attempt is created. Fresh collections every call. */
export function freshAttempt(): BattleAttempt {
  const counters = Object.fromEntries(
    ACCUMULATOR_KEYS.map(key => [key, 0])
  ) as Record<AccumulatorKey, number>;

  return {
    ...counters,
    shieldHP: 0,
    escapeTimer: null,
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
