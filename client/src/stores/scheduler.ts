export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

type Entry =
  | { kind: 'once'; dueAt: number; handler: () => void }
  | { kind: 'repeat'; anchorAt: number; nextDelay: () => number; handler: () => void };

/** Keyed timer registry on one base ticker. Handlers read live state at fire time. */
export class Scheduler {
  private entries = new Map<string, Entry>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private clock: Clock = systemClock, private baseTickMs = 100) {}

  /**
   * Repeating work; `nextDelay` is re-read every tick so live state retunes the cadence.
   *
   * Register ONCE per loop - re-registering resets the anchor and grants a free extra delay.
   * `nextDelay` must be pure and deterministic; it runs on every tick.
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
      // Re-read, not the snapshot: an earlier handler may have cancelled this key, and a
      // stale entry would re-insert a cancelled repeat with no owner left to remove it.
      const entry = this.entries.get(key);
      if (!entry) continue;

      if (entry.kind === 'once') {
        if (entry.dueAt > now) continue;
        this.entries.delete(key);
        this.run(entry.handler);
        continue;
      }

      // Fresh every tick, so a mid-battle equipment swap lands on the next check.
      const delay = Math.max(1, entry.nextDelay());
      const due = entry.anchorAt + delay;
      if (due > now) continue;

      // Anchor on the intended deadline so lateness cannot accumulate; skip ahead after a stall.
      let nextAnchor = due;
      if (nextAnchor + delay <= now) nextAnchor = now;
      // Set before run so a handler cancelling ITSELF wins.
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
