import { WalletQueue } from '@server/lib/walletQueue';
import type { WalletClient } from '@bsv/sdk';

const dummyWallet = {} as unknown as WalletClient;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('WalletQueue', () => {
  it('runs actions strictly one at a time (no overlap) in FIFO order', async () => {
    const q = new WalletQueue(dummyWallet);
    let active = 0;
    let maxActive = 0;
    const order: number[] = [];

    const task = (n: number, ms: number) =>
      q.enqueue(`task-${n}`, async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        order.push(n);
        await delay(ms);
        active--;
        return n;
      });

    // Descending delays: if these ran concurrently, later tasks would finish first
    // and maxActive would exceed 1. Serialization must prevent that.
    const results = await Promise.all([task(1, 30), task(2, 20), task(3, 10)]);

    expect(maxActive).toBe(1);
    expect(order).toEqual([1, 2, 3]);
    expect(results).toEqual([1, 2, 3]);
  });

  it('isolates errors: a rejected action rejects only its caller, chain continues', async () => {
    const q = new WalletQueue(dummyWallet);
    const order: string[] = [];

    const p1 = q.enqueue('ok-1', async () => { order.push('ok-1'); return 'a'; });
    const pFail = q.enqueue('fail', async () => { order.push('fail'); throw new Error('boom'); });
    const p2 = q.enqueue('ok-2', async () => { order.push('ok-2'); return 'b'; });

    await expect(p1).resolves.toBe('a');
    await expect(pFail).rejects.toThrow('boom');
    await expect(p2).resolves.toBe('b');
    expect(order).toEqual(['ok-1', 'fail', 'ok-2']);
  });

  it('tracks depth: increments on enqueue, returns to 0 after all settle', async () => {
    const q = new WalletQueue(dummyWallet);
    expect(q.depth()).toBe(0);
    const p1 = q.enqueue('t1', async () => { await delay(10); });
    const p2 = q.enqueue('t2', async () => { await delay(10); });
    expect(q.depth()).toBe(2);
    await Promise.allSettled([p1, p2]);
    expect(q.depth()).toBe(0);
  });
});
