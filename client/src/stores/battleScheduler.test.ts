import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { battleScheduler, startBattleSchedulerLifetime } from './battleScheduler';
import { useBattleStore } from './battleStore';
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

let stop: () => void;
beforeEach(() => {
  useBattleStore.getState().reset();
  battleScheduler.clearAll();
  stop = startBattleSchedulerLifetime();
});
afterEach(() => {
  stop();
  battleScheduler.clearAll();
});

describe('scheduler lifetime', () => {
  test('leaving an attempt-bearing phase cancels every registration', () => {
    // This is the death-window DoT leak from the previous migration step, as an invariant:
    // a debuff applied to the old monster must not survive to tick into the next one.
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    battleScheduler.at('dot', Date.now() + 10_000, vi.fn());
    battleScheduler.repeat('swing', () => 1000, vi.fn());
    expect(battleScheduler.size()).toBe(2);

    useBattleStore.getState().playerDefeated('death');

    expect(battleScheduler.size()).toBe(0);
  });

  test('leaving via victory (completing -> lootSelection) cancels every registration', () => {
    // Same invariant as the death path, but via the win path: completing -> lootSelection
    // never touches `defeated`, so an implementation that only cleared on `defeated` would
    // leave these registered.
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    battleScheduler.at('dot', Date.now() + 10_000, vi.fn());
    battleScheduler.repeat('swing', () => 1000, vi.fn());
    expect(battleScheduler.size()).toBe(2);

    useBattleStore.getState().submissionStarted();
    useBattleStore.getState().lootOffered([]);

    expect(battleScheduler.size()).toBe(0);
  });

  test('registrations survive a transition that stays attempt-bearing', () => {
    // inProgress -> completing keeps the attempt, so in-flight work must not be cancelled.
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    battleScheduler.repeat('swing', () => 1000, vi.fn());

    useBattleStore.getState().submissionStarted();

    expect(battleScheduler.size()).toBe(1);
  });

  test('a fresh attempt starts with nothing registered', () => {
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    battleScheduler.at('stale', Date.now() + 10_000, vi.fn());
    useBattleStore.getState().playerDefeated('death');
    useBattleStore.getState().loadingStarted();
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');

    expect(battleScheduler.size()).toBe(0);
  });

  test('the lifetime subscription can be torn down', () => {
    stop();
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    battleScheduler.at('x', Date.now() + 10_000, vi.fn());

    useBattleStore.getState().playerDefeated('death');

    expect(battleScheduler.size()).toBe(1); // no longer watching
    battleScheduler.clearAll();
  });
});
