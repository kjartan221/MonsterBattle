// Builds a real @bsv wallet backed by remote storage. Used by the server wallet
// (serverWallet.ts) and by blockchain tests.
import { PrivateKey, KeyDeriver, WalletClient } from '@bsv/sdk';
import { WalletStorageManager, Services, Wallet, StorageClient, WalletSigner } from '@bsv/wallet-toolbox-client';

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

  // Toolbox Wallet implements the SDK wallet surface the app uses.
  return wallet as unknown as WalletClient;
}
