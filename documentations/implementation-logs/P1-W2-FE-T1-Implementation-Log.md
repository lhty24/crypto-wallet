# P1-W2-FE-T1: Client-Side Cryptographic Functionality

**Phase**: 1 - Foundation
**Week**: 2 - Basic Wallet Operations
**Task**: Frontend Task 1 - Implement client-side cryptographic functionality
**Date**: January 2026
**Status**: Completed ✅

---

## Overview

Implemented the core cryptographic functionality for a non-custodial cryptocurrency wallet. All sensitive operations (mnemonic generation, encryption, key derivation) happen client-side - the backend never sees private keys or mnemonics.

### Components Built

| Component | File | Purpose |
|-----------|------|---------|
| BIP39 Mnemonic | `mnemonic.ts` | Generate/validate seed phrases |
| AES-256-GCM Encryption | `encryption.ts` | Password-based encryption with Argon2 |
| HD Wallet Derivation | `hdwallet.ts` | BIP32/BIP44 address derivation |
| Secure Memory | `secureMemory.ts` | Memory cleanup utilities |

---

## Implementation Details

### 1. BIP39 Mnemonic Generation (`mnemonic.ts`)

**Purpose**: Generate cryptographically secure seed phrases that can derive all wallet keys.

**Key Concepts**:
- **BIP39**: Standard for mnemonic phrases (12 or 24 words from a 2048-word list)
- **Entropy**: 128 bits = 12 words, 256 bits = 24 words
- **Checksum**: Last word includes checksum to detect typos

```typescript
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

export type MnemonicStrength = 128 | 256;

export function generateMnemonic(strength: MnemonicStrength = 128): string {
  return bip39.generateMnemonic(wordlist, strength);
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic, wordlist);
}

export function mnemonicToSeed(mnemonic: string, passphrase?: string): Uint8Array {
  return bip39.mnemonicToSeedSync(mnemonic, passphrase);
}
```

**Flow**:
```
Random Entropy (128/256 bits)
    ↓
BIP39 Algorithm + Checksum
    ↓
Mnemonic Phrase (12/24 words)
    ↓
PBKDF2 (2048 iterations)
    ↓
512-bit Seed
```

---

### 2. Password-Based Encryption (`encryption.ts`)

**Purpose**: Encrypt mnemonics for secure storage using user's password.

**Key Concepts**:
- **Argon2id**: Memory-hard KDF resistant to GPU/ASIC attacks
- **AES-256-GCM**: Authenticated encryption (confidentiality + integrity)
- **Salt**: Random 32 bytes, prevents rainbow tables
- **Nonce**: Random 12 bytes, ensures unique ciphertext

```typescript
import { argon2id } from "@noble/hashes/argon2.js";

const SALT_LENGTH = 32;
const NONCE_LENGTH = 12;
const KEY_LENGTH = 32;

export function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  return argon2id(password, salt, {
    t: 3,        // iterations
    m: 65536,    // 64MB memory
    p: 1,        // parallel lanes
    dkLen: KEY_LENGTH,
  });
}

export async function encrypt(plaintext: string, password: string): Promise<EncryptedData> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const key = deriveKey(password, salt);

  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  );

  return { ciphertext: new Uint8Array(ciphertextBuffer), salt, nonce };
}

export async function decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
  const key = deriveKey(password, encryptedData.salt);
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: encryptedData.nonce },
    cryptoKey,
    encryptedData.ciphertext
  );
  return new TextDecoder().decode(plaintextBuffer);
}
```

**Encryption Flow**:
```
Password + Random Salt
    ↓
Argon2id (64MB memory, 3 iterations)
    ↓
256-bit Encryption Key
    ↓
AES-256-GCM + Random Nonce
    ↓
Ciphertext + Auth Tag
```

---

### 3. HD Wallet Derivation (`hdwallet.ts`)

**Purpose**: Derive blockchain addresses from seed using BIP32/BIP44 standards.

**Key Concepts**:
- **BIP32**: Hierarchical Deterministic wallets (key tree derivation)
- **BIP44**: Multi-account hierarchy with path structure
- **Derivation Path**: `m / purpose' / coin_type' / account' / change / address_index`
- **Hardened Derivation**: Uses `'` suffix, more secure (no public key leakage)

**Supported Chains**:

| Chain | Coin Type | Path | Curve | Address Format |
|-------|-----------|------|-------|----------------|
| Bitcoin | 0 | m/44'/0'/account'/0/0 | secp256k1 | P2PKH (starts with '1') |
| Ethereum | 60 | m/44'/60'/account'/0/0 | secp256k1 | Keccak256 hash (0x...) |
| Solana | 501 | m/44'/501'/account'/0' | Ed25519 | Base58 public key |

```typescript
import { HDKey, privateKeyToAddress } from "viem/accounts";
import { bytesToHex } from "viem";
import { Keypair } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import bs58check from "bs58check";

const COIN_TYPE = { BITCOIN: 0, ETHEREUM: 60, SOLANA: 501 } as const;

export function deriveBitcoinAddress(seed: Uint8Array, accountIndex = 0) {
  const hdKey = HDKey.fromMasterSeed(seed);
  const path = `m/44'/${COIN_TYPE.BITCOIN}'/${accountIndex}'/0/0`;
  const derived = hdKey.derive(path);

  // P2PKH: Hash160 = RIPEMD160(SHA256(publicKey))
  const sha256Hash = sha256(derived.publicKey!);
  const hash160 = ripemd160(sha256Hash);
  const versionedHash = new Uint8Array([0x00, ...hash160]);
  const address = bs58check.encode(versionedHash);

  return { address, privateKey: derived.privateKey!, path };
}

export function deriveEthereumAddress(seed: Uint8Array, accountIndex = 0) {
  const hdKey = HDKey.fromMasterSeed(seed);
  const path = `m/44'/${COIN_TYPE.ETHEREUM}'/${accountIndex}'/0/0`;
  const derived = hdKey.derive(path);

  const privateKeyHex = bytesToHex(derived.privateKey!);
  const address = privateKeyToAddress(privateKeyHex);

  return { address, privateKey: derived.privateKey!, path };
}

export function deriveSolanaAddress(seed: Uint8Array, accountIndex = 0) {
  const hdKey = HDKey.fromMasterSeed(seed);
  const path = `m/44'/${COIN_TYPE.SOLANA}'/${accountIndex}'/0'`;  // Hardened at end
  const derived = hdKey.derive(path);

  // Solana uses Ed25519
  const keypair = Keypair.fromSeed(derived.privateKey!.slice(0, 32));

  return {
    address: keypair.publicKey.toBase58(),
    privateKey: keypair.secretKey,  // 64 bytes
    path
  };
}
```

**Key Differences by Chain**:

| Aspect | Bitcoin | Ethereum | Solana |
|--------|---------|----------|--------|
| Address = Public Key? | No (Hash160) | No (Keccak256 hash) | Yes |
| Private Key Size | 32 bytes | 32 bytes | 64 bytes (seed+pubkey) |
| Final Derivation | Non-hardened | Non-hardened | Hardened |
| Encoding | Base58Check | Hex with checksum | Base58 |

---

### 4. Secure Memory Management (`secureMemory.ts`)

**Purpose**: Best-effort cleanup of sensitive data in JavaScript.

**Limitation**: JavaScript's garbage collection doesn't guarantee memory wiping, but these utilities minimize exposure window.

```typescript
export function zeroBuffer(buffer: Uint8Array): void {
  buffer.fill(0);
}

export function zeroBuffers(...buffers: Uint8Array[]): void {
  for (const buffer of buffers) {
    buffer.fill(0);
  }
}

export async function withSecureCleanup<T>(
  buffer: Uint8Array,
  fn: (buffer: Uint8Array) => T | Promise<T>
): Promise<T> {
  try {
    return await fn(buffer);
  } finally {
    zeroBuffer(buffer);  // Always cleanup, even on error
  }
}
```

**Usage Example**:
```typescript
const signature = await withSecureCleanup(privateKey, async (key) => {
  return signTransaction(transaction, key);
});
// privateKey is now zeroed out
```

---

## Files Created/Modified

### New Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/crypto/mnemonic.ts` | 70 | BIP39 mnemonic functions |
| `src/lib/crypto/encryption.ts` | 129 | AES-256-GCM + Argon2 encryption |
| `src/lib/crypto/hdwallet.ts` | 143 | HD wallet derivation for 3 chains |
| `src/lib/crypto/secureMemory.ts` | 43 | Memory cleanup utilities |
| `src/lib/crypto/__tests__/mnemonic.test.ts` | 109 | 15 tests |
| `src/lib/crypto/__tests__/encryption.test.ts` | 162 | 17 tests |
| `src/lib/crypto/__tests__/hdwallet.test.ts` | 193 | 19 tests |
| `src/lib/crypto/__tests__/secureMemory.test.ts` | 185 | 16 tests |
| `vitest.config.ts` | 16 | Test configuration |

### Modified Files

| File | Change |
|------|--------|
| `package.json` | Added test scripts, vitest dependencies |

---

## Dependencies Added

### Production Dependencies
```json
{
  "@noble/hashes": "^2.0.1",      // SHA256, RIPEMD160, Argon2
  "@noble/secp256k1": "^3.0.0",   // Elliptic curve operations
  "@noble/ed25519": "^3.0.0",     // Ed25519 for Solana
  "@scure/bip39": "^2.0.1",       // BIP39 mnemonic
  "@solana/web3.js": "^1.98.4",   // Solana keypair
  "bs58check": "^4.0.0",          // Bitcoin address encoding
  "viem": "^2.40.3"               // Ethereum HD wallet & address
}
```

### Dev Dependencies
```json
{
  "vitest": "^4.0.17",            // Test runner
  "@vitest/ui": "^4.0.17",        // Test UI
  "happy-dom": "^20.3.4"          // DOM environment for tests
}
```

---

## Import Paths (Important!)

The `@noble/hashes` and `@scure/bip39` packages use explicit `.js` extensions in their exports:

```typescript
// Correct imports
import { sha256 } from "@noble/hashes/sha2.js";        // NOT /sha256
import { ripemd160 } from "@noble/hashes/legacy.js";   // NOT /ripemd160
import { argon2id } from "@noble/hashes/argon2.js";
import { wordlist } from "@scure/bip39/wordlists/english.js";

// viem imports
import { HDKey, privateKeyToAddress } from "viem/accounts";  // NOT from "viem"
import { bytesToHex } from "viem";
```

---

## Testing

### Run Tests

```bash
cd frontend

# Run all tests once
npm run test:run

# Watch mode (re-runs on changes)
npm run test
```

### Test Results

```
 ✓ src/lib/crypto/__tests__/secureMemory.test.ts (16 tests)
 ✓ src/lib/crypto/__tests__/mnemonic.test.ts (15 tests)
 ✓ src/lib/crypto/__tests__/hdwallet.test.ts (19 tests)
 ✓ src/lib/crypto/__tests__/encryption.test.ts (17 tests)

 Test Files  4 passed (4)
 Tests       67 passed (67)
```

### Manual Verification

```typescript
// In browser console or test file
import { generateMnemonic, validateMnemonic, mnemonicToSeed } from './mnemonic';
import { deriveEthereumAddress, deriveBitcoinAddress, deriveSolanaAddress } from './hdwallet';

// Generate mnemonic
const mnemonic = generateMnemonic();
console.log('Mnemonic:', mnemonic);
console.log('Valid:', validateMnemonic(mnemonic));

// Derive addresses
const seed = mnemonicToSeed(mnemonic);
const eth = deriveEthereumAddress(seed);
const btc = deriveBitcoinAddress(seed);
const sol = deriveSolanaAddress(seed);

console.log('ETH:', eth.address, eth.path);
console.log('BTC:', btc.address, btc.path);
console.log('SOL:', sol.address, sol.path);
```

---

## Security Considerations

### What We Implemented

1. **Argon2id** - Memory-hard KDF (64MB, 3 iterations) prevents GPU/ASIC brute-force
2. **AES-256-GCM** - Authenticated encryption with integrity verification
3. **Random Salt/Nonce** - Unique encryption per operation
4. **Memory Cleanup** - Best-effort zeroing of sensitive buffers

### What's NOT Secure in Browser JS

1. **No guaranteed memory clearing** - GC may leave copies
2. **No secure enclave** - Keys in regular memory
3. **Extension/malware risk** - Browser environment not isolated

### Production Recommendations

1. Use Web Workers for crypto operations (isolation)
2. Implement auto-lock timeout
3. Clear decrypted keys from memory ASAP
4. Consider hardware wallet integration for real funds

---

## Next Steps

### Immediate (Task 2)
- [ ] Build secure local storage management
- [ ] Implement wallet unlock/lock session management
- [ ] Create encrypted mnemonic storage in localStorage

### Future
- [ ] Transaction signing (ETH, SOL)
- [ ] UI components for wallet creation/import
- [ ] Integration with backend metadata API

---

## References

- [BIP39 Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP32 HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP44 Multi-Account](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [SLIP-0044 Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [Argon2 RFC](https://www.rfc-editor.org/rfc/rfc9106.html)
- [@noble/hashes Documentation](https://github.com/paulmillr/noble-hashes)
- [Viem Documentation](https://viem.sh/)
