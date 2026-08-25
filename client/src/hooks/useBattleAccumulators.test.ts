import { describe, test, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBattleAccumulators, ACCUMULATOR_KEYS } from './useBattleAccumulators';

// These values are submitted to /api/attack-monster and the server trusts them when it
// reconstructs the fight. Anything surviving into the next battle widens the HP-cheat
// tolerance for free, so "reset clears everything" is the property that matters.
describe('useBattleAccumulators', () => {
  test('starts with every accumulator at zero', () => {
    const { result } = renderHook(() => useBattleAccumulators());

    expect(Object.values(result.current.values).every(v => v === 0)).toBe(true);
  });

  test('reset() clears every accumulator, with no key left behind', () => {
    const { result } = renderHook(() => useBattleAccumulators());

    act(() => {
      ACCUMULATOR_KEYS.forEach((key, i) => result.current.add(key, i + 1));
    });
    // Guard: the fields really were dirty before the reset.
    expect(Object.values(result.current.values).every(v => v > 0)).toBe(true);

    act(() => result.current.reset());

    expect(result.current.values).toEqual(
      Object.fromEntries(ACCUMULATOR_KEYS.map(k => [k, 0]))
    );
  });

  test('reset() can seed values for a resumed session', () => {
    const { result } = renderHook(() => useBattleAccumulators());

    act(() => result.current.add('totalHealing', 99));
    act(() => result.current.reset({ clickCount: 3, totalDamage: 12 }));

    expect(result.current.values.clickCount).toBe(3);
    expect(result.current.values.totalDamage).toBe(12);
    expect(result.current.values.totalHealing).toBe(0);
  });

  test('add() accumulates across calls', () => {
    const { result } = renderHook(() => useBattleAccumulators());

    act(() => result.current.add('totalDamage', 10));
    act(() => result.current.add('totalDamage', 5));

    expect(result.current.values.totalDamage).toBe(15);
  });

  test('add() with a negative amount never drives an accumulator below zero', () => {
    // Healing the monster subtracts from totalDamage; it must not go negative.
    const { result } = renderHook(() => useBattleAccumulators());

    act(() => result.current.add('totalDamage', 5));
    act(() => result.current.add('totalDamage', -20));

    expect(result.current.values.totalDamage).toBe(0);
  });

  test('set() overwrites an accumulator outright', () => {
    const { result } = renderHook(() => useBattleAccumulators());

    act(() => result.current.add('clickCount', 7));
    act(() => result.current.set('clickCount', 2));

    expect(result.current.values.clickCount).toBe(2);
  });

  test('exposes a stable add/set/reset identity across renders', () => {
    // These land in effect dep arrays in MonsterBattleSection; unstable identities
    // rebuild the combat intervals and reset swing timers.
    const { result, rerender } = renderHook(() => useBattleAccumulators());
    const first = result.current;

    act(() => result.current.add('totalDamage', 1));
    rerender();

    expect(result.current.add).toBe(first.add);
    expect(result.current.set).toBe(first.set);
    expect(result.current.reset).toBe(first.reset);
  });
});
