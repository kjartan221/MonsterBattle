// NOTE: unreferenced anywhere in the app (client or server). This originally read
// SERVER_PRIVATE_KEY from the node process environment — a server secret (see
// server/lib/serverWallet.ts) — which must never be sourced from import.meta.env.VITE_*,
// since Vite inlines all VITE_-prefixed vars into the public browser bundle. Left as a
// guarded stub: if this check is ever needed, implement it as a server-side script/route,
// not client code.
export async function checkWalletBalance(): Promise<number> {
  throw new Error(
    'checkWalletBalance requires the server private key and cannot run in the browser client. ' +
    'Implement this as a server-side script/route instead.'
  )
}

// Retained for reference/parity with the values this used to read (not wired to the stub above):
// WALLET_STORAGE_URL -> import.meta.env.VITE_WALLET_STORAGE_URL
// BSV_NETWORK         -> import.meta.env.VITE_BSV_NETWORK ?? 'main'
