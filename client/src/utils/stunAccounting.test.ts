import { describe, test, expect } from 'vitest';
import { elapsedStunTime } from './stunAccounting';

// The server reconstructs how long the monster was actually attacking from the stun time the
// client reports. Under-reporting inflates expected monster damage and can trip the HP-cheat
// check on legitimate players, so these numbers have to be the real elapsed stun.
describe('elapsedStunTime', () => {
  test('reports the full stun when it ran to completion', () => {
    expect(elapsedStunTime({ startedAt: 10_000, endsAt: 12_000, now: 12_000 })).toBe(2_000);
  });

  test('reports the full stun when the expiry sweep observes it late', () => {
    // The sweep polls every 100ms, so `now` is usually past endsAt. That overshoot is not stun time.
    expect(elapsedStunTime({ startedAt: 10_000, endsAt: 12_000, now: 12_090 })).toBe(2_000);
  });

  test('reports only the elapsed portion when the stun is cleared early', () => {
    // Death, cheat reset and battle end all clear the stun before it expires.
    expect(elapsedStunTime({ startedAt: 10_000, endsAt: 12_000, now: 10_750 })).toBe(750);
  });

  test('returns 0 when no stun was active', () => {
    expect(elapsedStunTime({ startedAt: 0, endsAt: 0, now: 12_000 })).toBe(0);
  });

  test('never returns a negative duration if the clock moves backwards', () => {
    expect(elapsedStunTime({ startedAt: 10_000, endsAt: 12_000, now: 9_000 })).toBe(0);
  });
});
