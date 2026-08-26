import { describe, test, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import BattleSessionGuard from './BattleSessionGuard';
import { useBattleStore } from '@/stores/battleStore';
import type { BattleSessionFrontend, MonsterFrontend } from '@shared/types';

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

let go!: (to: string) => void;
function Navigator() {
  const navigate = useNavigate();
  go = (to: string) => navigate(to);
  return null;
}

function mountAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BattleSessionGuard />
      <Navigator />
      <Routes>
        <Route path="/battle" element={<div>battle</div>} />
        <Route path="/inventory" element={<div>inventory</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => useBattleStore.getState().reset());

describe('BattleSessionGuard', () => {
  test('resets an in-flight attempt when leaving /battle', () => {
    mountAt('/battle');
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');

    act(() => go('/inventory'));

    expect(useBattleStore.getState().state.phase).toBe('idle');
  });

  test('resets from completing too', () => {
    mountAt('/battle');
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().submissionStarted();

    act(() => go('/inventory'));

    expect(useBattleStore.getState().state.phase).toBe('idle');
  });

  test('preserves unclaimed loot when leaving during lootSelection', () => {
    // The server already rolled this loot; start-battle's restore path recovers it.
    mountAt('/battle');
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().submissionStarted();
    useBattleStore.getState().lootOffered([]);

    act(() => go('/inventory'));

    expect(useBattleStore.getState().state.phase).toBe('lootSelection');
  });

  test('preserves the victory screen', () => {
    mountAt('/battle');
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().submissionStarted();
    useBattleStore.getState().lootOffered([]);
    useBattleStore.getState().lootResolved();

    act(() => go('/inventory'));

    expect(useBattleStore.getState().state.phase).toBe('victory');
  });

  test('does not reset while staying on /battle', () => {
    // This is the regression the guard exists for: MonsterBattleSection used to reset on its
    // own unmount, so any remount mid-battle destroyed the fight.
    const { rerender } = mountAt('/battle');
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');

    act(() => go('/battle'));
    rerender(
      <MemoryRouter initialEntries={['/battle']}>
        <BattleSessionGuard />
        <Routes><Route path="/battle" element={<div>battle</div>} /></Routes>
      </MemoryRouter>
    );

    expect(useBattleStore.getState().state.phase).toBe('inProgress');
  });

  test('does nothing when arriving at /battle from elsewhere', () => {
    mountAt('/inventory');

    act(() => go('/battle'));

    expect(useBattleStore.getState().state.phase).toBe('idle');
  });
});
