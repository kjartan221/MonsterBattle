/**
 * Integration tests for OrdinalsP2PKH - Item Minting Flow
 * Tests the transaction flow for minting dropped items as NFTs
 */

import {
  Transaction,
  PrivateKey,
  MerklePath,
  Script,
} from '@bsv/sdk';
import { OrdinalsP2PKH } from '../src/utils/ordinalP2PKH';
import { makeWallet } from './helpers/mockWallet';

describe('OrdinalsP2PKH - Item Minting Flow', () => {
  const storageURL = 'https://store-us-1.bsvb.tech';

  describe('Mint dropped item as NFT', () => {
    it('should create valid minting transaction with game_item metadata', async () => {
      const userPriv = new PrivateKey(100);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Item metadata from monster drop
      const itemMetadata = {
        name: 'game_item',
        itemName: 'Dragon Scale',
        description: 'A legendary dragon scale',
        icon: '🐲',
        rarity: 'legendary',
        itemType: 'material',
        tier: 3,
        stats: {},
        crafted: null,
        enhancements: {
          prefix: null,
          suffix: null,
        },
        visual: {
          borderGradient: {
            color1: '#ff0000',
            color2: '#00ff00',
          },
        },
        acquiredFrom: {
          monsterId: 'monster_123',
          monsterName: 'Ancient Dragon',
          biome: 'volcano',
          tier: 3,
          acquiredAt: '2025-12-12T00:00:00Z',
        },
      };

      // Create minting transaction
      const mintTx = new Transaction();
      mintTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      const lockingScript = new OrdinalsP2PKH().lock(
        userPubKey,
        '', // Empty for minting
        itemMetadata,
        'deploy+mint'
      );

      mintTx.addOutput({
        lockingScript,
        satoshis: 1,
      });

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        1000
      );

      // Verify metadata is in locking script
      const outputScript = mintTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('monsterbattle');
      expect(scriptAscii).toContain('Dragon Scale');
      expect(scriptAscii).toContain('game_item');
      expect(mintTx.outputs[0].satoshis).toBe(1);
    });

    it('should create valid minting transaction with equipment stats', async () => {
      const userPriv = new PrivateKey(101);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userPubKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Equipment item metadata
      const equipmentMetadata = {
        name: 'game_item',
        itemName: 'Excalibur',
        description: 'The legendary sword',
        icon: '⚔️',
        rarity: 'legendary',
        itemType: 'weapon',
        tier: 5,
        stats: {
          damageBonus: 100,
          critChance: 50,
        },
        crafted: null,
        enhancements: {
          prefix: null,
          suffix: null,
        },
        visual: {
          borderGradient: {
            color1: '#gold',
            color2: '#silver',
          },
        },
        acquiredFrom: null,
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
          equipmentMetadata,
          'deploy+mint'
        ),
        satoshis: 1,
      });

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        2000
      );

      const outputScript = mintTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      expect(scriptAscii).toContain('Excalibur');
      expect(scriptAscii).toContain('weapon');
    });
  });

  describe('Transfer minted item', () => {
    it('should transfer minted item between users', async () => {
      // User A mints the item
      const userAPriv = new PrivateKey(102);
      const userAWallet = await makeWallet('main', storageURL, userAPriv.toHex());

      const { publicKey: userAPubKey } = await userAWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // User B receives the item
      const userBPriv = new PrivateKey(103);
      const userBWallet = await makeWallet('main', storageURL, userBPriv.toHex());

      const { publicKey: userBPubKey } = await userBWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const itemMetadata = {
        name: 'game_item',
        itemName: 'Rare Sword',
        rarity: 'rare',
        itemType: 'weapon',
        stats: { damageBonus: 50 },
      };

      // Step 1: User A mints the item
      const mintTx = new Transaction();
      mintTx.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE'),
      });

      mintTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userAPubKey,
          '',
          itemMetadata,
          'deploy+mint'
        ),
        satoshis: 1,
      });

      mintTx.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        mintTx.id('hex'),
        3000
      );

      // Step 2: User A transfers to User B
      const transferTx = new Transaction();
      transferTx.addInput({
        sourceTransaction: mintTx,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userAWallet),
      });

      const assetId = mintTx.id('hex') + '_0';
      transferTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userBPubKey,
          assetId,
          { ...itemMetadata, transferred: true },
          'transfer'
        ),
        satoshis: 1,
      });

      // Skip fee calculation, sign and verify
      await transferTx.sign();
      const isValid = await transferTx.verify('scripts only');
      expect(isValid).toBe(true);
    });
  });
});
