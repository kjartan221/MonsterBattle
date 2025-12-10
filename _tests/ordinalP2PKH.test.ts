import {
  Transaction,
  PrivateKey,
  MerklePath,
  Script,
  Utils,
  Random
} from '@bsv/sdk';
import { OrdinalsP2PKH } from '../src/utils/ordinalP2PKH';
import { makeWallet } from './helpers/mockWallet';

describe('OrdinalsP2PKH - Transaction Validation', () => {
  const storageURL = 'https://store-us-1.bsvb.tech';

  describe('deploy+mint and spend cycle', () => {
    it('should create a valid deploy+mint transaction and spend it successfully', async () => {
      // Generate deterministic test keys
      const userPriv = new PrivateKey(1);
      const keyID = Utils.toBase64(Random(8));

      // Create wallet with proper key derivation
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      // Get the public key using the same protocolID and keyID as OrdinalsP2PKH
      const { publicKey: userLockingKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Step 1: Create source transaction with deploy+mint locking script
      const assetId = 'test_item_txid_0';
      const itemData = {
        name: 'Dragon Scale',
        rarity: 'legendary',
        type: 'material',
        tier: 3,
        icon: '🐲'
      };

      const sourceTransaction = new Transaction();
      sourceTransaction.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE')
      });

      // Create the OrdinalsP2PKH locking script (deploy+mint)
      const lockingScript = new OrdinalsP2PKH().lock(
        userLockingKey,
        assetId,
        itemData,
        'deploy+mint'
      );

      sourceTransaction.addOutput({
        lockingScript,
        satoshis: 1
      });

      // Add merkle proof (required for inputs)
      sourceTransaction.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        sourceTransaction.id('hex'),
        1234
      );

      // Step 2: Create spending transaction
      const spendingTx = new Transaction();

      spendingTx.addInput({
        sourceTransaction,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet)
      });

      // Add output (transfer to same address)
      spendingTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userLockingKey,
          assetId,
          { transferred: true },
          'transfer'
        ),
        satoshis: 1
      });

      // Step 3: Sign and verify the transaction
      await spendingTx.fee();
      await spendingTx.sign();

      const isValid = await spendingTx.verify('scripts only');

      expect(isValid).toBe(true);
    }, 30000); // 30 second timeout for network operations

    it('should create a valid transfer transaction from existing NFT', async () => {
      const userPriv = new PrivateKey(2);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userLockingKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const assetId = 'existing_nft_txid_0';
      const itemData = {
        name: 'Excalibur',
        rarity: 'legendary',
        type: 'weapon',
        damageBonus: 100
      };

      // Source transaction (already minted NFT)
      const sourceTransaction = new Transaction();
      sourceTransaction.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE')
      });

      const lockingScript = new OrdinalsP2PKH().lock(
        userLockingKey,
        assetId,
        itemData,
        'transfer' // Already minted, just transferring
      );

      sourceTransaction.addOutput({
        lockingScript,
        satoshis: 1
      });

      sourceTransaction.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        sourceTransaction.id('hex'),
        1234
      );

      // Spending transaction (transfer to same owner)
      const spendingTx = new Transaction();

      spendingTx.addInput({
        sourceTransaction,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet)
      });

      spendingTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userLockingKey,
          assetId,
          { ...itemData, transferCount: 1 },
          'transfer'
        ),
        satoshis: 1
      });

      await spendingTx.fee();
      await spendingTx.sign();

      const isValid = await spendingTx.verify('scripts only');

      expect(isValid).toBe(true);
    }, 30000);

    it('should handle multiple UTXOs with different items', async () => {
      const userPriv = new PrivateKey(3);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userLockingKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Create two source transactions with different items
      const sourceTransaction1 = new Transaction();
      sourceTransaction1.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE')
      });

      sourceTransaction1.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userLockingKey,
          'item_1_txid_0',
          { name: 'Iron Sword', type: 'weapon' },
          'deploy+mint'
        ),
        satoshis: 1
      });

      sourceTransaction1.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        sourceTransaction1.id('hex'),
        1000
      );

      const sourceTransaction2 = new Transaction();
      sourceTransaction2.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE')
      });

      sourceTransaction2.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userLockingKey,
          'item_2_txid_0',
          { name: 'Steel Armor', type: 'armor' },
          'deploy+mint'
        ),
        satoshis: 1
      });

      sourceTransaction2.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        sourceTransaction2.id('hex'),
        1001
      );

      // Spending transaction that consumes both
      const spendingTx = new Transaction();

      spendingTx.addInput({
        sourceTransaction: sourceTransaction1,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet)
      });

      spendingTx.addInput({
        sourceTransaction: sourceTransaction2,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet)
      });

      // Consolidate into one output
      spendingTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userLockingKey,
          'item_1_txid_0',
          { name: 'Iron Sword', consolidated: true },
          'transfer'
        ),
        satoshis: 1
      });

      await spendingTx.fee();
      await spendingTx.sign();

      const isValid = await spendingTx.verify('scripts only');

      expect(isValid).toBe(true);
    }, 30000);
  });

  describe('complex item data preservation', () => {
    it('should preserve complex nested item metadata through transaction', async () => {
      const userPriv = new PrivateKey(4);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userLockingKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // Complex item with nested data
      const complexItemData = {
        name: 'Legendary Excalibur',
        type: 'weapon',
        rarity: 'legendary',
        tier: 5,
        stats: {
          damageBonus: 100,
          critChance: 50,
          special: ['holy_damage', 'undead_slayer']
        },
        provenance: {
          craftedBy: 'blacksmith_123',
          craftedAt: '2025-12-10T12:00:00Z',
          materials: ['dragon_scale', 'phoenix_feather']
        },
        inscriptions: {
          prefix: { type: 'Legendary', value: 10 },
          suffix: { type: 'of Power', value: 20 }
        }
      };

      const sourceTransaction = new Transaction();
      sourceTransaction.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE')
      });

      sourceTransaction.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userLockingKey,
          'complex_item_txid_0',
          complexItemData,
          'deploy+mint'
        ),
        satoshis: 1
      });

      sourceTransaction.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        sourceTransaction.id('hex'),
        1234
      );

      const spendingTx = new Transaction();
      spendingTx.addInput({
        sourceTransaction,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet)
      });

      spendingTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userLockingKey,
          'complex_item_txid_0',
          { ...complexItemData, transferCount: 1 },
          'transfer'
        ),
        satoshis: 1
      });

      await spendingTx.fee();
      await spendingTx.sign();

      const isValid = await spendingTx.verify('scripts only');
      expect(isValid).toBe(true);

      // Verify metadata is preserved in the output
      const outputScript = spendingTx.outputs[0].lockingScript.toHex();
      const scriptAscii = Buffer.from(outputScript, 'hex').toString('ascii');

      // Check key metadata fields are present
      expect(scriptAscii).toContain('Legendary Excalibur');
      expect(scriptAscii).toContain('dragon_scale');
      expect(scriptAscii).toContain('blacksmith_123');
    }, 30000);
  });

  describe('unlock template options', () => {
    it('should work with different sign output modes', async () => {
      const userPriv = new PrivateKey(5);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const { publicKey: userLockingKey } = await userWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const sourceTransaction = new Transaction();
      sourceTransaction.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE')
      });

      sourceTransaction.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userLockingKey,
          'test_txid_0',
          { name: 'Test Item' },
          'deploy+mint'
        ),
        satoshis: 1
      });

      sourceTransaction.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        sourceTransaction.id('hex'),
        1234
      );

      // Test with 'all' sign output mode
      const spendingTxAll = new Transaction();
      spendingTxAll.addInput({
        sourceTransaction,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userWallet, 'all')
      });

      spendingTxAll.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userLockingKey,
          'test_txid_0',
          { transferred: true },
          'transfer'
        ),
        satoshis: 1
      });

      await spendingTxAll.fee();
      await spendingTxAll.sign();

      const isValidAll = await spendingTxAll.verify('scripts only');
      expect(isValidAll).toBe(true);
    }, 30000);

    it('should estimate unlock script length correctly', async () => {
      const userPriv = new PrivateKey(6);
      const userWallet = await makeWallet('main', storageURL, userPriv.toHex());

      const unlockTemplate = new OrdinalsP2PKH().unlock(userWallet);

      const estimatedLength = await unlockTemplate.estimateLength();

      expect(estimatedLength).toBe(108);
      expect(typeof estimatedLength).toBe('number');
      expect(estimatedLength).toBeGreaterThan(0);
    }, 30000);
  });

  describe('transfer between different users', () => {
    it('should transfer NFT from user A to user B', async () => {
      // User A creates and owns the NFT initially
      const userAPriv = new PrivateKey(7);
      const userAWallet = await makeWallet('main', storageURL, userAPriv.toHex());

      const { publicKey: userALockingKey } = await userAWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      // User B will receive the NFT
      const userBPriv = new PrivateKey(8);
      const userBWallet = await makeWallet('main', storageURL, userBPriv.toHex());

      const { publicKey: userBLockingKey } = await userBWallet.getPublicKey({
        protocolID: [0, "monsterbattle"],
        keyID: "0",
        counterparty: "self",
      });

      const assetId = 'transfer_test_txid_0';
      const itemData = {
        name: 'Transferable Sword',
        rarity: 'rare',
        type: 'weapon'
      };

      // Source transaction locked to User A
      const sourceTransaction = new Transaction();
      sourceTransaction.addInput({
        sourceTXID: '0000000000000000000000000000000000000000000000000000000000000000',
        sourceOutputIndex: 0,
        unlockingScript: Script.fromASM('OP_TRUE')
      });

      sourceTransaction.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userALockingKey,
          assetId,
          itemData,
          'deploy+mint'
        ),
        satoshis: 1
      });

      sourceTransaction.merklePath = MerklePath.fromCoinbaseTxidAndHeight(
        sourceTransaction.id('hex'),
        1234
      );

      // User A transfers to User B
      const transferTx = new Transaction();

      transferTx.addInput({
        sourceTransaction,
        sourceOutputIndex: 0,
        unlockingScriptTemplate: new OrdinalsP2PKH().unlock(userAWallet) // User A signs
      });

      transferTx.addOutput({
        lockingScript: new OrdinalsP2PKH().lock(
          userBLockingKey, // Locked to User B
          assetId,
          { ...itemData, transferredTo: 'userB' },
          'transfer'
        ),
        satoshis: 1
      });

      await transferTx.fee();
      await transferTx.sign();

      const isValid = await transferTx.verify('scripts only');
      expect(isValid).toBe(true);
    }, 30000);
  });
});
