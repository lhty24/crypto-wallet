/**
 * HD Wallet Derivation Module (BIP32/BIP44)
 *
 * Derives blockchain addresses from a seed using hierarchical deterministic (HD) wallet standards.
 * Supports multiple chains with their respective derivation paths and cryptographic curves.
 *
 * Supported chains:
 * - Bitcoin: secp256k1 curve, P2PKH addresses (legacy, starts with '1')
 * - Ethereum: secp256k1 curve, keccak256 hashed addresses (starts with '0x')
 * - Solana: Ed25519 curve, Base58 public key addresses
 */

import { HDKey, privateKeyToAddress } from "viem/accounts";
import { bytesToHex } from "viem";
import { Keypair } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import bs58check from "bs58check";

// BIP44 coin types
const COIN_TYPE = {
  BITCOIN: 0,
  ETHEREUM: 60,
  SOLANA: 501,
} as const;

/**
 * Derives a Bitcoin address from seed using BIP44 path
 *
 * @param seed - 512-bit seed from mnemonic
 * @param accountIndex - Account number (default: 0)
 * @returns Object containing address, privateKey, and derivation path
 *
 * @example
 * const { address, privateKey, path } = deriveBitcoinAddress(seed);
 * // address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
 * // path: "m/44'/0'/0'/0/0"
 */
export function deriveBitcoinAddress(
  seed: Uint8Array,
  accountIndex: number = 0
): { address: string; privateKey: Uint8Array; path: string } {
  const hdKey = HDKey.fromMasterSeed(seed);

  // Bitcoin BIP44 path: m/44'/0'/account'/0/0
  const path = `m/44'/${COIN_TYPE.BITCOIN}'/${accountIndex}'/0/0`;
  const derived = hdKey.derive(path);

  const privateKey = derived.privateKey!;
  const publicKey = derived.publicKey!;

  // Create P2PKH address (legacy, starts with '1')
  // Hash160 = RIPEMD160(SHA256(publicKey))
  const sha256Hash = sha256(publicKey);
  const hash160 = ripemd160(sha256Hash);

  // Add version byte (0x00 for mainnet) and encode as Base58Check
  const versionedHash = new Uint8Array([0x00, ...hash160]);
  const address = bs58check.encode(versionedHash);

  return {
    address,
    privateKey,
    path,
  };
}

/**
 * Derives an Ethereum address from seed using BIP44 path
 *
 * @param seed - 512-bit seed from mnemonic
 * @param accountIndex - Account number (default: 0)
 * @returns Object containing address, privateKey, and derivation path
 *
 * @example
 * const { address, privateKey, path } = deriveEthereumAddress(seed);
 * // address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78"
 * // path: "m/44'/60'/0'/0/0"
 */
export function deriveEthereumAddress(
  seed: Uint8Array,
  accountIndex: number = 0
): { address: string; privateKey: Uint8Array; path: string } {
  // Create HD key from seed
  // Takes the 512-bit seed (from mnemonic)
  // Creates the master key (root of the key tree)
  // This master key can derive all child keys
  const hdKey = HDKey.fromMasterSeed(seed);

  // Derive using BIP44 path: m/44'/60'/account'/0/0
  const path = `m/44'/${COIN_TYPE.ETHEREUM}'/${accountIndex}'/0/0`;
  const derived = hdKey.derive(path);

  // Get private key and derive address
  const privateKey = derived.privateKey!;

  // Convert private key to hex string with 0x prefix
  const privateKeyHex = bytesToHex(privateKey);

  // Derive address from private key (viem handles secp256k1 + keccak256)
  const address = privateKeyToAddress(privateKeyHex);

  return {
    address,
    privateKey,
    path,
  };
}

/**
 * Derives a Solana address from seed using BIP44 path
 *
 * Note: Solana uses Ed25519 curve and hardened derivation at the end.
 * The address IS the public key (Base58 encoded).
 *
 * @param seed - 512-bit seed from mnemonic
 * @param accountIndex - Account number (default: 0)
 * @returns Object containing address, privateKey (64-byte secretKey), and derivation path
 *
 * @example
 * const { address, privateKey, path } = deriveSolanaAddress(seed);
 * // address: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV"
 * // path: "m/44'/501'/0'/0'"
 */
export function deriveSolanaAddress(
  seed: Uint8Array,
  accountIndex: number = 0
): { address: string; privateKey: Uint8Array; path: string } {
  const hdKey = HDKey.fromMasterSeed(seed);

  // Solana uses hardened derivation at the end: m/44'/501'/account'/0'
  const path = `m/44'/${COIN_TYPE.SOLANA}'/${accountIndex}'/0'`;
  const derived = hdKey.derive(path);

  // Solana uses Ed25519 - create keypair from first 32 bytes of derived key
  const keypair = Keypair.fromSeed(derived.privateKey!.slice(0, 32));

  return {
    address: keypair.publicKey.toBase58(),
    privateKey: keypair.secretKey,
    path,
  };
}
