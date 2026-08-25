import { describe, test, expect } from 'vitest';
import { freshAttempt, ACCUMULATOR_KEYS } from './battleAttempt';

describe('freshAttempt', () => {
  test('zeroes every anti-cheat accumulator', () => {
    const attempt = freshAttempt();

    ACCUMULATOR_KEYS.forEach(key => expect(attempt[key]).toBe(0));
  });

  test('uses the correct non-zero defaults for combat modifiers', () => {
    const attempt = freshAttempt();

    expect(attempt.damageWindow).toBe(1.0);   // multiplier, not a counter
    expect(attempt.lastHPPercent).toBe(100);
    expect(attempt.escapeTimer).toBeNull();
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
    a.monsterDebuffs.push({ id: 'd1', type: 'poison', duration: 5000, startTime: 0 });

    expect(b.triggeredThresholds.size).toBe(0);
    expect(b.monsterDebuffs).toHaveLength(0);
  });
});
