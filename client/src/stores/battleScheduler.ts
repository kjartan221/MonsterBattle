import { Scheduler, systemClock } from './scheduler';
import { useBattleStore, type BattleState } from './battleStore';

/** The one scheduler the battle uses. */
export const battleScheduler = new Scheduler(systemClock);

function carriesAttempt(phase: BattleState['phase']): boolean {
  return phase === 'inProgress' || phase === 'completing';
}

/**
 * Ties the scheduler's registrations to the attempt's lifetime.
 *
 * Leaving inProgress/completing clears everything, so no combat handler can outlive the battle
 * it belongs to. Returns an unsubscribe function.
 *
 * EXCEPTION: player buffs (`buff:*`, registered by usePlayerBuffs) are page-level state that
 * deliberately outlives a single attempt, so clearing them here is wrong. Because `clearAll` is
 * indiscriminate, that hook works around it by re-registering its deadlines from a React effect
 * keyed on the store phase. `at` takes an absolute deadline, so re-registering is idempotent and
 * loses no time: a deadline that passes inside the cancel/re-register gap simply fires on the
 * next base tick.
 *
 * That workaround is load-bearing on two invariants this function must preserve:
 *   1. Every `clearAll()` here coincides with an observable change to `state.phase`, so a
 *      component subscribed to the phase is guaranteed a commit in which to re-register.
 *   2. No code path leaves and re-enters an attempt-bearing phase within a single React batch.
 *      If one did, the phase a subscriber reads after the batch would equal the phase before it,
 *      no re-render would occur, and the cleared buff deadlines would never come back.
 *
 * The real fix is to scope the registry (or give `clearAll` a key predicate) so `buff:*` is never
 * cleared in the first place; until then, do not add a clear that is invisible in `state.phase`.
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
