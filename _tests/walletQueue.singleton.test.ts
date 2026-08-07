// Mock the server wallet so no network/env is needed.
jest.mock('@server/lib/serverWallet', () => ({
  getServerWallet: jest.fn().mockResolvedValue({}),
}));

import { getWalletQueue, WalletQueue } from '@server/lib/walletQueue';
import { getServerWallet } from '@server/lib/serverWallet';

describe('getWalletQueue', () => {
  it('returns a WalletQueue singleton (same instance, wallet built once)', async () => {
    const a = await getWalletQueue();
    const b = await getWalletQueue();
    expect(a).toBeInstanceOf(WalletQueue);
    expect(a).toBe(b);
    expect((getServerWallet as jest.Mock).mock.calls.length).toBe(1);
  });
});
