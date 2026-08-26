import { Scheduler, systemClock } from './scheduler';
import { useBattleStore, type BattleState } from './battleStore';

/** The one scheduler the battle uses. */
export const battleScheduler = new Scheduler(systemClock);

function carriesAttempt(phase: BattleState['phase']): boolean {
  return phase === 'inProgress' || phase === 'completing';
}

/**
 * Clears every registration when the attempt ends, so no combat handler outlives its battle.
 * Returns an unsubscribe.
 *
 * `clearAll` is indiscriminate, so it also takes `buff:*` - page-level state that should
 * outlive an attempt. usePlayerBuffs re-registers those from a phase-keyed effect, which
 * relies on two invariants preserved here: every clear coincides with an observable
 * `state.phase` change, and nothing leaves and re-enters an attempt-bearing phase within one
 * React batch. Proper fix is a key predicate on `clearAll`.
 */
export function startBattleSchedulerLifetime(): () => void {
  let wasAttemptBearing = carriesAttempt(useBattleStore.getState().state.phase);

  return useBattleStore.subscribe(({ state }) => {
    const isAttemptBearing = carriesAttempt(state.phase);
    if (wasAttemptBearing && !isAttemptBearing) {
      battleScheduler.clearAll();
    }
    wasAttemptBearing = isAttemptBearing;
  });
}
