/**
 * BIP39 Mnemonic Generation and Validation
 *
 * This module provides functions for generating and validating BIP39 mnemonic phrases,
 * which are the foundation of HD (Hierarchical Deterministic) wallets.
 *
 * Security Note: Mnemonics are the master key to all derived accounts.
 * They should never be logged, transmitted, or stored in plaintext.
 */

import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

// Type for mnemonic strength (entropy bits)
// 128 bits = 12 words, 256 bits = 24 words
export type MnemonicStrength = 128 | 256;

/**
 * Generates a new BIP39 mnemonic phrase
 *
 * @param strength - Entropy bits: 128 (12 words) or 256 (24 words). Default: 128
 * @returns A space-separated mnemonic phrase
 *
 * @example
 * const mnemonic = generateMnemonic(); // 12 words
 * const strongMnemonic = generateMnemonic(256); // 24 words
 */
export function generateMnemonic(strength: MnemonicStrength = 128): string {
  return bip39.generateMnemonic(wordlist, strength);
}

/**
 * Validates a BIP39 mnemonic phrase
 *
 * Checks that:
 * 1. All words are in the English BIP39 wordlist
 * 2. The checksum is valid
 *
 * @param mnemonic - Space-separated mnemonic phrase to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * validateMnemonic("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"); // true
 * validateMnemonic("invalid words here"); // false
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic, wordlist);
}

/**
 * Converts a BIP39 mnemonic to a 512-bit seed
 *
 * Uses PBKDF2 with 2048 iterations to derive the seed.
 * The optional passphrase provides an extra layer of security (sometimes called "25th word").
 *
 * @param mnemonic - Valid BIP39 mnemonic phrase
 * @param passphrase - Optional passphrase for additional security. Default: ""
 * @returns 64-byte (512-bit) seed as Uint8Array
 *
 * @example
 * const seed = mnemonicToSeed("abandon abandon ..."); // 64 bytes
 * const seedWithPass = mnemonicToSeed("abandon abandon ...", "mySecretPassphrase");
 */
export function mnemonicToSeed(
  mnemonic: string,
  passphrase?: string
): Uint8Array {
  return bip39.mnemonicToSeedSync(mnemonic, passphrase);
}
