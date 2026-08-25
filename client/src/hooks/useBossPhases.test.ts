import { describe, test, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBossPhases } from './useBossPhases';
import type { MonsterFrontend } from '@shared/types';

vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { default: toast, toast };
});

function boss(overrides: Partial<MonsterFrontend> = {}): MonsterFrontend {
  return {
    _id: 'boss-1',
    name: 'Treant Guardian',
    clicksRequired: 100,
    attackDamage: 8,
    rarity: 'epic',
    biome: 'forest',
    tier: 1,
    isBoss: true,
    bossPhases: [{ hpThreshold: 50, message: 'Phase 2!', specialAttacks: [] }],
    ...overrides,
  } as MonsterFrontend;
}

describe('useBossPhases', () => {
  test('initialises the first phase HP bar from clicksRequired', () => {
    const { result } = renderHook(() => useBossPhases({ monster: boss(), battleStarted: true, isSubmitting: false }));

    // One threshold at 50% -> first bar is the top half of total HP.
    expect(result.current.maxPhaseHP).toBe(50);
    expect(result.current.currentPhaseHP).toBe(50);
  });

  test('re-initialises when clicksRequired changes on the same boss', () => {
    // This is the free-win path: after a cheat flag the phase HP was already 0, so the boss
    // defeat effect fired immediately and resubmitted with zero damage. The server skips the
    // damage floor for bosses, so it settled as a legitimate victory.
    const { result, rerender } = renderHook(
      ({ m }) => useBossPhases({ monster: m, battleStarted: true, isSubmitting: false }),
      { initialProps: { m: boss({ clicksRequired: 100 }) } }
    );

    act(() => result.current.damagePhase(50));
    expect(result.current.currentPhaseHP).toBe(0);

    rerender({ m: boss({ clicksRequired: 200 }) });

    expect(result.current.maxPhaseHP).toBe(100);
    expect(result.current.currentPhaseHP).toBe(100);
  });
});
