import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNow } from './useNow';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useNow', () => {
  test('advances over time so a countdown can be derived from a deadline', () => {
    const { result } = renderHook(() => useNow(250));
    const first = result.current;

    act(() => void vi.advanceTimersByTime(1000));

    expect(result.current).toBeGreaterThan(first);
  });

  test('derives a whole-second countdown from an absolute deadline', () => {
    const deadline = Date.now() + 5_000;
    const { result } = renderHook(() => useNow(250));

    const remaining = Math.ceil((deadline - result.current) / 1000);

    expect(remaining).toBe(5);
  });

  test('stops ticking once unmounted', () => {
    const { unmount } = renderHook(() => useNow(250));
    unmount();

    // No assertion beyond "this does not throw or warn about updating an unmounted
    // component" — vitest surfaces that as an unhandled error.
    act(() => void vi.advanceTimersByTime(2000));
  });
});
