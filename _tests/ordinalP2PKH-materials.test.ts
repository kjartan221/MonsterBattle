/**
 * Integration tests for OrdinalsP2PKH - Material Token Flow
 * Tests the transaction flow for creating and updating material tokens
 */

import {
  Transaction,
  PrivateKey,
  MerklePath,
  Script,
} from '@bsv/sdk';
import { OrdinalsP2PKH } from '../src/utils/ordinalP2PKH';
import { makeWallet } from './helpers/mockWallet';

describe('OrdinalsP2PKH - Material Token Flow', () => {
  const storageURL = 'https://store-us-1.bsvb.tech';

  describe('Create material tokens', () => {
    it('should create valid transaction for single material token', async () => {
      const userPriv = new PrivateKey(400);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const materialMetadata = {
        name: 'material_token',
        materialName: 'Iron Ore',
        description: 'Basic crafting material',
        icon: '⛏️',
        rarity: 'common',
        quantity: 10,
        tier: 1,
        stackable: true,
      };

      const mintTx = new Transaction();
      mintTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      mintTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          materialMetadata,
          'deploy+mint'
        ),
        satoshis: 1,
      });

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        7000
      );

      const outputScript = mintTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('material_token');
      expect(scriptAscii).toContain('Iron Ore');
      expect(scriptAscii).toContain('quantity');
      expect(mintTx.outputs[0].satoshis).toBe(1);
    });

    it('should create batch of different material tokens', async () => {
      const userPriv = new PrivateKey(401);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const materials = [
        { name: 'Iron Ore', icon: '⛏️', quantity: 50, tier: 1 },
        { name: 'Dragon Scale', icon: '🐉', quantity: 5, tier: 3 },
        { name: 'Phoenix Feather', icon: '🔥', quantity: 3, tier: 4 },
      ];

      const mintTx = new Transaction();
      mintTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      // Create output for each material
      for (const material of materials) {
        mintTx.addOutput({
          lockingScript: new OrdinalsP2PKH().lock(
            userPubKey,
            '',
            {
              name: 'material_token',
              materialName: material.name,
              icon: material.icon,
              rarity: 'rare',
              quantity: material.quantity,
              tier: material.tier,
              stackable: true,
            },
            'deploy+mint'
          ),
          satoshis: 1,
        });
      }

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        7100
      );

      expect(mintTx.outputs.length).toBe(3);

      const ironScript = Buffer.from(
        mintTx.outputs[0].lockingScript.toHex(),
        'hex'
      ).toString('ascii');
      expect(ironScript).toContain('Iron Ore');

      const dragonScript = Buffer.from(
        mintTx.outputs[1].lockingScript.toHex(),
        'hex'
      ).toString('ascii');
      expect(dragonScript).toContain('Dragon Scale');
    });
  });

  describe('Update material quantities', () => {
    it('should add to material quantity (stack)', async () => {
      const userPriv = new PrivateKey(402);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Existing material token
      const materialTx = new Transaction();
      materialTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      materialTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            materialName: 'Gold Ore',
            icon: '🪙',
            rarity: 'rare',
            quantity: 25,
            tier: 2,
            stackable: true,
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      materialTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        materialTx.id('hex'),
        7200
      );

      // Update transaction: Add 15 more
      const updateTx = new Transaction();

      updateTx.addInput({
        sourceTransaction: materialTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      const updatedMetadata = {
        name: 'material_token',
        materialName: 'Gold Ore',
        icon: '🪙',
        rarity: 'rare',
        quantity: 40, // 25 + 15
        tier: 2,
        stackable: true,
        lastUpdated: '2025-12-12T00:00:00Z',
        updateHistory: [
          { operation: 'add', amount: 15, timestamp: '2025-12-12T00:00:00Z' },
        ],
      };

      const assetId = materialTx.id('hex') + '_0';
      updateTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          assetId,
          updatedMetadata,
          'transfer'
        ),
        satoshis: 1,
      });

      // Sign and verify without fee calculation
      await updateTx.sign();
      const isValid = await updateTx.verify('scripts only');
      expect(isValid).toBe(true);

      // Verify updated metadata
      const outputScript = updateTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('Gold Ore');
      expect(scriptAscii).toContain('quantity');
    });

    it('should subtract from material quantity (consume)', async () => {
      const userPriv = new PrivateKey(403);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Existing material token
      const materialTx = new Transaction();
      materialTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      materialTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            materialName: 'Steel Ingot',
            icon: '🔩',
            rarity: 'rare',
            quantity: 100,
            tier: 2,
            stackable: true,
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      materialTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        materialTx.id('hex'),
        7300
      );

      // Update transaction: Subtract 30 (used in crafting)
      const updateTx = new Transaction();

      updateTx.addInput({
        sourceTransaction: materialTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      const updatedMetadata = {
        name: 'material_token',
        materialName: 'Steel Ingot',
        icon: '🔩',
        rarity: 'rare',
        quantity: 70, // 100 - 30
        tier: 2,
        stackable: true,
        lastUpdated: '2025-12-12T00:00:00Z',
        updateHistory: [
          {
            operation: 'subtract',
            amount: 30,
            reason: 'Used in crafting Steel Sword',
            timestamp: '2025-12-12T00:00:00Z',
          },
        ],
      };

      const assetId = materialTx.id('hex') + '_0';
      updateTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          assetId,
          updatedMetadata,
          'transfer'
        ),
        satoshis: 1,
      });

      // Sign and verify without fee calculation
      await updateTx.sign();
      const isValid = await updateTx.verify('scripts only');
      expect(isValid).toBe(true);

      // Verify updated metadata
      const outputScript = updateTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('Steel Ingot');
      expect(scriptAscii).toContain('subtract');
    });

    it('should burn material token when quantity reaches 0', async () => {
      const userPriv = new PrivateKey(404);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Material token with low quantity
      const materialTx = new Transaction();
      materialTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      materialTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            materialName: 'Rare Gem',
            icon: '💎',
            rarity: 'epic',
            quantity: 5,
            tier: 3,
            stackable: true,
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      materialTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        materialTx.id('hex'),
        7400
      );

      // Burn transaction: Consume all 5
      const burnTx = new Transaction();

      burnTx.addInput({
        sourceTransaction: materialTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      // No output for burned token (fully consumed)

      // Sign and verify without fee calculation
      await burnTx.sign();
      const isValid = await burnTx.verify('scripts only');
      expect(isValid).toBe(true);

      // Verify no material output exists in transaction
      const materialOutputs = burnTx.outputs.filter((output) => {
        const script = output.lockingScript.toHex();
        const ascii = Buffer.from(script, 'hex').toString('ascii');
        return ascii.includes('Rare Gem');
      });

      expect(materialOutputs.length).toBe(0);
    });
  });

  describe('Merge material tokens', () => {
    it('should merge two material token stacks', async () => {
      const userPriv = new PrivateKey(405);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Stack 1
      const stack1Tx = new Transaction();
      stack1Tx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      stack1Tx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            materialName: 'Ancient Wood',
            icon: '🪵',
            rarity: 'rare',
            quantity: 25,
            tier: 2,
            stackable: true,
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      stack1Tx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        stack1Tx.id('hex'),
        7500
      );

      // Stack 2
      const stack2Tx = new Transaction();
      stack2Tx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      stack2Tx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            materialName: 'Ancient Wood',
            icon: '🪵',
            rarity: 'rare',
            quantity: 15,
            tier: 2,
            stackable: true,
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      stack2Tx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        stack2Tx.id('hex'),
        7501
      );

      // Merge transaction
      const mergeTx = new Transaction();

      mergeTx.addInput({
        sourceTransaction: stack1Tx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      mergeTx.addInput({
        sourceTransaction: stack2Tx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      // Single merged output
      const mergedMetadata = {
        name: 'material_token',
        materialName: 'Ancient Wood',
        icon: '🪵',
        rarity: 'rare',
        quantity: 40, // 25 + 15
        tier: 2,
        stackable: true,
        mergedFrom: [
          { txid: stack1Tx.id('hex'), quantity: 25 },
          { txid: stack2Tx.id('hex'), quantity: 15 },
        ],
        lastUpdated: '2025-12-12T00:00:00Z',
      };

      mergeTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '', // New merged token
          mergedMetadata,
          'deploy+mint'
        ),
        satoshis: 1,
      });

      // Sign and verify without fee calculation
      await mergeTx.sign();
      const isValid = await mergeTx.verify('scripts only');
      expect(isValid).toBe(true);

      // Verify merged metadata
      const outputScript = mergeTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('Ancient Wood');
      expect(scriptAscii).toContain('mergedFrom');
    });
  });

  describe('Split material tokens', () => {
    it('should split material token into multiple stacks', async () => {
      const userPriv = new PrivateKey(406);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Large material stack
      const materialTx = new Transaction();
      materialTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      materialTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            materialName: 'Crystal Shard',
            icon: '💠',
            rarity: 'epic',
            quantity: 100,
            tier: 3,
            stackable: true,
          },
          'deploy+mint'
        ),
        satoshis: 10, // Enough to split into 3 outputs
      });

      materialTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        materialTx.id('hex'),
        7600
      );

      // Split transaction: Divide into 3 stacks
      const splitTx = new Transaction();

      splitTx.addInput({
        sourceTransaction: materialTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      const quantities = [30, 30, 40]; // Total: 100

      for (const qty of quantities) {
        splitTx.addOutput({
          lockingScript: new OrdinalsP2PKH().lock(
            userPubKey,
            '',
            {
              name: 'material_token',
              materialName: 'Crystal Shard',
              icon: '💠',
              rarity: 'epic',
              quantity: qty,
              tier: 3,
              stackable: true,
              splitFrom: {
                txid: materialTx.id('hex'),
                originalQuantity: 100,
              },
            },
            'deploy+mint'
          ),
          satoshis: 1,
        });
      }

      // Sign and verify without fee calculation
      await splitTx.sign();
      const isValid = await splitTx.verify('scripts only');
      expect(isValid).toBe(true);

      // Verify 3 outputs created
      const materialOutputs = splitTx.outputs.filter((output) => {
        const script = output.lockingScript.toHex();
        const ascii = Buffer.from(script, 'hex').toString('ascii');
        return ascii.includes('Crystal Shard');
      });

      expect(materialOutputs.length).toBe(3);
    });
  });
});
