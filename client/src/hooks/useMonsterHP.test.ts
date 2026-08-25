import { describe, test, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMonsterHP } from './useMonsterHP';
import type { MonsterFrontend } from '@shared/types';

function monster(overrides: Partial<MonsterFrontend> = {}): MonsterFrontend {
  return {
    _id: 'monster-1',
    name: 'Forest Wolf',
    clicksRequired: 100,
    attackDamage: 5,
    rarity: 'common',
    biome: 'forest',
    tier: 1,
    ...overrides,
  } as MonsterFrontend;
}

describe('useMonsterHP', () => {
  test('initialises HP from clicksRequired', () => {
    const { result } = renderHook(() => useMonsterHP({ monster: monster() }));

    expect(result.current.maxHP).toBe(100);
    expect(result.current.currentHP).toBe(100);
  });

  test('does not re-initialise while the same monster keeps fighting', () => {
    const m = monster();
    const { result, rerender } = renderHook(() => useMonsterHP({ monster: m }));

    act(() => result.current.damageHP(40));
    rerender();

    expect(result.current.currentHP).toBe(60);
  });

  test('re-initialises when clicksRequired changes on the same monster', () => {
    // The cheat penalty doubles the monster's HP in place. Keying the init guard on the
    // monster id alone left the bar pinned at its depleted value, and for bosses the
    // already-empty phase HP resubmitted instantly as a zero-damage victory.
    const { result, rerender } = renderHook(
      ({ m }) => useMonsterHP({ monster: m }),
      { initialProps: { m: monster({ clicksRequired: 100 }) } }
    );

    act(() => result.current.damageHP(100));
    expect(result.current.currentHP).toBe(0);

    rerender({ m: monster({ clicksRequired: 200 }) });

    expect(result.current.maxHP).toBe(200);
    expect(result.current.currentHP).toBe(200);
  });

  test('re-initialises when a different monster is loaded', () => {
    const { result, rerender } = renderHook(
      ({ m }) => useMonsterHP({ monster: m }),
      { initialProps: { m: monster({ _id: 'monster-1', clicksRequired: 100 }) } }
    );

    act(() => result.current.damageHP(90));
    rerender({ m: monster({ _id: 'monster-2', clicksRequired: 100 }) as MonsterFrontend });

    expect(result.current.currentHP).toBe(100);
  });

  test('clears HP when the monster goes away', () => {
    const { result, rerender } = renderHook(
      ({ m }) => useMonsterHP({ monster: m }),
      { initialProps: { m: monster() as MonsterFrontend | null } }
    );

    rerender({ m: null });

    expect(result.current.maxHP).toBe(0);
    expect(result.current.currentHP).toBe(0);
  });

  test('never drives HP below zero', () => {
    const { result } = renderHook(() => useMonsterHP({ monster: monster({ clicksRequired: 10 }) }));

    act(() => result.current.damageHP(999));

    expect(result.current.currentHP).toBe(0);
  });
});
