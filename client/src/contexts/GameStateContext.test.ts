import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameState, GameState } from './GameStateContext';
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

beforeEach(() => useBattleStore.getState().reset());

describe('useGameState adapter', () => {
  test('projects idle to the legacy INITIALIZING enum', () => {
    const { result } = renderHook(() => useGameState());

    expect(result.current.gameState).toBe(GameState.INITIALIZING);
    expect(result.current.session).toBeNull();
    expect(result.current.monster).toBeNull();
    expect(result.current.attempt).toBeNull();
  });

  test('projects inProgress to BATTLE_IN_PROGRESS and exposes session, monster and attempt', () => {
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    const { result } = renderHook(() => useGameState());

    expect(result.current.gameState).toBe(GameState.BATTLE_IN_PROGRESS);
    expect(result.current.session?._id).toBe('session-1');
    expect(result.current.monster?.name).toBe('Forest Wolf');
    expect(result.current.attempt?.totalDamage).toBe(0);
    expect(result.current.canAttackMonster()).toBe(true);
  });

  test('projects completing to BATTLE_COMPLETING, which MBS compares as a string', () => {
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().submissionStarted();
    const { result } = renderHook(() => useGameState());

    expect(result.current.gameState).toBe('BATTLE_COMPLETING');
    expect(result.current.canAttackMonster()).toBe(false);
  });

  test('exposes no attempt outside a battle', () => {
    useBattleStore.getState().sessionLoaded(session(), 'startScreen');
    const { result } = renderHook(() => useGameState());

    expect(result.current.gameState).toBe(GameState.BATTLE_START_SCREEN);
    expect(result.current.attempt).toBeNull();
  });

  test('reports the defeat screen for either outcome', () => {
    useBattleStore.getState().sessionLoaded(session(), 'inProgress');
    useBattleStore.getState().playerDefeated('escape');
    const { result } = renderHook(() => useGameState());

    expect(result.current.gameState).toBe(GameState.PLAYER_DEFEATED);
    expect(result.current.canShowDefeatScreen()).toBe(true);
    expect(result.current.outcome).toBe('escape');
  });

  test('isLoading covers both idle and loading', () => {
    const { result, rerender } = renderHook(() => useGameState());
    expect(result.current.isLoading()).toBe(true);

    useBattleStore.getState().sessionLoaded(session(), 'startScreen');
    rerender();
    expect(result.current.isLoading()).toBe(false);

    useBattleStore.getState().loadingStarted();
    rerender();
    expect(result.current.isLoading()).toBe(true);
  });
});
