jest.mock('@/lib/mongodb', () => ({ connectToMongo: jest.fn() }));
jest.mock('@server/lib/walletQueue', () => ({ getWalletQueue: jest.fn() }));

import { boot } from '@server/boot';
import { connectToMongo } from '@/lib/mongodb';
import { getWalletQueue } from '@server/lib/walletQueue';

const mockMongo = connectToMongo as jest.Mock;
const mockQueue = getWalletQueue as jest.Mock;

describe('boot', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('resolves after Mongo connect/verify and wallet-queue warm-up', async () => {
    mockMongo.mockResolvedValue({});
    mockQueue.mockResolvedValue({});
    await expect(boot()).resolves.toBeUndefined();
    expect(mockMongo).toHaveBeenCalledTimes(1);
    expect(mockQueue).toHaveBeenCalledTimes(1);
  });

  it('rejects (fail-fast) when Mongo init fails', async () => {
    mockMongo.mockRejectedValue(new Error('no mongo'));
    mockQueue.mockResolvedValue({});
    await expect(boot()).rejects.toThrow('no mongo');
  });

  it('rejects (fail-fast) when the wallet queue fails to init', async () => {
    mockMongo.mockResolvedValue({});
    mockQueue.mockRejectedValue(new Error('no wallet'));
    await expect(boot()).rejects.toThrow('no wallet');
  });
});
