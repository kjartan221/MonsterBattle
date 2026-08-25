import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlayerBuffs } from './usePlayerBuffs';
import { BuffType, BuffSource } from '@/types/buffs';

vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { default: toast, toast };
});

describe('usePlayerBuffs expiry sweep', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('does not re-render while no buffs are active', () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return usePlayerBuffs();
    });

    const rendersAfterMount = renders;
    act(() => void vi.advanceTimersByTime(2_000)); // 4 sweeps at 500ms

    expect(renders).toBe(rendersAfterMount);
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
        duration: 30,
        source: BuffSource.SPELL,
      });
    });

    const rendersAfterApply = renders;
    act(() => void vi.advanceTimersByTime(2_000));

    expect(renders).toBe(rendersAfterApply);
    expect(result.current.activeBuffs).toHaveLength(1);
  });

  test('re-renders and drops the buff once it expires', () => {
    const { result } = renderHook(() => usePlayerBuffs());

    act(() => {
      result.current.applyBuff({
        buffType: BuffType.DAMAGE_BOOST,
        value: 5,
        duration: 1,
        source: BuffSource.SPELL,
      });
    });
    expect(result.current.activeBuffs).toHaveLength(1);

    act(() => void vi.advanceTimersByTime(1_500));

    expect(result.current.activeBuffs).toHaveLength(0);
  });
});
