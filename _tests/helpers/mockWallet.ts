/**
 * Mock wallet helpers for blockchain testing
 * Based on BSV wallet-toolbox-client
 */

// @ts-nocheck - Optional dependency for blockchain tests
import {
  PrivateKey,
  KeyDeriver,
  WalletInterface,
  WalletClient
} from '@bsv/sdk';
import { WalletStorageManager, Services, Wallet, StorageClient, WalletSigner } from '@bsv/wallet-toolbox-client';

/**
 * Creates a test wallet for blockchain testing
 *
 * @param chain - Blockchain network ('test' or 'main')
 * @param storageURL - Storage provider URL
 * @param privateKey - Private key as hex string
 * @returns WalletClient instance (cast from WalletInterface)
 */
export async function makeWallet(
  chain: 'test' | 'main',
  storageURL: string,
  privateKey: string
): Promise<WalletClient> {
  const keyDeriver = new KeyDeriver(new PrivateKey(privateKey, 'hex'));
  const storageManager = new WalletStorageManager(keyDeriver.identityKey);
  const signer = new WalletSigner(chain, keyDeriver, storageManager);
  const services = new Services(chain);
  const wallet = new Wallet(signer, services);
  const client = new StorageClient(wallet, storageURL);

  await client.makeAvailable();
  await storageManager.addWalletStorageProvider(client);

  // Cast to WalletClient for test compatibility
  return wallet as unknown as WalletClient;
}

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
