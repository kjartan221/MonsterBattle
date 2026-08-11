// Provide dummy env for tests so server/config validation and env-reading
// modules (jwt, mongodb, serverWallet) load without real secrets.
process.env.JWT_SECRET ||= 'test-jwt-secret-at-least-32-characters-long';
process.env.MONGODB_URI ||= 'mongodb://localhost:27017/monster_battle_test';
process.env.SERVER_PRIVATE_KEY ||= 'ab'.repeat(32);
process.env.WALLET_STORAGE_URL ||= 'https://store-us-1.bsvb.tech';
process.env.BSV_NETWORK ||= 'test';
process.env.ALLOWED_ORIGINS ||= '';
