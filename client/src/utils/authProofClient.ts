
import { authClient } from '@shared/authProof';
import type { WalletClient } from '@bsv/sdk';
import { apiFetch } from '@/lib/apiFetch';

let cachedServerIdentityKey: string | null = null;

async function getServerIdentityKey(): Promise<string> {
  if (cachedServerIdentityKey) return cachedServerIdentityKey;
  const res = await apiFetch('/api/server-identity-key');
  const data = await res.json();
  cachedServerIdentityKey = data.publicKey;
  return cachedServerIdentityKey!;
}

/** Single-use ownership proof bound to `context`, to attach as `proof` in a request body. */
export async function createAuthProof(wallet: WalletClient, context: string) {
  const serverIdentityKey = await getServerIdentityKey();
  return authClient.createAuthProof(wallet, serverIdentityKey, context);
}
