import type { WalletClient } from '@bsv/sdk';
import { getServerWallet } from '@server/lib/serverWallet';

export type WalletAction<T> = (wallet: WalletClient) => Promise<T>;

/**
 * Serializes all server-wallet UTXO actions: at most one runs at a time (FIFO).
 * A rejected action rejects only its own caller and never blocks later actions.
 * `label` is carried for future logging/metrics.
 */
export class WalletQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;

  constructor(private readonly wallet: WalletClient) {}

  enqueue<T>(label: string, fn: WalletAction<T>): Promise<T> {
    void label;
    this.pending++;
    // Start fn only after the previous action has settled (tail is always fulfilled).
    const result = this.tail.then(() => fn(this.wallet));
    // Advance the tail regardless of this action's outcome → error isolation.
    this.tail = result.then(() => undefined, () => undefined);
    const settle = () => { this.pending--; };
    result.then(settle, settle);
    return result;
  }

  depth(): number {
    return this.pending;
  }
}

let singletonPromise: Promise<WalletQueue> | null = null;

/**
 * The process-wide wallet queue over the single server wallet.
 * Memoizes the in-flight PROMISE (not the resolved instance) so concurrent
 * first-calls all receive the same single queue. Single-instance deployment
 * + this queue together guarantee no UTXO race.
 */
export function getWalletQueue(): Promise<WalletQueue> {
  if (!singletonPromise) {
    singletonPromise = getServerWallet().then((w) => new WalletQueue(w));
    // If wallet init fails, clear the cache so a later call can retry
    // (don't poison the singleton with a permanently-rejected promise).
    singletonPromise.catch(() => { singletonPromise = null; });
  }
  return singletonPromise;
}
