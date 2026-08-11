import type { WalletClient } from '@bsv/sdk';
import { apiFetch } from './apiFetch';
import { createAuthProof } from '@/utils/authProofClient';

/** POST to a requireAuthProof route: build a single-use proof for `context`,
 *  attach it as body.proof, send credentialed JSON. */
export async function apiFetchStepUp(
  path: string,
  opts: { wallet: WalletClient; context: string; body?: Record<string, unknown>; method?: string },
): Promise<Response> {
  const proof = await createAuthProof(opts.wallet, opts.context);
  return apiFetch(path, {
    method: opts.method ?? 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(opts.body ?? {}), proof }),
  });
}
