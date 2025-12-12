/**
 * Integration tests for OrdinalsP2PKH - Crafting Flow
 * Tests the transaction flow for crafting items by consuming multiple inputs
 */

import {
  Transaction,
  PrivateKey,
  MerklePath,
  Script,
} from '@bsv/sdk';
import { OrdinalsP2PKH } from '../src/utils/ordinalP2PKH';
import { makeWallet } from './helpers/mockWallet';

describe('OrdinalsP2PKH - Crafting Flow', () => {
  const storageURL = 'https://store-us-1.bsvb.tech';

  describe('Craft item from materials', () => {
    it('should create valid crafting transaction consuming 3 material inputs', async () => {
      const userPriv = new PrivateKey(200);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Create 3 input transactions (material tokens)
      const materialInputs: Transaction[] = [];
      const materialNames = ['Iron Ore', 'Dragon Scale', 'Phoenix Feather'];

      for (let i = 0; i < 3; i++) {
        const inputTx = new Transaction();
        inputTx.addInput({
          sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
          sourceOutputIndex: i,
          unlockingScript: Script.fromASM('OP_TRUE'),
        });

        const materialMetadata = {
          name: 'material_token',
          materialName: materialNames[i],
          icon: '⚙️',
          rarity: 'rare',
          quantity: 5,
        };

        inputTx.addOutput({
          lockingScript: new OrdinalsP2PKH().lock(
            userPubKey,
            '',
            materialMetadata,
            'deploy+mint'
          ),
          satoshis: 1,
        });

        inputTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
          inputTx.id('hex'),
          1000 + i
        );

        materialInputs.push(inputTx);
      }

      // Create crafting transaction consuming all 3 inputs
      const craftTx = new Transaction();

      // Add all material inputs
      for (const inputTx of materialInputs) {
        craftTx.addInput({
          sourceTransaction: inputTx,
          sourceOutputIndex: 0,
          unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
        });
      }

      // Crafted item metadata
      const craftedMetadata = {
        name: 'game_item',
        itemName: 'Dragon Sword',
        description: 'Forged from dragon scales',
        icon: '⚔️',
        rarity: 'epic',
        itemType: 'weapon',
        tier: 2,
        stats: {
          damageBonus: 25,
          critChance: 20,
        },
        crafted: true,
        statRoll: 1.15, // 15% bonus roll
        rolledStats: {
          damageBonus: 29, // 25 * 1.15
          critChance: 23,  // 20 * 1.15
        },
        materialsUsed: [
          { name: 'Iron Ore', quantity: 5 },
          { name: 'Dragon Scale', quantity: 5 },
          { name: 'Phoenix Feather', quantity: 5 },
        ],
        craftedAt: '2025-12-12T00:00:00Z',
      };

      // Output: Crafted item
      craftTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '', // Empty for new craft
          craftedMetadata,
          'deploy+mint'
        ),
        satoshis: 1,
      });

      // Sign and verify without fee calculation
      await craftTx.sign();
      const isValid = await craftTx.verify('scripts only');
      expect(isValid).toBe(true);

      // Verify metadata in output
      const outputScript = craftTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('Dragon Sword');
      expect(scriptAscii).toContain('crafted');
      expect(scriptAscii).toContain('statRoll');
      expect(craftTx.outputs[0].satoshis).toBe(1);
    });

    it('should create crafting transaction with equipment upgrade', async () => {
      const userPriv = new PrivateKey(201);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Input 1: Existing weapon
      const weaponTx = new Transaction();
      weaponTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      weaponTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'game_item',
            itemName: 'Iron Sword',
            icon: '⚔️',
            rarity: 'rare',
            itemType: 'weapon',
            tier: 1,
            stats: { damageBonus: 10 },
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      weaponTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        weaponTx.id('hex'),
        2000
      );

      // Input 2: Upgrade material
      const upgradeTx = new Transaction();
      upgradeTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      upgradeTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'material_token',
            materialName: 'Steel Ingot',
            icon: '🔩',
            rarity: 'epic',
            quantity: 10,
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      upgradeTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        upgradeTx.id('hex'),
        2001
      );

      // Crafting transaction
      const craftTx = new Transaction();

      craftTx.addInput({
        sourceTransaction: weaponTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      craftTx.addInput({
        sourceTransaction: upgradeTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      // Upgraded weapon output
      const upgradedMetadata = {
        name: 'game_item',
        itemName: 'Steel Sword',
        description: 'Upgraded with steel',
        icon: '⚔️',
        rarity: 'epic',
        itemType: 'weapon',
        tier: 2,
        stats: {
          damageBonus: 20, // Doubled
        },
        crafted: true,
        statRoll: 1.05,
        rolledStats: {
          damageBonus: 21,
        },
        previousVersion: {
          name: 'Iron Sword',
          tier: 1,
        },
        craftedAt: '2025-12-12T00:00:00Z',
      };

      craftTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          upgradedMetadata,
          'deploy+mint'
        ),
        satoshis: 1,
      });

      // Sign and verify without fee calculation
      await craftTx.sign();
      const isValid = await craftTx.verify('scripts only');
      expect(isValid).toBe(true);

      // Verify metadata in output
      const outputScript = craftTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('Steel Sword');
      expect(scriptAscii).toContain('previousVersion');
    });
  });

  describe('Multi-output crafting', () => {
    it('should create crafting transaction with multiple outputs', async () => {
      const userPriv = new PrivateKey(202);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Input: Large material stack
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
            materialName: 'Iron Ore',
            icon: '⛏️',
            rarity: 'common',
            quantity: 100,
          },
          'deploy+mint'
        ),
        satoshis: 10, // Enough to split into 4 outputs (3 swords + 1 change)
      });

      materialTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        materialTx.id('hex'),
        3000
      );

      // Crafting transaction: Split into 3 swords
      const craftTx = new Transaction();

      craftTx.addInput({
        sourceTransaction: materialTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      // Output 3 swords (consume 30 ore each = 90 total)
      for (let i = 0; i < 3; i++) {
        craftTx.addOutput({
          lockingScript: new OrdinalsP2PKH().lock(
            userPubKey,
            '',
            {
              name: 'game_item',
              itemName: `Iron Sword #${i + 1}`,
              icon: '⚔️',
              rarity: 'common',
              itemType: 'weapon',
              tier: 1,
              stats: { damageBonus: 5 },
              crafted: true,
              materialsUsed: [{ name: 'Iron Ore', quantity: 30 }],
            },
            'deploy+mint'
          ),
          satoshis: 1,
        });
      }

      // Change output: Remaining 10 ore
      craftTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          materialTx.id('hex') + '_0',
          {
            name: 'material_token',
            materialName: 'Iron Ore',
            icon: '⛏️',
            rarity: 'common',
            quantity: 10, // 100 - 90
          },
          'transfer'
        ),
        satoshis: 1,
      });

      // Sign and verify without fee calculation
      await craftTx.sign();
      const isValid = await craftTx.verify('scripts only');
      expect(isValid).toBe(true);

      // Verify outputs
      expect(craftTx.outputs.length).toBe(4); // 3 swords + 1 change

      const sword1Script = craftTx.outputs[0].lockingScript.toHex();
      const sword1Ascii = Buffer.from(sword1Script, 'hex').toString('ascii');
      expect(sword1Ascii).toContain('Iron Sword #1');

      const changeScript = craftTx.outputs[3].lockingScript.toHex();
      const changeAscii = Buffer.from(changeScript, 'hex').toString('ascii');
      expect(changeAscii).toContain('Iron Ore');
    });
  });
});
