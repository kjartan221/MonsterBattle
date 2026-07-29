// Mock the server wallet with an async gap so concurrent first-calls race the init window.
jest.mock('@/lib/serverWallet', () => ({
  getServerWallet: jest
    .fn()
    .mockImplementation(() => new Promise((r) => setTimeout(() => r({}), 10))),
}));

import { getWalletQueue, WalletQueue } from '@server/lib/walletQueue';
import { getServerWallet } from '@/lib/serverWallet';

describe('getWalletQueue concurrency', () => {
  it('returns ONE instance under concurrent first-calls (wallet built once)', async () => {
    const [a, b] = await Promise.all([getWalletQueue(), getWalletQueue()]);
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(WalletQueue);
    expect((getServerWallet as jest.Mock).mock.calls.length).toBe(1);
  });
});
