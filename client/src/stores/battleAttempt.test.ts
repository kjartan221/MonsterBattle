import { describe, test, expect } from 'vitest';
import { freshAttempt, ACCUMULATOR_KEYS, escapeDeadlineFrom } from './battleAttempt';

describe('freshAttempt', () => {
  test('zeroes every anti-cheat accumulator', () => {
    const attempt = freshAttempt();

    ACCUMULATOR_KEYS.forEach(key => expect(attempt[key]).toBe(0));
  });

  test('uses the correct non-zero defaults for combat modifiers', () => {
    const attempt = freshAttempt();

    expect(attempt.damageWindow).toBe(1.0);   // multiplier, not a counter
    expect(attempt.lastHPPercent).toBe(100);
    expect(attempt.escapeAt).toBeNull();
    expect(attempt.isStunned).toBe(false);
    expect(attempt.stunStartTime).toBe(0);
    expect(attempt.stunEndTime).toBe(0);
    expect(attempt.damageWindowEndTime).toBe(0);
    expect(attempt.shieldHP).toBe(0);
  });

  test('gives each attempt its own mutable collections', () => {
    // Sharing a Set or array between attempts would leak boss thresholds and
    // monster debuffs across battles - the exact class of bug this store removes.
    const a = freshAttempt();
    const b = freshAttempt();

    a.triggeredThresholds.add(50);
    a.monsterDebuffs.push({ id: 'd1', type: 'poison', duration: 5000, startTime: 0, expiresAt: 5000 });

    expect(b.triggeredThresholds.size).toBe(0);
    expect(b.monsterDebuffs).toHaveLength(0);
  });
});

describe('escapeDeadlineFrom', () => {
  // Pins the pre-refactor check-then-decrement timing exactly: a Fast buff of value V
  // escaped after V+1 seconds, not V, because the old loop checked `escapeTimer <= 0`
  // BEFORE decrementing on each tick.
  test('a 1-second buff yields a deadline 2000ms out', () => {
    expect(escapeDeadlineFrom(0, 1)).toBe(2000);
  });

  test('a 30-second buff yields a deadline 31000ms out', () => {
    expect(escapeDeadlineFrom(0, 30)).toBe(31000);
  });

  test('is relative to the supplied now, not wall-clock time', () => {
    expect(escapeDeadlineFrom(5000, 10)).toBe(5000 + 11000);
  });
});
