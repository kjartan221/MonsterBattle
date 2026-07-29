describe('server/config', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV }; // fresh copy per test (carries the setupFiles dummies)
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('loads values (with defaults) when all required env is present', () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/testdb';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.SERVER_PRIVATE_KEY = 'ab'.repeat(32);
    delete process.env.PORT;
    delete process.env.BSV_NETWORK;
    const { config } = require('@server/config');
    expect(config.mongoUri).toBe('mongodb://localhost:27017/testdb');
    expect(config.port).toBe(4000);       // default
    expect(config.bsvNetwork).toBe('main'); // default
  });

  it('throws naming the missing required secret', () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/testdb';
    delete process.env.JWT_SECRET;
    process.env.SERVER_PRIVATE_KEY = 'ab'.repeat(32);
    expect(() => require('@server/config')).toThrow('JWT_SECRET');
  });
});
