import { create } from 'zustand';
import type { BattleSessionFrontend } from '@shared/types';
import type { LootItem } from '@shared/loot-table';
import { BattleAttempt, AccumulatorKey, freshAttempt } from './battleAttempt';

type Session = BattleSessionFrontend;

export type BattlePhase =
  | 'idle' | 'loading' | 'startScreen' | 'inProgress'
  | 'completing' | 'lootSelection' | 'victory' | 'defeated';

/** `attempt` exists in exactly two phases, so it cannot survive a battle boundary. */
export type BattleState =
  | { phase: 'idle' }
  | { phase: 'loading'; session: Session | null }
  | { phase: 'startScreen'; session: Session }
  | { phase: 'inProgress'; session: Session; attempt: BattleAttempt }
  | { phase: 'completing'; session: Session; attempt: BattleAttempt }
  | { phase: 'lootSelection'; session: Session; loot: LootItem[] }
  | { phase: 'victory'; session: Session }
  | { phase: 'defeated'; session: Session; outcome: 'death' | 'escape' };

/** Session carried by whichever phase we are in, or null in idle. */
export function sessionOf(state: BattleState): Session | null {
  return state.phase === 'idle' ? null : state.session;
}

function attemptOf(state: BattleState): BattleAttempt | null {
  return state.phase === 'inProgress' || state.phase === 'completing' ? state.attempt : null;
}

interface BattleStore {
  state: BattleState;
  loadingStarted: () => void;
  sessionLoaded: (session: Session, mode: 'startScreen' | 'inProgress') => void;
  submissionStarted: () => void;
  lootOffered: (loot: LootItem[]) => void;
  lootResolved: () => void;
  playerDefeated: (outcome: 'death' | 'escape') => void;
  sessionUpdated: (session: Session) => void;
  addToAttempt: (key: AccumulatorKey, delta: number) => void;
  battleStarted: () => void;
  submissionFailed: () => void;
  attemptRestarted: (newClicksRequired: number) => void;
  patchAttempt: (partial: Partial<BattleAttempt>) => void;
  reset: () => void;
}

export const useBattleStore = create<BattleStore>((set, get) => ({
  state: { phase: 'idle' },

  loadingStarted: () =>
    set({ state: { phase: 'loading', session: sessionOf(get().state) } }),

  // Only a fetch can seed a session, and every fetch goes through `loadingStarted` first.
  // Refusing the other phases stops a stray caller from stomping a live attempt.
  sessionLoaded: (session, mode) => {
    const s = get().state;
    if (s.phase !== 'idle' && s.phase !== 'loading') return;
    set({
      state: mode === 'inProgress'
        ? { phase: 'inProgress', session, attempt: freshAttempt() }
        : { phase: 'startScreen', session },
    });
  },

  submissionStarted: () => {
    const s = get().state;
    if (s.phase !== 'inProgress') return;
    set({ state: { phase: 'completing', session: s.session, attempt: s.attempt } });
  },

  lootOffered: (loot) => {
    const s = get().state;
    // Victory, plus the pending-loot restore (which seeds the session onto startScreen).
    // Anything else - `defeated` above all - must not be dragged in by a late POST.
    if (s.phase !== 'completing' && s.phase !== 'startScreen') return;
    set({ state: { phase: 'lootSelection', session: s.session, loot } });
  },

  lootResolved: () => {
    const s = get().state;
    if (s.phase !== 'lootSelection') return;
    set({ state: { phase: 'victory', session: s.session } });
  },

  playerDefeated: (outcome) => {
    const session = sessionOf(get().state);
    if (!session) return;
    set({ state: { phase: 'defeated', session, outcome } });
  },

  sessionUpdated: (session) => {
    const s = get().state;
    if (s.phase === 'idle') return;
    set({ state: { ...s, session } as BattleState });
  },

  addToAttempt: (key, delta) => {
    const s = get().state;
    const attempt = attemptOf(s);
    if (!attempt) return;
    const next = { ...attempt, [key]: Math.max(0, attempt[key] + delta) };
    set({ state: { ...s, attempt: next } as BattleState });
  },

  battleStarted: () => {
    const s = get().state;
    if (s.phase !== 'startScreen') return;
    set({ state: { phase: 'inProgress', session: s.session, attempt: freshAttempt() } });
  },

  // The submission failed; the player is still fighting. Keep their progress.
  submissionFailed: () => {
    const s = get().state;
    if (s.phase !== 'completing') return;
    set({ state: { phase: 'inProgress', session: s.session, attempt: s.attempt } });
  },

  // Cheat penalty: restart the fight at double HP. Raising clicksRequired here is what
  // makes the HP hooks re-initialise, since they key on `id:clicksRequired`.
  attemptRestarted: (newClicksRequired) => {
    const s = get().state;
    if (s.phase !== 'completing' && s.phase !== 'inProgress') return;
    const session = s.session.monster
      ? { ...s.session, monster: { ...s.session.monster, clicksRequired: newClicksRequired } }
      : s.session;
    set({ state: { phase: 'inProgress', session, attempt: freshAttempt() } });
  },

  patchAttempt: (partial) => {
    const s = get().state;
    const attempt = attemptOf(s);
    if (!attempt) return;
    set({ state: { ...s, attempt: { ...attempt, ...partial } } as BattleState });
  },

  reset: () => set({ state: { phase: 'idle' } }),
}));
