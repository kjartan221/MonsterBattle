/**
 * Integration tests for OrdinalsP2PKH - Equipment Update Flow
 * Tests the transaction flow for applying inscription scrolls to equipment
 */

import {
  Transaction,
  PrivateKey,
  MerklePath,
  Script,
} from '@bsv/sdk';
import { OrdinalsP2PKH } from '../src/utils/ordinalP2PKH';
import { makeWallet } from './helpers/mockWallet';

describe('OrdinalsP2PKH - Equipment Update Flow', () => {
  const storageURL = 'https://store-us-1.bsvb.tech';

  describe('Apply prefix inscription', () => {
    it('should create valid transaction applying prefix scroll to weapon', async () => {
      const userPriv = new PrivateKey(300);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Input 1: Weapon
      const weaponTx = new Transaction();
      weaponTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      const weaponMetadata = {
        name: 'game_item',
        itemName: 'Steel Sword',
        icon: '⚔️',
        rarity: 'rare',
        itemType: 'weapon',
        tier: 2,
        stats: {
          damageBonus: 15,
          critChance: 10,
        },
        crafted: true,
        statRoll: 1.0,
        rolledStats: {
          damageBonus: 15,
          critChance: 10,
        },
        enhancements: {
          prefix: null,
          suffix: null,
        },
      };

      weaponTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          weaponMetadata,
          'deploy+mint'
        ),
        satoshis: 1,
      });

      weaponTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        weaponTx.id('hex'),
        4000
      );

      // Input 2: Inscription scroll (prefix)
      const scrollTx = new Transaction();
      scrollTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      scrollTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'game_item',
            itemName: 'Godly Inscription',
            icon: '📜',
            rarity: 'legendary',
            itemType: 'consumable',
            inscriptionType: 'prefix',
            inscriptionName: 'Godly',
            statBonus: {
              damageBonus: 10,
            },
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      scrollTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        scrollTx.id('hex'),
        4001
      );

      // Update transaction
      const updateTx = new Transaction();

      updateTx.addInput({
        sourceTransaction: weaponTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      updateTx.addInput({
        sourceTransaction: scrollTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      // Updated weapon with prefix
      const updatedMetadata = {
        ...weaponMetadata,
        itemName: 'Godly Steel Sword',
        stats: {
          damageBonus: 25, // 15 + 10
          critChance: 10,
        },
        rolledStats: {
          damageBonus: 25,
          critChance: 10,
        },
        enhancements: {
          prefix: {
            name: 'Godly',
            statBonus: { damageBonus: 10 },
            rarity: 'legendary',
          },
          suffix: null,
        },
        updatedAt: '2025-12-12T00:00:00Z',
      };

      const assetId = weaponTx.id('hex') + '_0';
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

      expect(scriptAscii).toContain('Godly');
      expect(scriptAscii).toContain('Steel Sword');
      expect(updateTx.outputs[0].satoshis).toBe(1);
    });

    it('should create valid transaction applying suffix scroll to armor', async () => {
      const userPriv = new PrivateKey(301);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Input 1: Armor
      const armorTx = new Transaction();
      armorTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      armorTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'game_item',
            itemName: 'Chainmail',
            icon: '🛡️',
            rarity: 'rare',
            itemType: 'armor',
            tier: 2,
            stats: {
              defense: 20,
              maxHpBonus: 50,
            },
            enhancements: {
              prefix: null,
              suffix: null,
            },
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      armorTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        armorTx.id('hex'),
        4100
      );

      // Input 2: Suffix scroll
      const scrollTx = new Transaction();
      scrollTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      scrollTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'game_item',
            itemName: 'Inscription of Titans',
            icon: '📜',
            rarity: 'epic',
            itemType: 'consumable',
            inscriptionType: 'suffix',
            inscriptionName: 'of Titans',
            statBonus: {
              maxHpBonus: 100,
            },
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      scrollTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        scrollTx.id('hex'),
        4101
      );

      // Update transaction
      const updateTx = new Transaction();

      updateTx.addInput({
        sourceTransaction: armorTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      updateTx.addInput({
        sourceTransaction: scrollTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      const updatedMetadata = {
        name: 'game_item',
        itemName: 'Chainmail of Titans',
        icon: '🛡️',
        rarity: 'epic', // Upgraded rarity
        itemType: 'armor',
        tier: 2,
        stats: {
          defense: 20,
          maxHpBonus: 150, // 50 + 100
        },
        enhancements: {
          prefix: null,
          suffix: {
            name: 'of Titans',
            statBonus: { maxHpBonus: 100 },
            rarity: 'epic',
          },
        },
        updatedAt: '2025-12-12T00:00:00Z',
      };

      const assetId = armorTx.id('hex') + '_0';
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

      expect(scriptAscii).toContain('of Titans');
      expect(scriptAscii).toContain('Chainmail');
    });
  });

  describe('Apply both prefix and suffix', () => {
    it('should create transaction applying both inscriptions sequentially', async () => {
      const userPriv = new PrivateKey(302);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Starting weapon
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
            itemName: 'Ancient Blade',
            icon: '🗡️',
            rarity: 'epic',
            itemType: 'weapon',
            tier: 4,
            stats: {
              damageBonus: 50,
              critChance: 25,
            },
            enhancements: {
              prefix: null,
              suffix: null,
            },
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      weaponTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        weaponTx.id('hex'),
        5000
      );

      // Step 1: Apply prefix
      const prefixScrollTx = new Transaction();
      prefixScrollTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      prefixScrollTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'game_item',
            itemName: 'Demonic Inscription',
            icon: '📜',
            rarity: 'legendary',
            itemType: 'consumable',
            inscriptionType: 'prefix',
            inscriptionName: 'Demonic',
            statBonus: { damageBonus: 20 },
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      prefixScrollTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        prefixScrollTx.id('hex'),
        5001
      );

      const update1Tx = new Transaction();

      update1Tx.addInput({
        sourceTransaction: weaponTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      update1Tx.addInput({
        sourceTransaction: prefixScrollTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      const afterPrefix = {
        name: 'game_item',
        itemName: 'Demonic Ancient Blade',
        icon: '🗡️',
        rarity: 'legendary',
        itemType: 'weapon',
        tier: 4,
        stats: {
          damageBonus: 70, // 50 + 20
          critChance: 25,
        },
        enhancements: {
          prefix: {
            name: 'Demonic',
            statBonus: { damageBonus: 20 },
            rarity: 'legendary',
          },
          suffix: null,
        },
      };

      const assetId1 = weaponTx.id('hex') + '_0';
      update1Tx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          assetId1,
          afterPrefix,
          'transfer'
        ),
        satoshis: 1,
      });

      // Sign and verify first update without fee calculation
      await update1Tx.sign();
      const isValid1 = await update1Tx.verify('scripts only');
      expect(isValid1).toBe(true);

      // Add merkle path for use in next transaction
      update1Tx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        update1Tx.id('hex'),
        5002
      );

      // Step 2: Apply suffix
      const suffixScrollTx = new Transaction();
      suffixScrollTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      suffixScrollTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'game_item',
            itemName: 'Inscription of Annihilation',
            icon: '📜',
            rarity: 'legendary',
            itemType: 'consumable',
            inscriptionType: 'suffix',
            inscriptionName: 'of Annihilation',
            statBonus: { critChance: 15 },
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      suffixScrollTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        suffixScrollTx.id('hex'),
        5003
      );

      const update2Tx = new Transaction();

      update2Tx.addInput({
        sourceTransaction: update1Tx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      update2Tx.addInput({
        sourceTransaction: suffixScrollTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      const fullyEnhanced = {
        name: 'game_item',
        itemName: 'Demonic Ancient Blade of Annihilation',
        icon: '🗡️',
        rarity: 'legendary',
        itemType: 'weapon',
        tier: 4,
        stats: {
          damageBonus: 70,
          critChance: 40, // 25 + 15
        },
        enhancements: {
          prefix: {
            name: 'Demonic',
            statBonus: { damageBonus: 20 },
            rarity: 'legendary',
          },
          suffix: {
            name: 'of Annihilation',
            statBonus: { critChance: 15 },
            rarity: 'legendary',
          },
        },
      };

      const assetId2 = update1Tx.id('hex') + '_0';
      update2Tx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          assetId2,
          fullyEnhanced,
          'transfer'
        ),
        satoshis: 1,
      });

      // Sign and verify second update without fee calculation
      await update2Tx.sign();
      const isValid2 = await update2Tx.verify('scripts only');
      expect(isValid2).toBe(true);

      // Verify final metadata
      const outputScript = update2Tx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('Demonic');
      expect(scriptAscii).toContain('of Annihilation');
      expect(scriptAscii).toContain('Ancient Blade');
    });
  });

  describe('Overwrite existing inscription', () => {
    it('should replace existing prefix with new one', async () => {
      const userPriv = new PrivateKey(303);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Weapon with existing prefix
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
            itemName: 'Mighty Sword',
            icon: '⚔️',
            rarity: 'rare',
            itemType: 'weapon',
            tier: 3,
            stats: {
              damageBonus: 25, // 20 base + 5 from "Mighty"
            },
            enhancements: {
              prefix: {
                name: 'Mighty',
                statBonus: { damageBonus: 5 },
                rarity: 'rare',
              },
              suffix: null,
            },
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      weaponTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        weaponTx.id('hex'),
        6000
      );

      // New prefix scroll (better stats)
      const scrollTx = new Transaction();
      scrollTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      scrollTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userPubKey,
          '',
          {
            name: 'game_item',
            itemName: 'Godly Inscription',
            icon: '📜',
            rarity: 'legendary',
            itemType: 'consumable',
            inscriptionType: 'prefix',
            inscriptionName: 'Godly',
            statBonus: { damageBonus: 15 },
          },
          'deploy+mint'
        ),
        satoshis: 1,
      });

      scrollTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        scrollTx.id('hex'),
        6001
      );

      // Overwrite transaction
      const updateTx = new Transaction();

      updateTx.addInput({
        sourceTransaction: weaponTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      updateTx.addInput({
        sourceTransaction: scrollTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet),
      });

      // Remove old prefix bonus, add new one
      const updatedMetadata = {
        name: 'game_item',
        itemName: 'Godly Sword',
        icon: '⚔️',
        rarity: 'legendary',
        itemType: 'weapon',
        tier: 3,
        stats: {
          damageBonus: 35, // 20 base + 15 from "Godly"
        },
        enhancements: {
          prefix: {
            name: 'Godly',
            statBonus: { damageBonus: 15 },
            rarity: 'legendary',
            replacedPrevious: 'Mighty', // Track what was replaced
          },
          suffix: null,
        },
      };

      const assetId = weaponTx.id('hex') + '_0';
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

      // Verify overwrite worked
      const outputScript = updateTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('Godly');
      expect(scriptAscii).toContain('replacedPrevious'); // Metadata tracks what was replaced
      expect(scriptAscii).toContain('Mighty'); // Old inscription name stored for provenance
    });
  });
});
