import type { LootItem } from '@shared/loot-table';
import type { MonsterFrontend, BattleSessionFrontend } from '@shared/types';
import { useBattleStore, sessionOf, type BattleState } from '@/stores/battleStore';
import type { BattleAttempt } from '@/stores/battleAttempt';

/**
 * Legacy phase names. The store's union is the source of truth; these strings survive
 * because MonsterBattleSection compares against them directly in eleven places.
 * NEXT_MONSTER_READY was defined but never entered, and has been removed.
 */
export enum GameState {
  INITIALIZING = 'INITIALIZING',
  BATTLE_LOADING = 'BATTLE_LOADING',
  BATTLE_START_SCREEN = 'BATTLE_START_SCREEN',
  BATTLE_IN_PROGRESS = 'BATTLE_IN_PROGRESS',
  BATTLE_COMPLETING = 'BATTLE_COMPLETING',
  LOOT_SELECTION = 'LOOT_SELECTION',
  BATTLE_VICTORY = 'BATTLE_VICTORY',
  PLAYER_DEFEATED = 'PLAYER_DEFEATED',
}

const PHASE_TO_LEGACY: Record<BattleState['phase'], GameState> = {
  idle: GameState.INITIALIZING,
  loading: GameState.BATTLE_LOADING,
  startScreen: GameState.BATTLE_START_SCREEN,
  inProgress: GameState.BATTLE_IN_PROGRESS,
  completing: GameState.BATTLE_COMPLETING,
  lootSelection: GameState.LOOT_SELECTION,
  victory: GameState.BATTLE_VICTORY,
  defeated: GameState.PLAYER_DEFEATED,
};

/**
 * Flat projection over the battle store.
 *
 * Reads stay nullable so existing call sites compile unchanged; the union's guarantees
 * are enforced on the write side, where the bugs were. Narrowing the reads is deferred
 * to the UI rewrite, which rewrites these call sites anyway.
 */
export function useGameState() {
  const state = useBattleStore(s => s.state);
  const store = useBattleStore.getState();

  const session: BattleSessionFrontend | null = sessionOf(state);
  const monster: MonsterFrontend | null = session?.monster ?? null;
  const lootOptions: LootItem[] | null = state.phase === 'lootSelection' ? state.loot : null;
  const attempt: BattleAttempt | null =
    state.phase === 'inProgress' || state.phase === 'completing' ? state.attempt : null;
  const outcome = state.phase === 'defeated' ? state.outcome : null;

  const phase = PHASE_TO_LEGACY[state.phase];

  return {
    gameState: phase,
    monster,
    session,
    lootOptions,
    attempt,
    outcome,

    // Events
    loadingStarted: store.loadingStarted,
    sessionLoaded: store.sessionLoaded,
    battleStarted: store.battleStarted,
    submissionStarted: store.submissionStarted,
    submissionFailed: store.submissionFailed,
    attemptRestarted: store.attemptRestarted,
    lootOffered: store.lootOffered,
    lootResolved: store.lootResolved,
    playerDefeated: store.playerDefeated,
    updateSession: store.sessionUpdated,
    reset: store.reset,
    addToAttempt: store.addToAttempt,
    patchAttempt: store.patchAttempt,

    // Query helpers
    isLoading: () => phase === GameState.INITIALIZING || phase === GameState.BATTLE_LOADING,
    canStartBattle: () => phase === GameState.INITIALIZING,
    canAttackMonster: () => phase === GameState.BATTLE_IN_PROGRESS,
    canShowLootModal: () => phase === GameState.LOOT_SELECTION,
    canShowNextMonsterButton: () => phase === GameState.BATTLE_VICTORY,
    canShowDefeatScreen: () => phase === GameState.PLAYER_DEFEATED,
  };
}
