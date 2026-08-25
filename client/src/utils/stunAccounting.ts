export interface StunWindow {
  /** Timestamp the stun was applied. 0 means no stun was active. */
  startedAt: number;
  /** Timestamp the stun is scheduled to end. */
  endsAt: number;
  /** Timestamp of observation — the expiry sweep, or whatever cleared the stun early. */
  now: number;
}

/**
 * Actual milliseconds the monster spent stunned.
 *
 * Clamped at `endsAt` so the 100ms polling overshoot isn't counted, and at `now` so a stun
 * cleared early (death, cheat reset, battle end) only reports the portion that elapsed.
 */
export function elapsedStunTime({ startedAt, endsAt, now }: StunWindow): number {
  if (startedAt <= 0) return 0;
  return Math.max(0, Math.min(now, endsAt) - startedAt);
}
