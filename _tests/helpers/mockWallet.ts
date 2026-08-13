// Test wallet helpers. The real wallet builder now lives in production
// (server/lib/walletFactory) — re-exported here so tests keep one import site.
import { PrivateKey } from '@bsv/sdk';

export { makeWallet } from '../../server/lib/walletFactory';

/**
 * Creates a random private key for testing
 */
export function createTestPrivateKey(): PrivateKey {
  return PrivateKey.fromRandom();
}

/**
 * Creates a deterministic private key from a seed number
 * Useful for reproducible tests
 */
export function createTestPrivateKeyFromSeed(seed: number): PrivateKey {
  return new PrivateKey(seed);
}
