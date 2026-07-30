// Self-contained mount: builds its own express() app (cookie-parser + express.json())
// and mounts materialsRouter directly at '/api/materials', independent of
// buildApp()/mountRoutes(). POST /check-token uses the REAL requireSession middleware +
// a REAL JWT (via createJWT) set as the `verified` cookie, mirroring
// _tests/server.battle.test.ts. POST /update-tokens uses the REAL requireAuthProof
// middleware; its lower-level dependencies (getServerWallet, authServer.verifyAuthProof,
// consumeNonce) are mocked, mirroring _tests/server.challenge.test.ts.
// connectToMongo is mocked per test. The wallet-mutating deps used by the existing
// mint-and-transfer/add-and-merge routes in this file are untouched and unused here.

jest.mock('@/lib/serverWallet', () => ({ getServerWallet: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/authProof', () => ({ authServer: { verifyAuthProof: jest.fn() } }));
jest.mock('@/lib/authNonceStore', () => ({ consumeNonce: jest.fn() }));

const materialTokensFindOne = jest.fn();
const materialTokensUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const materialTokensDeleteOne = jest.fn(async () => ({ deletedCount: 1 }));
const userInventoryDeleteMany = jest.fn(async () => ({ deletedCount: 1 }));

jest.mock('@/lib/mongodb', () => ({
  connectToMongo: jest.fn(async () => ({
    materialTokensCollection: {
      findOne: materialTokensFindOne,
      updateOne: materialTokensUpdateOne,
      deleteOne: materialTokensDeleteOne,
    },
    userInventoryCollection: { deleteMany: userInventoryDeleteMany },
  })),
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { materialsRouter } from '@server/routes/materials';
import { createJWT } from '@/utils/jwt';
import { authServer } from '@/lib/authProof';

const mockVerify = (authServer as unknown as { verifyAuthProof: jest.Mock }).verifyAuthProof;

function appWithMaterialsRouter() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/materials', materialsRouter);
  return app;
}

async function authCookie(userId = 'user-123') {
  const token = await createJWT({ userId, username: 'alice' });
  return `verified=${token}`;
}

/** Auth proof that verifies successfully for `user-123` (the requireAuthProof identity check). */
function seedValidProof() {
  mockVerify.mockResolvedValue({ valid: true, identityKey: 'user-123' });
}

describe('POST /api/materials/check-token', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no verified cookie', async () => {
    const res = await request(appWithMaterialsRouter())
      .post('/api/materials/check-token')
      .send({ lootTableId: 'iron_ore', tier: 1 });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('200s and returns the existing token (happy path)', async () => {
    materialTokensFindOne.mockResolvedValueOnce({
      tokenId: 'abcd.0',
      quantity: 5,
      keyId: 'NONCE1',
      counterparty: 'SERVER_ID',
    });

    const res = await request(appWithMaterialsRouter())
      .post('/api/materials/check-token')
      .set('Cookie', await authCookie())
      .send({ lootTableId: 'iron_ore', tier: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      exists: true,
      token: {
        tokenId: 'abcd.0',
        quantity: 5,
        keyId: 'NONCE1',
        counterparty: 'SERVER_ID',
      },
    });
    expect(materialTokensFindOne).toHaveBeenCalledWith({
      userId: 'user-123',
      lootTableId: 'iron_ore',
      tier: 1,
      consumed: { $ne: true },
    });
  });

  it('200s with exists:false when no token is found', async () => {
    materialTokensFindOne.mockResolvedValueOnce(null);

    const res = await request(appWithMaterialsRouter())
      .post('/api/materials/check-token')
      .set('Cookie', await authCookie())
      .send({ lootTableId: 'iron_ore', tier: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: false });
  });

  it('400s when lootTableId or tier is missing', async () => {
    const res = await request(appWithMaterialsRouter())
      .post('/api/materials/check-token')
      .set('Cookie', await authCookie())
      .send({ lootTableId: 'iron_ore' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing lootTableId or tier' });
  });
});

describe('POST /api/materials/update-tokens', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401s with no proof present in the body', async () => {
    const res = await request(appWithMaterialsRouter())
      .post('/api/materials/update-tokens')
      .set('Cookie', await authCookie())
      .send({ updates: [{ lootTableId: 'iron_ore', previousTokenId: 'abcd.0', newQuantity: 3 }] }); // no `proof`

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Auth proof required' });
    expect(materialTokensUpdateOne).not.toHaveBeenCalled();
  });

  it('400s when updates array is missing (valid proof, reaches handler)', async () => {
    seedValidProof();

    const res = await request(appWithMaterialsRouter())
      .post('/api/materials/update-tokens')
      .set('Cookie', await authCookie())
      .send({ proof: {} });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid or empty updates array' });
    expect(materialTokensUpdateOne).not.toHaveBeenCalled();
  });

  it('200s and updates the token quantity/state (happy path)', async () => {
    seedValidProof();
    materialTokensFindOne.mockResolvedValueOnce({
      _id: 'TOKEN_OID',
      userId: 'user-123',
      lootTableId: 'iron_ore',
      tokenId: 'abcd.0',
      quantity: 5,
    });

    const res = await request(appWithMaterialsRouter())
      .post('/api/materials/update-tokens')
      .set('Cookie', await authCookie())
      .send({
        proof: {},
        updates: [
          {
            lootTableId: 'iron_ore',
            itemName: 'Iron Ore',
            previousTokenId: 'abcd.0',
            newTokenId: 'efgh.0',
            transactionId: 'TXID1',
            previousQuantity: 5,
            newQuantity: 8,
            operation: 'add',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, count: 1 });
    expect(materialTokensUpdateOne).toHaveBeenCalledWith(
      { _id: 'TOKEN_OID' },
      {
        $set: {
          tokenId: 'efgh.0',
          quantity: 8,
          previousTokenId: 'abcd.0',
          lastTransactionId: 'TXID1',
          updatedAt: expect.any(Date),
        },
        $push: {
          updateHistory: {
            operation: 'add',
            previousQuantity: 5,
            newQuantity: 8,
            transactionId: 'TXID1',
            reason: null,
            timestamp: expect.any(Date),
          },
        },
      },
    );
    expect(materialTokensDeleteOne).not.toHaveBeenCalled();
  });

  it('deletes the token when newQuantity is 0 (burned)', async () => {
    seedValidProof();
    materialTokensFindOne.mockResolvedValueOnce({
      _id: 'TOKEN_OID',
      userId: 'user-123',
      lootTableId: 'iron_ore',
      tokenId: 'abcd.0',
      quantity: 5,
    });

    const res = await request(appWithMaterialsRouter())
      .post('/api/materials/update-tokens')
      .set('Cookie', await authCookie())
      .send({
        proof: {},
        updates: [
          {
            lootTableId: 'iron_ore',
            previousTokenId: 'abcd.0',
            transactionId: 'TXID2',
            previousQuantity: 5,
            newQuantity: 0,
            operation: 'subtract',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, count: 1 });
    expect(materialTokensDeleteOne).toHaveBeenCalledWith({ _id: 'TOKEN_OID' });
    expect(materialTokensUpdateOne).not.toHaveBeenCalled();
  });
});
