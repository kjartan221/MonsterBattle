import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlayerBuffs } from './usePlayerBuffs';
import { battleScheduler, startBattleSchedulerLifetime } from '@/stores/battleScheduler';
import { useBattleStore } from '@/stores/battleStore';
import { BuffType, BuffSource } from '@/types/buffs';
import type { BattleSessionFrontend, MonsterFrontend } from '@shared/types';

vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { default: toast, toast };
});

const START = 1_700_000_000_000;

function session(): BattleSessionFrontend {
  return {
    _id: 'session-1', userId: 'user-1', biome: 'forest', tier: 1,
    clickCount: 0, isDefeated: false, startedAt: new Date(),
    monster: {
      _id: 'monster-1', name: 'Forest Wolf', imageUrl: '', clicksRequired: 100,
      attackDamage: 5, rarity: 'common', biome: 'forest', tier: 1,
      moveInterval: 1000, createdAt: new Date(),
    } as MonsterFrontend,
  } as BattleSessionFrontend;
}

/**
 * Expiry is now a scheduler deadline, not a 500ms sweep, so these drive the scheduler
 * directly against a controlled clock instead of advancing React's timers. `battleScheduler`
 * reads `Date.now()` through `systemClock`, which `vi.setSystemTime` owns here; `tick()`
 * stands in for the base ticker so each test decides exactly when the scheduler wakes.
 */
function advance(ms: number) {
  vi.setSystemTime(Date.now() + ms);
  act(() => battleScheduler.tick());
}

describe('usePlayerBuffs expiry deadlines', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    useBattleStore.getState().reset();
    battleScheduler.clearAll();
  });
  afterEach(() => {
    // No store reset here: RTL's auto-cleanup unmount runs after this hook, so a store write
    // now would land on a still-mounted component and trip React's act warning. beforeEach
    // resets instead, when nothing is rendered.
    battleScheduler.clearAll();
    vi.useRealTimers();
  });

  test('does not re-render while no buffs are active', () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return usePlayerBuffs();
    });

    const rendersAfterMount = renders;
    advance(2_000);

    expect(renders).toBe(rendersAfterMount);
    expect(battleScheduler.size()).toBe(0); // nothing registered, nothing to wake for
  });

  test('does not re-render while an active buff has not yet expired', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return usePlayerBuffs();
    });

    act(() => {
      result.current.applyBuff({
        buffType: BuffType.DAMAGE_BOOST,
        value: 5,
        durationMs: 30_000,
        source: BuffSource.SPELL,
      });
    });

    const rendersAfterApply = renders;
    advance(2_000);

    expect(renders).toBe(rendersAfterApply);
    expect(result.current.activeBuffs).toHaveLength(1);
  });

  test('re-renders and drops the buff once it expires', () => {
    const { result } = renderHook(() => usePlayerBuffs());

    act(() => {
      result.current.applyBuff({
        buffType: BuffType.DAMAGE_BOOST,
        value: 5,
        durationMs: 1_000,
        source: BuffSource.SPELL,
      });
    });
    expect(result.current.activeBuffs).toHaveLength(1);

    advance(1_500);

    expect(result.current.activeBuffs).toHaveLength(0);
  });

  test('re-arms its deadlines after the attempt lifetime clears the scheduler', () => {
    // Buffs are page-level state that outlives a battle, but `startBattleSchedulerLifetime`
    // cancels every registration on the way out of an attempt. Without the re-registration
    // effect in usePlayerBuffs the deadline below is cancelled and never replaced, and the buff
    // stays active forever - the exact regression the effect exists to prevent. Driven through a
    // real store transition rather than `battleScheduler.clearAll()`, so what is under test is
    // the effect re-arming, not the scheduler.
    const stopLifetime = startBattleSchedulerLifetime();
    try {
      useBattleStore.getState().sessionLoaded(session(), 'inProgress');

      const { result } = renderHook(() => usePlayerBuffs());
      act(() => {
        result.current.applyBuff({
          buffType: BuffType.DAMAGE_BOOST,
          value: 5,
          durationMs: 10_000,
          source: BuffSource.SPELL,
        });
      });

      const key = `buff:${result.current.activeBuffs[0].buffId}`;
      expect(battleScheduler.has(key)).toBe(true);

      // Leaving inProgress clears the registry (see battleScheduler.test.ts); the commit that
      // follows the phase change must put this deadline back.
      act(() => void useBattleStore.getState().playerDefeated('death'));
      expect(battleScheduler.has(key)).toBe(true);

      advance(10_500);

      expect(result.current.activeBuffs).toHaveLength(0);
    } finally {
      stopLifetime();
    }
  });
});
