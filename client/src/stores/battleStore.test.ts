import { describe, test, expect, beforeEach } from 'vitest';
import { useBattleStore } from './battleStore';
import type { BattleSessionFrontend, MonsterFrontend } from '@shared/types';
import type { LootItem } from '@shared/loot-table';

function monster(overrides: Partial<MonsterFrontend> = {}): MonsterFrontend {
  return {
    _id: 'monster-1', name: 'Forest Wolf', imageUrl: '', clicksRequired: 100,
    attackDamage: 5, rarity: 'common', biome: 'forest', tier: 1,
    moveInterval: 1000, createdAt: new Date(), ...overrides,
  } as MonsterFrontend;
}

function session(overrides: Partial<BattleSessionFrontend> = {}): BattleSessionFrontend {
  return {
    _id: 'session-1', userId: 'user-1', biome: 'forest', tier: 1,
    clickCount: 0, isDefeated: false, startedAt: new Date(),
    monster: monster(), ...overrides,
  } as BattleSessionFrontend;
}

const loot: LootItem[] = [];

beforeEach(() => useBattleStore.getState().reset());

describe('battleStore phase transitions', () => {
  test('starts idle', () => {
    expect(useBattleStore.getState().state.phase).toBe('idle');
  });

  test('loadingStarted keeps the previous session while the next one is fetched', () => {
    const store = useBattleStore.getState();
    store.sessionLoaded(session(), 'startScreen');
    store.loadingStarted();

    const state = useBattleStore.getState().state;
    expect(state.phase).toBe('loading');
    if (state.phase !== 'loading') throw new Error('wrong phase');
    expect(state.session?._id).toBe('session-1');
  });

  test('sessionLoaded in startScreen mode does not create an attempt', () => {
    useBattleStore.getState().sessionLoaded(session(), 'startScreen');

    const state = useBattleStore.getState().state;
    expect(state.phase).toBe('startScreen');
    expect('attempt' in state).toBe(false);
  });

  test('sessionLoaded in inProgress mode creates a fresh attempt', () => {
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');

    const state = useBattleStore.getState().state;
    if (state.phase !== 'inProgress') throw new Error('wrong phase');
    expect(state.attempt.totalDamage).toBe(0);
    expect(state.attempt.clickCount).toBe(0);
  });

  test('submissionStarted preserves the attempt', () => {
    const store = useBattleStore.getState();
    store.sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().addToAttempt('totalDamage', 42);
    useBattleStore.getState().submissionStarted();

    const state = useBattleStore.getState().state;
    if (state.phase !== 'completing') throw new Error('wrong phase');
    expect(state.attempt.totalDamage).toBe(42);
  });

  test('lootOffered moves to lootSelection and drops the attempt', () => {
    const store = useBattleStore.getState();
    store.sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().submissionStarted();
    useBattleStore.getState().lootOffered(loot);

    const state = useBattleStore.getState().state;
    expect(state.phase).toBe('lootSelection');
    expect('attempt' in state).toBe(false);
  });

  // `loading` is not one of the two legitimate entrances (completing, startScreen), even
  // when it still carries the previous session. The restore path seeds startScreen first.
  test('lootOffered is rejected from loading even when a session is still held', () => {
    const store = useBattleStore.getState();
    store.sessionLoaded(session(), 'startScreen');
    useBattleStore.getState().loadingStarted();
    useBattleStore.getState().lootOffered(loot);

    expect(useBattleStore.getState().state.phase).toBe('loading');
  });

  // Cold-load refresh recovery: the page reloads with the loot modal open, so the store
  // starts at idle and the session has to be seeded before the loot can be offered.
  test('lootOffered reaches lootSelection on a cold load once the session is seeded', () => {
    const store = useBattleStore.getState();
    store.loadingStarted();
    useBattleStore.getState().sessionLoaded(session(), 'startScreen');
    useBattleStore.getState().lootOffered(loot);

    const state = useBattleStore.getState().state;
    expect(state.phase).toBe('lootSelection');
    if (state.phase !== 'lootSelection') throw new Error('wrong phase');
    expect(state.session._id).toBe('session-1');
  });

  // The trap this documents: lootOffered only fires from `completing` or `startScreen`, and
  // silently no-ops elsewhere. Skipping the seed leaves the store in `loading`, which renders
  // as a spinner forever.
  test('lootOffered no-ops from loading when the seed step is skipped', () => {
    useBattleStore.getState().loadingStarted();
    useBattleStore.getState().lootOffered(loot);

    const state = useBattleStore.getState().state;
    expect(state.phase).toBe('loading');
    if (state.phase !== 'loading') throw new Error('wrong phase');
    expect(state.session).toBeNull();
  });

  // The death/victory race: handlePlayerDeath awaits /api/end-battle while an auto-hit
  // finishes the monster. If end-battle resolves first, the late attack-monster response
  // must not hand the player loot on top of the death penalty.
  test('lootOffered cannot resurrect a defeated battle into lootSelection', () => {
    const store = useBattleStore.getState();
    store.sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().submissionStarted();
    useBattleStore.getState().playerDefeated('death');
    useBattleStore.getState().lootOffered(loot);

    const state = useBattleStore.getState().state;
    expect(state.phase).toBe('defeated');
    if (state.phase !== 'defeated') throw new Error('wrong phase');
    expect(state.outcome).toBe('death');
  });

  test('lootResolved moves to victory', () => {
    const store = useBattleStore.getState();
    store.sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().submissionStarted();
    useBattleStore.getState().lootOffered(loot);
    useBattleStore.getState().lootResolved();

    expect(useBattleStore.getState().state.phase).toBe('victory');
  });

  test('playerDefeated records why the battle ended', () => {
    const store = useBattleStore.getState();
    store.sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().playerDefeated('escape');

    const state = useBattleStore.getState().state;
    if (state.phase !== 'defeated') throw new Error('wrong phase');
    expect(state.outcome).toBe('escape');
    expect('attempt' in state).toBe(false);
  });

  test('sessionUpdated replaces the session without changing phase', () => {
    const store = useBattleStore.getState();
    store.sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().addToAttempt('clickCount', 3);
    useBattleStore.getState().sessionUpdated(session({ isDefeated: true }));

    const state = useBattleStore.getState().state;
    if (state.phase !== 'inProgress') throw new Error('wrong phase');
    expect(state.session.isDefeated).toBe(true);
    expect(state.attempt.clickCount).toBe(3); // attempt survives a session update
  });
});

describe('the three ways into inProgress', () => {
  test('battleStarted begins a fresh attempt from the start screen', () => {
    useBattleStore.getState().sessionLoaded(session(), 'startScreen');
    useBattleStore.getState().battleStarted();

    const state = useBattleStore.getState().state;
    if (state.phase !== 'inProgress') throw new Error('wrong phase');
    expect(state.attempt.totalDamage).toBe(0);
  });

  test('submissionFailed returns to the fight with the attempt intact', () => {
    // The player is mid-battle and the POST failed. Wiping their progress here
    // would be a worse bug than the one this store removes.
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().addToAttempt('totalDamage', 73);
    useBattleStore.getState().addToAttempt('clickCount', 12);
    useBattleStore.getState().submissionStarted();
    useBattleStore.getState().submissionFailed();

    const state = useBattleStore.getState().state;
    if (state.phase !== 'inProgress') throw new Error('wrong phase');
    expect(state.attempt.totalDamage).toBe(73);
    expect(state.attempt.clickCount).toBe(12);
  });

  test('attemptRestarted zeroes the attempt and doubles the monster HP', () => {
    useBattleStore.getState().sessionLoaded(session({ monster: monster({ clicksRequired: 100 }) }), 'inProgress');
    useBattleStore.getState().addToAttempt('totalDamage', 500);
    useBattleStore.getState().addToAttempt('totalHealing', 40);
    useBattleStore.getState().submissionStarted();
    useBattleStore.getState().attemptRestarted(200);

    const state = useBattleStore.getState().state;
    if (state.phase !== 'inProgress') throw new Error('wrong phase');
    expect(state.attempt.totalDamage).toBe(0);
    expect(state.attempt.totalHealing).toBe(0);
    expect(state.session.monster?.clicksRequired).toBe(200);
  });

  test('a battle after a death carries none of the previous attempt', () => {
    // Bug 1 as a store-level invariant rather than three separate call-site fixes.
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().addToAttempt('totalHealing', 99);
    useBattleStore.getState().addToAttempt('invulnerabilityTime', 5000);
    useBattleStore.getState().addToAttempt('thornsDamage', 30);
    useBattleStore.getState().playerDefeated('death');
    useBattleStore.getState().loadingStarted();
    useBattleStore.getState().sessionLoaded(session({ _id: 'session-2' }), 'inProgress');

    const state = useBattleStore.getState().state;
    if (state.phase !== 'inProgress') throw new Error('wrong phase');
    expect(state.attempt.totalHealing).toBe(0);
    expect(state.attempt.invulnerabilityTime).toBe(0);
    expect(state.attempt.thornsDamage).toBe(0);
  });
});

describe('attempt mutators', () => {
  test('addToAttempt clamps at zero when the monster heals', () => {
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().addToAttempt('totalDamage', 5);
    useBattleStore.getState().addToAttempt('totalDamage', -20);

    const state = useBattleStore.getState().state;
    if (state.phase !== 'inProgress') throw new Error('wrong phase');
    expect(state.attempt.totalDamage).toBe(0);
  });

  test('mutators are no-ops outside a battle', () => {
    useBattleStore.getState().sessionLoaded(session(), 'startScreen');
    useBattleStore.getState().addToAttempt('totalDamage', 10);
    useBattleStore.getState().patchAttempt({ shieldHP: 50 });

    const state = useBattleStore.getState().state;
    expect(state.phase).toBe('startScreen');
    // Phase alone would not catch a mutator that spread an attempt onto startScreen.
    expect('attempt' in state).toBe(false);
  });

  test('patchAttempt replaces the threshold Set rather than mutating it', () => {
    // Zustand compares by reference; mutating the Set in place would not notify subscribers.
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    const before = (useBattleStore.getState().state as { attempt: { triggeredThresholds: Set<number> } }).attempt.triggeredThresholds;

    useBattleStore.getState().patchAttempt({ triggeredThresholds: new Set([50]) });

    const state = useBattleStore.getState().state;
    if (state.phase !== 'inProgress') throw new Error('wrong phase');
    expect(state.attempt.triggeredThresholds).not.toBe(before);
    expect(state.attempt.triggeredThresholds.has(50)).toBe(true);
  });
});

describe('combat modifiers live and die with the attempt', () => {
  test('a fresh attempt clears shield, escape timer, debuffs and thresholds', () => {
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().patchAttempt({
      shieldHP: 30,
      escapeTimer: 12,
      monsterDebuffs: [{ id: 'd1', type: 'poison', duration: 5000, startTime: 0 }],
      triggeredThresholds: new Set([50]),
      isStunned: true,
      damageWindow: 2.0,
    });

    // Death, then a new battle - the path that leaked in Bug 1.
    useBattleStore.getState().playerDefeated('death');
    useBattleStore.getState().loadingStarted();
    useBattleStore.getState().sessionLoaded(session({ _id: 'session-2' }), 'inProgress');

    const state = useBattleStore.getState().state;
    if (state.phase !== 'inProgress') throw new Error('wrong phase');
    expect(state.attempt.shieldHP).toBe(0);
    expect(state.attempt.escapeTimer).toBeNull();
    expect(state.attempt.monsterDebuffs).toHaveLength(0);
    expect(state.attempt.triggeredThresholds.size).toBe(0);
    expect(state.attempt.isStunned).toBe(false);
    expect(state.attempt.damageWindow).toBe(1.0);
  });

  test('a cheat restart clears the combat modifiers too', () => {
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().patchAttempt({ shieldHP: 30, monsterDebuffs: [{ id: 'd1', type: 'burn', duration: 4000, startTime: 0 }] });
    useBattleStore.getState().submissionStarted();
    useBattleStore.getState().attemptRestarted(200);

    const state = useBattleStore.getState().state;
    if (state.phase !== 'inProgress') throw new Error('wrong phase');
    expect(state.attempt.shieldHP).toBe(0);
    expect(state.attempt.monsterDebuffs).toHaveLength(0);
  });
});
