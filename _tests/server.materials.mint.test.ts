// Bypass real auth (covered by the scaffold's requireAuthProof tests) — inject userId.
jest.mock('@server/middleware/requireAuthProof', () => ({
  requireAuthProof: () => (req: any, _res: any, next: any) => { req.userId = 'u1'; next(); },
}));

const enqueue = jest.fn((_label: string, fn: (w: any) => Promise<any>) => fn(stubWallet));
jest.mock('@server/lib/walletQueue', () => ({ getWalletQueue: jest.fn(async () => ({ enqueue })) }));

const findOne = jest.fn();
const insertOne = jest.fn(async () => ({ insertedId: 'MATERIAL_TOKEN_OID' }));
const deleteMany = jest.fn(async () => ({ deletedCount: 2 }));
jest.mock('@/lib/mongodb', () => ({
  connectToMongo: jest.fn(async () => ({
    materialTokensCollection: { findOne, insertOne },
    userInventoryCollection: { deleteMany },
  })),
}));

jest.mock('@/lib/serverWallet', () => ({ getServerIdentityPublicKey: jest.fn(async () => 'SERVER_ID') }));
jest.mock('@/utils/overlayFunctions', () => ({ broadcastTX: jest.fn(async () => ({ txid: 'MINTTX' })) }));
jest.mock('@/utils/beefEncoding', () => ({ decodeBeef: jest.fn(() => [1, 2, 3]), encodeBeef: jest.fn(() => 'BEEF_B64') }));
jest.mock('@/utils/tokenDerivation', () => ({ generateNonce: jest.fn(() => 'NONCE'), deriveRecipientKey: jest.fn(async () => 'USERKEY') }));
jest.mock('@/utils/ordinalP2PKH', () => ({ OrdinalsP2PKH: class { lock() { return { toHex: () => 'LOCKHEX' }; } } }));
jest.mock('@bsv/wallet-helper', () => ({ WalletP2PKH: class { unlock() { return { estimateLength: async () => 100 }; } } }));
jest.mock('@bsv/sdk', () => ({
  Transaction: {
    fromBEEF: jest.fn(),
    fromAtomicBEEF: jest.fn(() => ({})),
  },
}));

import request from 'supertest';
import { buildApp } from '@server/app';
import { Transaction } from '@bsv/sdk';

const stubWallet = {
  createAction: jest.fn(async () => ({ signableTransaction: { reference: 'REF', tx: [7, 7] } })),
  signAction: jest.fn(async () => ({ tx: Uint8Array.from([9, 9]) })),
};

const validBody = {
  materials: [
    {
      lootTableId: 'phoenix_feather',
      itemName: 'Phoenix Feather',
      description: 'A feather from the phoenix',
      icon: '🪶',
      rarity: 'legendary',
      tier: 1,
      quantity: 5,
      inventoryItemIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
      acquiredFrom: ['sand_djinn'],
    },
  ],
  userIdentityKey: 'USER_ID_KEY',
  paymentTx: 'PAYMENT_B64',
  walletParams: { protocolID: [0, 'x'], keyID: '1', counterparty: 'cp' },
};

function seedTxMocks() {
  // 1st fromBEEF = payment tx; 2nd = signable mint tx
  (Transaction.fromBEEF as jest.Mock)
    .mockReturnValueOnce({ id: () => 'PAYTXID', outputs: [{ satoshis: 100 }] })
    .mockReturnValueOnce({ inputs: [{ unlockingScript: { toHex: () => 'UNLOCKHEX' } }], sign: async () => {} });
}

describe('POST /api/materials/mint-and-transfer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Transaction as any).fromBEEF = jest.fn();
    insertOne.mockResolvedValue({ insertedId: 'MATERIAL_TOKEN_OID' });
    deleteMany.mockResolvedValue({ deletedCount: 2 });
    enqueue.mockImplementation((_label: string, fn: (w: any) => Promise<any>) => fn(stubWallet));
  });

  it('400 on empty materials array', async () => {
    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send({
      ...validBody,
      materials: [],
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid materials data' });
  });

  it('400 on missing materials', async () => {
    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send({
      userIdentityKey: 'USER_ID_KEY',
      paymentTx: 'PAYMENT_B64',
      walletParams: { protocolID: [0, 'x'], keyID: '1', counterparty: 'cp' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid materials data' });
  });

  it('400 when materials length !== 1', async () => {
    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send({
      ...validBody,
      materials: [validBody.materials[0], validBody.materials[0]],
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Only one material token can be minted per request' });
  });

  it('400 when missing userIdentityKey', async () => {
    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send({
      ...validBody,
      userIdentityKey: undefined,
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing user identity key' });
  });

  it('400 when missing paymentTx', async () => {
    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send({
      ...validBody,
      paymentTx: undefined,
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing payment transaction' });
  });

  it('400 when walletParams incomplete', async () => {
    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send({
      ...validBody,
      walletParams: { protocolID: [0, 'x'] }, // missing keyID and counterparty
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing wallet derivation parameters' });
  });

  it('400 when payment satoshis < 100', async () => {
    (Transaction.fromBEEF as jest.Mock).mockReturnValueOnce({
      id: () => 'PAYTXID',
      outputs: [{ satoshis: 50 }],
    });
    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send(validBody);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid payment: must be at least 100 satoshis' });
  });

  it('409 when material token already exists', async () => {
    seedTxMocks();
    findOne.mockResolvedValueOnce({ tokenId: 'existing-token', quantity: 10 });
    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send(validBody);
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('shouldUseAddAndMerge', true);
    expect(res.body).toHaveProperty('existingTokenId', 'existing-token');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('mints via the wallet queue, writes DB after, returns the success shape', async () => {
    seedTxMocks();
    findOne.mockResolvedValueOnce(null); // no existing token

    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      dbRecorded: true,
      results: [
        {
          lootTableId: 'phoenix_feather',
          tokenId: 'MINTTX.0',
          mintOutpoint: 'MINTTX.0',
          quantity: 5,
          materialTokenId: 'MATERIAL_TOKEN_OID',
          updated: false,
        },
      ],
      transferBeef: 'BEEF_B64',
      received: { outputIndex: 0, keyId: 'NONCE', counterparty: 'SERVER_ID', tags: ['type:material'] },
    });

    // Wallet work ran through the serialized queue under the 'mint:material' label.
    expect(enqueue).toHaveBeenCalledWith('mint:material', expect.any(Function));
    expect(stubWallet.createAction).toHaveBeenCalledTimes(1);
    expect(stubWallet.signAction).toHaveBeenCalledTimes(1);

    // DB writes happened AFTER the enqueue resolved.
    expect(insertOne).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.invocationCallOrder[0]).toBeLessThan(insertOne.mock.invocationCallOrder[0]);
  });

  it('500s via the error handler when the wallet mint throws', async () => {
    seedTxMocks();
    findOne.mockResolvedValueOnce(null);
    enqueue.mockRejectedValueOnce(new Error('mint boom'));
    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send(validBody);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('still returns 200 with the mint result + dbRecorded:false when the DB write fails', async () => {
    seedTxMocks();
    findOne.mockResolvedValueOnce(null);
    insertOne.mockRejectedValueOnce(new Error('db down'));

    const res = await request(buildApp()).post('/api/materials/mint-and-transfer').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.dbRecorded).toBe(false);
    // The mint happened and the client can still internalize the token.
    expect(res.body.results[0].tokenId).toBe('MINTTX.0');
    expect(res.body.transferBeef).toBe('BEEF_B64');
    expect(res.body.received).toEqual({ outputIndex: 0, keyId: 'NONCE', counterparty: 'SERVER_ID', tags: ['type:material'] });
    expect(res.body.results).toEqual([
      {
        lootTableId: 'phoenix_feather',
        tokenId: 'MINTTX.0',
        mintOutpoint: 'MINTTX.0',
        quantity: 5,
        materialTokenId: undefined,
        updated: false,
      },
    ]);
    expect(enqueue).toHaveBeenCalledWith('mint:material', expect.any(Function));
    expect(stubWallet.createAction).toHaveBeenCalledTimes(1);
  });
});
