import { connectToMongo } from '@server/lib/mongodb';
import { getWalletQueue } from '@server/lib/walletQueue';

/**
 * Fail-fast startup init for the single-instance backend.
 * - connectToMongo(): opens the pooled connection AND verifies critical unique
 *   indexes on first call (throws if any are missing).
 * - getWalletQueue(): constructs the single server wallet + serialized queue now,
 *   so the first mint doesn't pay init cost and there is exactly one queue.
 * Any failure rejects → index.ts exits non-zero rather than serving half-initialized.
 */
export async function boot(): Promise<void> {
  await connectToMongo();
  await getWalletQueue();
}
