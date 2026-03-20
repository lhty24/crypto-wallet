/**
 * Password-Based Encryption Module
 *
 * Provides secure encryption/decryption for sensitive data (mnemonics, private keys)
 * using AES-256-GCM with Argon2id key derivation.
 *
 * Security features:
 * - Argon2id: Memory-hard KDF resistant to GPU/ASIC attacks
 * - AES-256-GCM: Authenticated encryption (confidentiality + integrity)
 * - Random salt: Prevents rainbow table attacks
 * - Random nonce: Ensures unique ciphertext for identical plaintexts
 */

import { argon2id } from "@noble/hashes/argon2.js";

const SALT_LENGTH = 32;
const NONCE_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Container for encrypted data with all components needed for decryption
 */
interface EncryptedData {
  ciphertext: Uint8Array;
  salt: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Derives a 256-bit encryption key from a password using Argon2id
 *
 * @param password - User's password
 * @param salt - Random 32-byte salt (must be stored with ciphertext)
 * @returns 32-byte derived key
 */
export function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  return argon2id(password, salt, {
    t: 3, // iterations
    m: 65536, // memory (KB)
    p: 1, // parallel lanes
    dkLen: KEY_LENGTH, // output length (32 bytes = 256 bits)
  });
}

/**
 * Encrypts plaintext using AES-256-GCM with Argon2id key derivation
 *
 * @param plaintext - Data to encrypt (e.g., mnemonic phrase)
 * @param password - User's password for key derivation
 * @returns Encrypted data containing ciphertext, salt, and nonce
 *
 * @example
 * const encrypted = await encrypt("my secret mnemonic", "userPassword123");
 */
export async function encrypt(
  plaintext: string,
  password: string
): Promise<EncryptedData> {
  // Generate random salt and nonce
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));

  // Derive encryption key from password
  const key = deriveKey(password, salt);

  // Import key for Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    "AES-GCM",
    false,
    ["encrypt"]
  );

  // Convert plaintext string to bytes
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Encrypt
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    cryptoKey,
    plaintextBytes
  );

  return {
    ciphertext: new Uint8Array(ciphertextBuffer),
    salt,
    nonce,
  };
}

/**
 * Decrypts data encrypted with the encrypt() function
 *
 * @param encryptedData - Object containing ciphertext, salt, and nonce
 * @param password - Same password used for encryption
 * @returns Decrypted plaintext string
 * @throws Error if password is wrong or data is corrupted (AES-GCM auth fails)
 *
 * @example
 * const mnemonic = await decrypt(encryptedData, "userPassword123");
 */
export async function decrypt(
  encryptedData: EncryptedData,
  password: string
): Promise<string> {
  // Derive the same key using stored salt
  const key = deriveKey(password, encryptedData.salt);

  // Import key for Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    "AES-GCM",
    false,
    ["decrypt"]
  );

  // Decrypt
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: encryptedData.nonce },
    cryptoKey,
    encryptedData.ciphertext
  );

  // Convert bytes back to string
  return new TextDecoder().decode(plaintextBuffer);
}
