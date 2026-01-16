/**
 * Integration tests for OrdinalsP2PKH - BSV-20 amt Field Implementation
 * Tests the new amt field for material quantities (Phase 1-4 implementation)
 */

import {
  Transaction,
  PrivateKey,
  MerklePath,
  Script,
} from '@bsv/sdk';
import { OrdinalsP2PKH } from '../src/utils/ordinalP2PKH';
import { makeWallet } from './helpers/mockWallet';

describe('OrdinalsP2PKH - BSV-20 amt Field', () => {
  const storageURL = 'https://store-us-1.bsvb.tech';

  describe('Phase 1: Optional amt parameter', () => {
    it('should default amt to 1 when not specified (backward compatibility)', async () => {
      const userPriv = new PrivateKey(500);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const itemMetadata = {
        name: 'game_item',
        itemName: 'Iron Sword',
        description: 'Basic weapon',
        icon: '⚔️',
        rarity: 'common',
      };

      const mintTx = new Transaction();
      mintTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      // Don't pass amt parameter - should default to 1
      mintTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          itemMetadata,
          'deploy+mint'
          // No amt parameter
        ),
        satoshis: 1,
      });

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        8000
      );

      const outputScript = mintTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      // Should contain BSV-20 inscription with amt: 1
      expect(scriptAscii).toContain('bsv-20');
      expect(scriptAscii).toContain('deploy+mint');
      expect(scriptAscii).toContain('"amt":1');
    });

    it('should use custom amt value when specified for materials', async () => {
      const userPriv = new PrivateKey(501);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const materialMetadata = {
        name: 'material_token',
        lootTableId: 'iron_ore',
        itemName: 'Iron Ore',
        description: 'Basic crafting material',
        icon: '⛏️',
        rarity: 'common',
        tier: 1,
      };

      const quantity = 50;

      const mintTx = new Transaction();
      mintTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      // Pass quantity as amt parameter
      mintTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          materialMetadata,
          'deploy+mint',
          quantity  // amt field
        ),
        satoshis: 1,
      });

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        8001
      );

      const outputScript = mintTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      // Should contain BSV-20 inscription with amt: 50
      expect(scriptAscii).toContain('bsv-20');
      expect(scriptAscii).toContain('deploy+mint');
      expect(scriptAscii).toContain('"amt":50');

      // Should NOT contain quantity in metadata JSON
      expect(scriptAscii).not.toContain('"quantity":');
    });

    it('should handle large amt values (e.g., 1000)', async () => {
      const userPriv = new PrivateKey(502);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const materialMetadata = {
        name: 'material_token',
        lootTableId: 'wood',
        itemName: 'Wood',
        icon: '🪵',
        rarity: 'common',
        tier: 1,
      };

      const quantity = 1000;

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
          'deploy+mint',
          quantity
        ),
        satoshis: 1,
      });

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        8002
      );

      const outputScript = mintTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('"amt":1000');
    });
  });

  describe('Phase 2: Material minting with amt field', () => {
    it('should mint material with quantity as amt, not in metadata', async () => {
      const userPriv = new PrivateKey(503);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const materialMetadata = {
        name: 'material_token',
        lootTableId: 'dragon_scale',
        itemName: 'Dragon Scale',
        description: 'Rare material from dragons',
        icon: '🐉',
        rarity: 'epic',
        tier: 3,
        acquiredFrom: [],
      };

      const quantity = 25;

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
          'deploy+mint',
          quantity
        ),
        satoshis: 1,
      });

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        8003
      );

      const outputScript = mintTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      // Verify BSV-20 inscription with amt
      expect(scriptAscii).toContain('bsv-20');
      expect(scriptAscii).toContain('"amt":25');

      // Verify metadata is present
      expect(scriptAscii).toContain('Dragon Scale');
      expect(scriptAscii).toContain('dragon_scale');

      // Verify quantity is NOT in metadata
      expect(scriptAscii).not.toContain('"quantity":');
    });

    it('should batch mint multiple materials with different amt values', async () => {
      const userPriv = new PrivateKey(504);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const materials = [
        { lootTableId: 'iron_ore', name: 'Iron Ore', icon: '⛏️', quantity: 100 },
        { lootTableId: 'gold_ore', name: 'Gold Ore', icon: '🪙', quantity: 50 },
        { lootTableId: 'diamond', name: 'Diamond', icon: '💎', quantity: 10 },
      ];

      const mintTx = new Transaction();
      mintTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      for (const material of materials) {
        mintTx.addOutput({
          lockingScript: new OrdinalsP2PKH().lock(
            userPubKey,
            '',
            {
              name: 'material_token',
              lootTableId: material.lootTableId,
              itemName: material.name,
              icon: material.icon,
              rarity: 'common',
              tier: 1,
            },
            'deploy+mint',
            material.quantity
          ),
          satoshis: 1,
        });
      }

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        8004
      );

      expect(mintTx.outputs.length).toBe(3);

      // Verify each output has correct amt
      const ironScript = Buffer.from(
        mintTx.outputs[0].lockingScript.toHex(),
        'hex'
      ).toString('ascii');
      expect(ironScript).toContain('"amt":100');

      const goldScript = Buffer.from(
        mintTx.outputs[1].lockingScript.toHex(),
        'hex'
      ).toString('ascii');
      expect(goldScript).toContain('"amt":50');

      const diamondScript = Buffer.from(
        mintTx.outputs[2].lockingScript.toHex(),
        'hex'
      ).toString('ascii');
      expect(diamondScript).toContain('"amt":10');
    });
  });

  describe('Phase 3: Transfer operation with amt field', () => {
    it('should transfer material token preserving amt value', async () => {
      const userPriv = new PrivateKey(505);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Initial mint with amt=30
      const mintTx = new Transaction();
      mintTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      const quantity = 30;

      mintTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            lootTableId: 'steel_ingot',
            itemName: 'Steel Ingot',
            icon: '🔩',
            rarity: 'rare',
            tier: 2,
          },
          'deploy+mint',
          quantity
        ),
        satoshis: 1,
      });

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        8005
      );

      // Transfer transaction (e.g., to server)
      const transferTx = new Transaction();

      transferTx.addInput({
        sourceTransaction: mintTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet, "all", false),
      });

      const assetId = mintTx.id('hex') + '_0';
      transferTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,  // In real flow, this would be serverPublicKey
          assetId,
          {
            name: 'material_token',
            lootTableId: 'steel_ingot',
            itemName: 'Steel Ingot',
            icon: '🔩',
            rarity: 'rare',
            tier: 2,
          },
          'transfer',
          quantity  // amt preserved
        ),
        satoshis: 1,
      });

      await transferTx.sign();
      const isValid = await transferTx.verify('scripts only');
      expect(isValid).toBe(true);

      const outputScript = transferTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      // Verify amt is preserved in transfer
      expect(scriptAscii).toContain('"amt":30');
      expect(scriptAscii).toContain('transfer');
      expect(scriptAscii).toContain(assetId);
    });
  });

  describe('Phase 3-4: Merge operation with amt field', () => {
    it('should merge two material tokens by adding amt values', async () => {
      const userPriv = new PrivateKey(506);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Token 1: amt=10
      const token1Tx = new Transaction();
      token1Tx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      token1Tx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            lootTableId: 'wood',
            itemName: 'Wood',
            icon: '🪵',
            rarity: 'common',
            tier: 1,
          },
          'deploy+mint',
          10  // amt=10
        ),
        satoshis: 1,
      });

      token1Tx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        token1Tx.id('hex'),
        8006
      );

      // Token 2: amt=5 (newly minted to add)
      const token2Tx = new Transaction();
      token2Tx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      token2Tx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            lootTableId: 'wood',
            itemName: 'Wood',
            icon: '🪵',
            rarity: 'common',
            tier: 1,
          },
          'deploy+mint',
          5  // amt=5
        ),
        satoshis: 1,
      });

      token2Tx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        token2Tx.id('hex'),
        8007
      );

      // Merge transaction: 2 inputs → 1 output
      const mergeTx = new Transaction();

      mergeTx.addInput({
        sourceTransaction: token1Tx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet, "all", false),
      });

      mergeTx.addInput({
        sourceTransaction: token2Tx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet, "all", false),
      });

      const mergedAssetId = token2Tx.id('hex') + '_0';  // Use token2 as reference
      const mergedMetadata = {
        name: 'material_token',
        lootTableId: 'wood',
        itemName: 'Wood',
        icon: '🪵',
        rarity: 'common',
        tier: 1,
        mergeHistory: [
          { tokenId: token1Tx.id('hex') + '.0', amt: 10 },
          { tokenId: token2Tx.id('hex') + '.0', amt: 5 },
        ],
      };

      mergeTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          mergedAssetId,
          mergedMetadata,
          'transfer',
          15  // amt=10+5
        ),
        satoshis: 1,
      });

      await mergeTx.sign();
      const isValid = await mergeTx.verify('scripts only');
      expect(isValid).toBe(true);

      const outputScript = mergeTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      // Verify combined amt
      expect(scriptAscii).toContain('"amt":15');
      expect(scriptAscii).toContain('transfer');
      expect(scriptAscii).toContain('mergeHistory');

      // Verify no quantity in metadata
      expect(scriptAscii).not.toContain('"quantity":');
    });

    it('should handle merging tokens with large amt values', async () => {
      const userPriv = new PrivateKey(507);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Token 1: amt=500
      const token1Tx = new Transaction();
      token1Tx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      token1Tx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            lootTableId: 'ancient_rune',
            itemName: 'Ancient Rune',
            icon: '📜',
            rarity: 'legendary',
            tier: 5,
          },
          'deploy+mint',
          500
        ),
        satoshis: 1,
      });

      token1Tx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        token1Tx.id('hex'),
        8008
      );

      // Token 2: amt=250
      const token2Tx = new Transaction();
      token2Tx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      token2Tx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            lootTableId: 'ancient_rune',
            itemName: 'Ancient Rune',
            icon: '📜',
            rarity: 'legendary',
            tier: 5,
          },
          'deploy+mint',
          250
        ),
        satoshis: 1,
      });

      token2Tx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        token2Tx.id('hex'),
        8009
      );

      // Merge transaction
      const mergeTx = new Transaction();

      mergeTx.addInput({
        sourceTransaction: token1Tx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet, "all", false),
      });

      mergeTx.addInput({
        sourceTransaction: token2Tx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet, "all", false),
      });

      const mergedAssetId = token2Tx.id('hex') + '_0';
      mergeTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          mergedAssetId,
          {
            name: 'material_token',
            lootTableId: 'ancient_rune',
            itemName: 'Ancient Rune',
            icon: '📜',
            rarity: 'legendary',
            tier: 5,
          },
          'transfer',
          750  // amt=500+250
        ),
        satoshis: 1,
      });

      await mergeTx.sign();
      const isValid = await mergeTx.verify('scripts only');
      expect(isValid).toBe(true);

      const outputScript = mergeTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('"amt":750');
    });
  });

  describe('Phase 4: Subtract operation with amt field', () => {
    it('should subtract from material quantity via new token with reduced amt', async () => {
      const userPriv = new PrivateKey(508);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Original token: amt=100
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
            lootTableId: 'crystal',
            itemName: 'Crystal',
            icon: '💎',
            rarity: 'epic',
            tier: 3,
          },
          'deploy+mint',
          100
        ),
        satoshis: 1,
      });

      materialTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        materialTx.id('hex'),
        8010
      );

      // Subtract transaction: Reduce to amt=70 (consumed 30)
      const subtractTx = new Transaction();

      subtractTx.addInput({
        sourceTransaction: materialTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet, "single", true),
      });

      const assetId = materialTx.id('hex') + '_0';
      subtractTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          assetId,
          {
            name: 'material_token',
            lootTableId: 'crystal',
            itemName: 'Crystal',
            icon: '💎',
            rarity: 'epic',
            tier: 3,
          },
          'transfer',
          70  // amt=100-30
        ),
        satoshis: 1,
      });

      await subtractTx.sign();
      const isValid = await subtractTx.verify('scripts only');
      expect(isValid).toBe(true);

      const outputScript = subtractTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('"amt":70');
    });

    it('should burn token when amt reaches 0 (no output)', async () => {
      const userPriv = new PrivateKey(509);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Token with amt=5
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
            lootTableId: 'gem',
            itemName: 'Gem',
            icon: '💠',
            rarity: 'rare',
            tier: 2,
          },
          'deploy+mint',
          5
        ),
        satoshis: 1,
      });

      materialTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        materialTx.id('hex'),
        8011
      );

      // Burn transaction: Consume all 5 (no output)
      const burnTx = new Transaction();

      burnTx.addInput({
        sourceTransaction: materialTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      // No output = token burned

      await burnTx.sign();
      const isValid = await burnTx.verify('scripts only');
      expect(isValid).toBe(true);

      // Verify no material output exists
      expect(burnTx.outputs.length).toBe(0);
    });
  });
});
