import { useCallback, useState } from 'react';

/**
 * Every per-attempt counter submitted to /api/attack-monster for server-side battle
 * reconstruction. Adding a key here automatically includes it in reset().
 */
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
export type BattleAccumulators = Record<AccumulatorKey, number>;

export interface UseBattleAccumulatorsResult {
  values: BattleAccumulators;
  add: (key: AccumulatorKey, amount: number) => void;
  set: (key: AccumulatorKey, value: number) => void;
  reset: (seed?: Partial<BattleAccumulators>) => void;
}

function zeroed(): BattleAccumulators {
  return Object.fromEntries(ACCUMULATOR_KEYS.map(k => [k, 0])) as BattleAccumulators;
}

/**
 * Single owner of the battle attempt's anti-cheat counters.
 *
 * They previously lived as ten separate useStates cleared by hand in three different code
 * paths, which drifted: the death path cleared none of them and thornsDamage was cleared
 * nowhere, so a player's stale healing and invulnerability totals carried into the next
 * battle and loosened the server's HP check. One reset() covers every key by construction.
 */
export function useBattleAccumulators(): UseBattleAccumulatorsResult {
  const [values, setValues] = useState<BattleAccumulators>(zeroed);

  // These counters are all non-negative; a negative delta (monster healing reducing
  // totalDamage) clamps at 0 rather than going below.
  const add = useCallback((key: AccumulatorKey, amount: number) => {
    setValues(prev => ({ ...prev, [key]: Math.max(0, prev[key] + amount) }));
  }, []);

  const set = useCallback((key: AccumulatorKey, value: number) => {
    setValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback((seed?: Partial<BattleAccumulators>) => {
    setValues({ ...zeroed(), ...seed });
  }, []);

  return { values, add, set, reset };
}
