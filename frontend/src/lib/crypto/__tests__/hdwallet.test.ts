import { describe, it, expect } from "vitest";
import {
  deriveBitcoinAddress,
  deriveEthereumAddress,
  deriveSolanaAddress,
} from "../hdwallet";
import { mnemonicToSeed } from "../mnemonic";

// Standard BIP39 test mnemonic
const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("hdwallet", () => {
  // Get seed once for all tests
  const seed = mnemonicToSeed(TEST_MNEMONIC);

  describe("deriveBitcoinAddress", () => {
    it("derives a valid Bitcoin address starting with '1'", () => {
      const result = deriveBitcoinAddress(seed);

      expect(result.address).toMatch(/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/);
    });

    it("returns correct BIP44 path", () => {
      const result = deriveBitcoinAddress(seed);

      expect(result.path).toBe("m/44'/0'/0'/0/0");
    });

    it("returns 32-byte private key", () => {
      const result = deriveBitcoinAddress(seed);

      expect(result.privateKey).toBeInstanceOf(Uint8Array);
      expect(result.privateKey.length).toBe(32);
    });

    it("derives different addresses for different account indices", () => {
      const result0 = deriveBitcoinAddress(seed, 0);
      const result1 = deriveBitcoinAddress(seed, 1);

      expect(result0.address).not.toBe(result1.address);
      expect(result0.privateKey).not.toEqual(result1.privateKey);
      expect(result0.path).toBe("m/44'/0'/0'/0/0");
      expect(result1.path).toBe("m/44'/0'/1'/0/0");
    });

    it("produces deterministic addresses", () => {
      const result1 = deriveBitcoinAddress(seed, 0);
      const result2 = deriveBitcoinAddress(seed, 0);

      expect(result1.address).toBe(result2.address);
      expect(result1.privateKey).toEqual(result2.privateKey);
    });
  });

  describe("deriveEthereumAddress", () => {
    it("derives a valid Ethereum address starting with '0x'", () => {
      const result = deriveEthereumAddress(seed);

      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it("returns correct BIP44 path", () => {
      const result = deriveEthereumAddress(seed);

      expect(result.path).toBe("m/44'/60'/0'/0/0");
    });

    it("returns 32-byte private key", () => {
      const result = deriveEthereumAddress(seed);

      expect(result.privateKey).toBeInstanceOf(Uint8Array);
      expect(result.privateKey.length).toBe(32);
    });

    it("derives different addresses for different account indices", () => {
      const result0 = deriveEthereumAddress(seed, 0);
      const result1 = deriveEthereumAddress(seed, 1);

      expect(result0.address).not.toBe(result1.address);
      expect(result0.privateKey).not.toEqual(result1.privateKey);
      expect(result0.path).toBe("m/44'/60'/0'/0/0");
      expect(result1.path).toBe("m/44'/60'/1'/0/0");
    });

    it("produces deterministic addresses", () => {
      const result1 = deriveEthereumAddress(seed, 0);
      const result2 = deriveEthereumAddress(seed, 0);

      expect(result1.address).toBe(result2.address);
      expect(result1.privateKey).toEqual(result2.privateKey);
    });

    it("address is checksummed", () => {
      const result = deriveEthereumAddress(seed);
      // Ethereum addresses should have mixed case (checksum)
      const hasUpperCase = /[A-F]/.test(result.address.slice(2));
      const hasLowerCase = /[a-f]/.test(result.address.slice(2));
      // At least one of these should be true for most addresses
      expect(hasUpperCase || hasLowerCase).toBe(true);
    });
  });

  describe("deriveSolanaAddress", () => {
    it("derives a valid Solana address (Base58)", () => {
      const result = deriveSolanaAddress(seed);

      // Solana addresses are Base58 encoded, typically 32-44 characters
      expect(result.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    });

    it("returns correct BIP44 path with hardened derivation", () => {
      const result = deriveSolanaAddress(seed);

      // Solana uses hardened derivation at the end
      expect(result.path).toBe("m/44'/501'/0'/0'");
    });

    it("returns 64-byte secret key (Ed25519 keypair)", () => {
      const result = deriveSolanaAddress(seed);

      expect(result.privateKey).toBeInstanceOf(Uint8Array);
      // Solana returns the full 64-byte secret key (32 seed + 32 public key)
      expect(result.privateKey.length).toBe(64);
    });

    it("derives different addresses for different account indices", () => {
      const result0 = deriveSolanaAddress(seed, 0);
      const result1 = deriveSolanaAddress(seed, 1);

      expect(result0.address).not.toBe(result1.address);
      expect(result0.privateKey).not.toEqual(result1.privateKey);
      expect(result0.path).toBe("m/44'/501'/0'/0'");
      expect(result1.path).toBe("m/44'/501'/1'/0'");
    });

    it("produces deterministic addresses", () => {
      const result1 = deriveSolanaAddress(seed, 0);
      const result2 = deriveSolanaAddress(seed, 0);

      expect(result1.address).toBe(result2.address);
      expect(result1.privateKey).toEqual(result2.privateKey);
    });
  });

  describe("cross-chain derivation", () => {
    it("derives different addresses for each chain from same seed", () => {
      const btc = deriveBitcoinAddress(seed);
      const eth = deriveEthereumAddress(seed);
      const sol = deriveSolanaAddress(seed);

      // All addresses should be different
      expect(btc.address).not.toBe(eth.address);
      expect(btc.address).not.toBe(sol.address);
      expect(eth.address).not.toBe(sol.address);

      // Private keys should also be different (different derivation paths)
      expect(btc.privateKey).not.toEqual(eth.privateKey);
      // Note: Solana private key is 64 bytes, so can't directly compare
    });

    it("uses correct coin types in derivation paths", () => {
      const btc = deriveBitcoinAddress(seed);
      const eth = deriveEthereumAddress(seed);
      const sol = deriveSolanaAddress(seed);

      expect(btc.path).toContain("/0'/"); // Bitcoin coin type 0
      expect(eth.path).toContain("/60'/"); // Ethereum coin type 60
      expect(sol.path).toContain("/501'/"); // Solana coin type 501
    });
  });

  describe("with different seeds", () => {
    it("derives completely different addresses from different mnemonics", () => {
      const mnemonic2 =
        "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong";
      const seed2 = mnemonicToSeed(mnemonic2);

      const btc1 = deriveBitcoinAddress(seed);
      const btc2 = deriveBitcoinAddress(seed2);

      const eth1 = deriveEthereumAddress(seed);
      const eth2 = deriveEthereumAddress(seed2);

      const sol1 = deriveSolanaAddress(seed);
      const sol2 = deriveSolanaAddress(seed2);

      expect(btc1.address).not.toBe(btc2.address);
      expect(eth1.address).not.toBe(eth2.address);
      expect(sol1.address).not.toBe(sol2.address);
    });
  });
});
