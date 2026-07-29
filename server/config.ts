// The single source of validated env/secrets for the server. Import `config`
// from here; never read process.env elsewhere in server/. SERVER-ONLY —
// never import this from src/ (would bundle secrets into the client).
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = Object.freeze({
  port: Number(process.env.PORT) || 4000,
  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  serverPrivateKey: required('SERVER_PRIVATE_KEY'),
  walletStorageUrl: process.env.WALLET_STORAGE_URL || 'https://store-us-1.bsvb.tech',
  bsvNetwork: (process.env.BSV_NETWORK as 'test' | 'main') || 'main',
});
