export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

type Entry =
  | { kind: 'once'; dueAt: number; handler: () => void }
  | { kind: 'repeat'; anchorAt: number; nextDelay: () => number; handler: () => void };

/**
 * A keyed timer registry driven by one base ticker.
 *
 * Replaces per-concern setInterval calls living in React effects, where a dependency array
 * was the only thing keeping a closure fresh. Handlers here read live state at fire time,
 * so there is nothing to go stale.
 */
export class Scheduler {
  private entries = new Map<string, Entry>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private clock: Clock = systemClock, private baseTickMs = 100) {}

  /**
   * Repeating work whose delay is recomputed every tick (e.g. equipment changes swing rate).
   *
   * CONTRACT: register once per logical loop and let `nextDelay` read live state to track
   * changes over time. Do NOT re-register (call `repeat` again with the same key) when that
   * state changes — re-registration resets the anchor and restarts the cadence, handing out a
   * free extra delay before the next fire. This is exactly the bug class this scheduler
   * replaces: intervals that got torn down and rebuilt on every debuff/state change.
   *
   * `nextDelay` is called on every base tick, so it must be side-effect-free and
   * deterministic for a given state — an RNG-backed or otherwise jittery delay would make the
   * deadline drift and fire nondeterministically early.
   */
  repeat(key: string, nextDelay: () => number, handler: () => void): void {
    this.entries.set(key, { kind: 'repeat', anchorAt: this.clock.now(), nextDelay, handler });
    this.start();
  }

  /** One-shot work at an absolute deadline. */
  at(key: string, deadlineMs: number, handler: () => void): void {
    this.entries.set(key, { kind: 'once', dueAt: deadlineMs, handler });
    this.start();
  }

  cancel(key: string): void {
    this.entries.delete(key);
    if (this.entries.size === 0) this.stop();
  }

  clearAll(): void {
    this.entries.clear();
    this.stop();
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  size(): number {
    return this.entries.size;
  }

  /** Fire everything due. The base ticker calls this; tests call it directly. */
  tick(): void {
    const now = this.clock.now();

    for (const key of [...this.entries.keys()]) {
      // Re-read rather than trusting the snapshot: a handler that already ran this tick may
      // have called cancel()/clearAll(), and that must be authoritative for the entries
      // still to come. Acting on a stale snapshot entry would also re-insert a cancelled
      // repeat key, orphaning it with no owner left to remove it.
      const entry = this.entries.get(key);
      if (!entry) continue;

      if (entry.kind === 'once') {
        if (entry.dueAt > now) continue;
        this.entries.delete(key);
        this.run(entry.handler);
        continue;
      }

      // Recompute the delay fresh every tick (not just after firing) so a change
      // (e.g. equipment swapped mid-battle) is picked up on the very next check.
      const delay = Math.max(1, entry.nextDelay());
      const due = entry.anchorAt + delay;
      if (due > now) continue;

      // Schedule from the intended deadline so base-tick lateness does not accumulate.
      // After a long stall, skip ahead rather than firing a backlog.
      let nextAnchor = due;
      if (nextAnchor + delay <= now) nextAnchor = now;
      // Set before run: a handler that cancels ITSELF must win, and it can only do that if
      // the re-anchored entry is already in the map when it calls cancel().
      this.entries.set(key, { ...entry, anchorAt: nextAnchor });
      this.run(entry.handler);
    }

    if (this.entries.size === 0) this.stop();
  }

  // One bad handler must not take combat down with it.
  private run(handler: () => void): void {
    try {
      handler();
    } catch (err) {
      console.error('[scheduler] handler threw:', err);
    }
  }

  private start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.baseTickMs);
  }

  private stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
