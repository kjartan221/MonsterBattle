import { describe, test, expect, vi } from 'vitest';
import { Scheduler, type Clock } from './scheduler';

function fakeClock(start = 0) {
  let t = start;
  const clock: Clock = { now: () => t };
  return { clock, advance: (ms: number) => { t += ms; } };
}

describe('Scheduler', () => {
  test('fires a one-shot deadline once, then forgets it', () => {
    const { clock, advance } = fakeClock(1000);
    const s = new Scheduler(clock);
    const fn = vi.fn();

    s.at('stun', 1500, fn);
    s.tick();
    expect(fn).not.toHaveBeenCalled();

    advance(600);
    s.tick();
    s.tick();
    s.tick();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.has('stun')).toBe(false);
  });

  test('a deadline already in the past fires once, not repeatedly', () => {
    const { clock } = fakeClock(5000);
    const s = new Scheduler(clock);
    const fn = vi.fn();

    s.at('late', 1000, fn); // already overdue
    s.tick();
    s.tick();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('repeat recomputes its delay after every fire', () => {
    // The monster swing interval changes when equipment changes mid-battle.
    const { clock, advance } = fakeClock(0);
    const s = new Scheduler(clock);
    const fn = vi.fn();
    let delay = 1000;

    s.repeat('swing', () => delay, fn);

    advance(1000); s.tick();
    expect(fn).toHaveBeenCalledTimes(1);

    delay = 200; // equipment changed

    advance(200); s.tick();
    expect(fn).toHaveBeenCalledTimes(2);

    advance(200); s.tick();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('repeat schedules from the intended deadline, so error does not accumulate', () => {
    const { clock, advance } = fakeClock(0);
    const s = new Scheduler(clock);
    const fired: number[] = [];

    s.repeat('tick', () => 1000, () => fired.push(clock.now()));

    // Base ticker granularity means we observe late: 1050 rather than 1000.
    advance(1050); s.tick();
    advance(1000); s.tick(); // now 2050; the 2000 deadline is due

    expect(fired).toEqual([1050, 2050]);
    // Drift-corrected: the second deadline was 2000, not 1050 + 1000 = 2050... it fires
    // at the first tick at-or-past 2000, and the NEXT deadline is 3000, not 3050.
    advance(950); s.tick(); // now 3000
    expect(fired).toHaveLength(3);
  });

  test('re-registering a key replaces it rather than double-firing', () => {
    const { clock, advance } = fakeClock(0);
    const s = new Scheduler(clock);
    const first = vi.fn();
    const second = vi.fn();

    s.at('escape', 1000, first);
    s.at('escape', 1000, second);

    advance(1000);
    s.tick();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(s.size()).toBe(0);
  });

  test('cancel removes a registration before it fires', () => {
    const { clock, advance } = fakeClock(0);
    const s = new Scheduler(clock);
    const fn = vi.fn();

    s.at('escape', 1000, fn);
    s.cancel('escape');
    advance(2000);
    s.tick();

    expect(fn).not.toHaveBeenCalled();
  });

  test('clearAll removes everything, repeats included', () => {
    const { clock, advance } = fakeClock(0);
    const s = new Scheduler(clock);
    const a = vi.fn();
    const b = vi.fn();

    s.repeat('swing', () => 500, a);
    s.at('stun', 800, b);
    s.clearAll();
    advance(2000);
    s.tick();

    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    expect(s.size()).toBe(0);
  });

  test('a key cancelled by another handler does not fire in the same tick', () => {
    // submitBattleCompletion runs inside the autohit handler and cancels sibling loops.
    // A cancellation issued mid-tick must be authoritative for entries not yet reached.
    const { clock, advance } = fakeClock(0);
    const s = new Scheduler(clock);
    const victim = vi.fn();

    // Map iteration is insertion-ordered, so the canceller is reached first.
    s.at('canceller', 100, () => s.cancel('victim'));
    s.at('victim', 100, victim);

    advance(100);
    s.tick();

    expect(victim).not.toHaveBeenCalled();
    expect(s.has('victim')).toBe(false);
    expect(s.size()).toBe(0);
  });

  test('clearAll from inside a handler empties the registry, resurrecting nothing', () => {
    // The repeat entry is due in this same tick: the old code re-anchored it from a stale
    // snapshot AFTER clearAll ran, leaving an orphan no owner could ever cancel.
    const { clock, advance } = fakeClock(0);
    const s = new Scheduler(clock);
    const swing = vi.fn();
    const dot = vi.fn();

    s.at('submit', 100, () => s.clearAll());
    s.repeat('swing', () => 100, swing);
    s.at('debuffDot:poison', 100, dot);

    advance(100);
    s.tick();

    expect(swing).not.toHaveBeenCalled();
    expect(dot).not.toHaveBeenCalled();
    expect(s.has('swing')).toBe(false);
    expect(s.size()).toBe(0);

    // And nothing keeps firing afterwards.
    advance(1000);
    s.tick();
    expect(s.size()).toBe(0);
    expect(swing).not.toHaveBeenCalled();
  });

  test('a repeat handler that cancels itself still wins', () => {
    const { clock, advance } = fakeClock(0);
    const s = new Scheduler(clock);
    const fn = vi.fn(() => s.cancel('swing'));

    s.repeat('swing', () => 100, fn);

    advance(100);
    s.tick();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.has('swing')).toBe(false);

    advance(1000);
    s.tick();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('a throwing handler does not stop the other registrations', () => {
    const { clock, advance } = fakeClock(0);
    const s = new Scheduler(clock);
    const survivor = vi.fn();

    s.at('boom', 100, () => { throw new Error('handler blew up'); });
    s.at('ok', 100, survivor);

    advance(100);
    expect(() => s.tick()).not.toThrow();
    expect(survivor).toHaveBeenCalledTimes(1);
  });
});
