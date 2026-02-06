import {
	BigNumber,
	type LockingScript,
	OP,
	P2PKH,
	Script,
	type Transaction,
	TransactionSignature,
	UnlockingScript,
	Utils,
	type WalletInterface,
	Hash,
	Signature,
	PublicKey,
} from "@bsv/sdk";
import { calculatePreimage } from "./createPreimage";

export const oLockPrefix =
	"2097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff0262102ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382201008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c0000";
export const oLockSuffix =
	"615179547a75537a537a537a0079537a75527a527a7575615579008763567901c161517957795779210ac407f0e4bd44bfc207355a778b046225a7068fc59ee7eda43ad905aadbffc800206c266b30e6a1319c66dc401e5bd6b432ba49688eecd118297041da8074ce081059795679615679aa0079610079517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01007e81517a75615779567956795679567961537956795479577995939521414136d08c5ed2bf3ba048afe6dcaebafeffffffffffffffffffffffffffffff00517951796151795179970079009f63007952799367007968517a75517a75517a7561527a75517a517951795296a0630079527994527a75517a6853798277527982775379012080517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01205279947f7754537993527993013051797e527e54797e58797e527e53797e52797e57797e0079517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a756100795779ac517a75517a75517a75517a75517a75517a75517a75517a75517a7561517a75517a756169587951797e58797eaa577961007982775179517958947f7551790128947f77517a75517a75618777777777777777777767557951876351795779a9876957795779ac777777777777777767006868";

/**
 * OrdLock class implementing ScriptTemplate.
 *
 * This class provides methods for interacting with OrdinalLock contract 
 */
export default class OrdLock {
	/**
	 * Creates a 1Sat Ordinal Lock script
	 *
	 * @param {string} ordAddress - An address which can cancel listing.
	 * @param {string} payAddress - Address which is paid on purchase
	 * @param {number} price - Listing price in satoshis
	 * @param {string} assetId - AssetID = txid_vout of the minted item
	 * @param {Record<string, any>} itemData - Dropped loot data (metadata)
	 * @returns {Script} - A locking script with inscription.
	 */
	lock(
		ordAddress: string,
		payAddress: string,
		price: number,
		assetId: string,
		itemData: Record<string, any>,
	): Script {
		const cancelPkh = Utils.fromBase58Check(ordAddress).data as number[];
		const payPkh = Utils.fromBase58Check(payAddress).data as number[];

		// OrderLock always uses "transfer" since we're selling already-minted items
		const inscription = {
			p: "bsv-20",
			op: "transfer",
			amt: 1,
			id: assetId,
		};

		// Add metadata headers for ordinal standard
		const metadata = {
			"app": "monsterbattle",
			"type": "ord",
		};
		const combined = {...metadata, ...itemData};

		const jsonString = JSON.stringify(inscription);
		const ordinalMetadataJson = JSON.stringify(combined);

		// Build inscription script
		const script = new Script()
			.writeOpCode(OP.OP_0)
			.writeOpCode(OP.OP_IF)
			.writeBin(Utils.toArray('ord', 'utf8'))
			.writeOpCode(OP.OP_1)
			.writeBin(Utils.toArray('application/bsv-20', 'utf8'))
			.writeOpCode(OP.OP_0)
			.writeBin(Utils.toArray(jsonString, 'utf8'))
			.writeOpCode(OP.OP_ENDIF)

        // Create the full orderLock script with inscription and metadata
		return script.writeScript(Script.fromHex(oLockPrefix))
			.writeBin(cancelPkh)
			.writeBin(OrdLock.buildOutput(price, new P2PKH().lock(payPkh).toBinary()))
			.writeScript(Script.fromHex(oLockSuffix))
			// Add metadata OP_RETURN
			.writeOpCode(OP.OP_RETURN)
			.writeBin(Utils.toArray(ordinalMetadataJson, "utf8"))
	}

	cancelListing(
		wallet: WalletInterface,
		signOutputs: 'all' | 'none' | 'single' = 'all',
		anyoneCanPay = false,
		sourceSatoshis?: number,
		lockingScript?: Script
	): {
		sign: (tx: Transaction, inputIndex: number) => Promise<UnlockingScript>
		estimateLength: () => Promise<number>
	} {
		return {
			sign: async (tx: Transaction, inputIndex: number) => {
				// Calculate preimage using helper
				const { preimage, signatureScope } = calculatePreimage(
					tx,
					inputIndex,
					signOutputs,
					anyoneCanPay,
					sourceSatoshis,
					lockingScript
				);

				// Get public key from wallet
				const { publicKey } = await wallet.getPublicKey({
					protocolID: [0, "monsterbattle"],
					keyID: "0",
					counterparty: 'self'
				});

				// Create signature using BRC-29 pattern
				const { signature } = await wallet.createSignature({
					hashToDirectlySign: Hash.hash256(preimage),
					protocolID: [0, "monsterbattle"],
					keyID: "0",
					counterparty: 'self'
				});

				// Convert signature from DER format
				const rawSignature = Signature.fromDER(signature, 'hex');
				const sig = new TransactionSignature(
					rawSignature.r,
					rawSignature.s,
					signatureScope
				);

				// Build unlocking script with signature + pubkey + OP_1 (cancel flag)
				const unlockScript = new UnlockingScript();
				unlockScript.writeBin(sig.toChecksigFormat());
				unlockScript.writeBin(
					PublicKey.fromString(publicKey).encode(true) as number[]
				);
				unlockScript.writeOpCode(OP.OP_1);

				return unlockScript;
			},
			estimateLength: async () => 108
		}
	}

	purchaseListing(
		sourceSatoshis?: number,
		lockingScript?: Script
	): {
		sign: (tx: Transaction, inputIndex: number) => Promise<UnlockingScript>
		estimateLength: (tx: Transaction, inputIndex: number) => Promise<number>
	} {
		const purchase = {
			sign: async (tx: Transaction, inputIndex: number) => {
				if (tx.outputs.length < 2) {
					throw new Error("Malformed transaction")
				}

				// Build output specifications for the orderLock contract
				const script = new UnlockingScript()
					.writeBin(OrdLock.buildOutput(
						tx.outputs[0].satoshis || 0,
						tx.outputs[0].lockingScript.toBinary()
					))
				if (tx.outputs.length > 2) {
					const writer = new Utils.Writer()
					for (const output of tx.outputs.slice(2)) {
						writer.write(OrdLock.buildOutput(output.satoshis || 0, output.lockingScript.toBinary()))
					}
					script.writeBin(writer.toArray())
				} else {
					script.writeOpCode(OP.OP_0)
				}

				// Calculate preimage using helper
				// Uses SIGHASH_ALL | SIGHASH_ANYONECANPAY | SIGHASH_FORKID
				const { preimage } = calculatePreimage(
					tx,
					inputIndex,
					'all', // SIGHASH_ALL
					true,  // SIGHASH_ANYONECANPAY
					sourceSatoshis,
					lockingScript
				);

				// Build unlocking script: outputs + preimage + OP_0 (purchase flag)
				return script.writeBin(preimage).writeOpCode(OP.OP_0)
			},
			estimateLength: async (tx: Transaction, inputIndex: number) => {
				return (await purchase.sign(tx, inputIndex)).toBinary().length
			}
		}
		return purchase
	}

	static buildOutput(satoshis: number, script: number[]): number[] {
		const writer = new Utils.Writer()
		writer.writeUInt64LEBn(new BigNumber(satoshis))
		writer.writeVarIntNum(script.length)
		writer.write(script)
		return writer.toArray()
	}
}