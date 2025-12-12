/**
 * Server-side wallet for minting items
 * This wallet is the single source of truth for all game item mints
 *
 * All legitimate items in the game are first minted by this server wallet,
 * then transferred to users. This prevents users from creating fraudulent items.
 */

import { WalletClient } from '@bsv/sdk';
import { makeWallet } from '../../_tests/helpers/mockWallet';

let serverWallet: WalletClient | null = null;

/**
 * Get or create the singleton server wallet instance
 * Uses environment variables for secure key storage
 */
export async function getServerWallet(): Promise<WalletClient> {
  if (serverWallet) {
    return serverWallet;
  }

  const privateKey = process.env.SERVER_WALLET_PRIVATE_KEY;
  const storageURL = process.env.SERVER_WALLET_STORAGE_URL || 'https://store-us-1.bsvb.tech';
  const chain = (process.env.SERVER_WALLET_CHAIN as 'test' | 'main') || 'main';

  if (!privateKey) {
    throw new Error('SERVER_WALLET_PRIVATE_KEY environment variable not set');
  }

  // Create server wallet
  serverWallet = await makeWallet(chain, storageURL, privateKey);

  console.log('Server wallet initialized for minting');
  return serverWallet;
}

/**
 * Get server wallet public key for verification
 */
export async function getServerPublicKey(): Promise<string> {
  const wallet = await getServerWallet();
  const { publicKey } = await wallet.getPublicKey({
    protocolID: [0, "monsterbattle"],
    keyID: "0",
    counterparty: "self",
  });
  return publicKey;
}
