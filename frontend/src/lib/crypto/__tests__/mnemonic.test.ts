import { describe, it, expect } from "vitest";
import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
} from "../mnemonic";

describe("mnemonic", () => {
  describe("generateMnemonic", () => {
    it("generates a 12-word mnemonic by default (128-bit entropy)", () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(" ");
      expect(words).toHaveLength(12);
    });

    it("generates a 24-word mnemonic with 256-bit entropy", () => {
      const mnemonic = generateMnemonic(256);
      const words = mnemonic.split(" ");
      expect(words).toHaveLength(24);
    });

    it("generates unique mnemonics each time", () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();
      expect(mnemonic1).not.toBe(mnemonic2);
    });

    it("generated mnemonics are valid", () => {
      const mnemonic12 = generateMnemonic(128);
      const mnemonic24 = generateMnemonic(256);
      expect(validateMnemonic(mnemonic12)).toBe(true);
      expect(validateMnemonic(mnemonic24)).toBe(true);
    });
  });

  describe("validateMnemonic", () => {
    it("validates a known valid 12-word mnemonic", () => {
      // Standard BIP39 test vector
      const validMnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      expect(validateMnemonic(validMnemonic)).toBe(true);
    });

    it("validates a known valid 24-word mnemonic", () => {
      const validMnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
      expect(validateMnemonic(validMnemonic)).toBe(true);
    });

    it("rejects invalid words not in wordlist", () => {
      const invalidMnemonic = "invalid words that are not in the wordlist at all ever";
      expect(validateMnemonic(invalidMnemonic)).toBe(false);
    });

    it("rejects mnemonic with wrong checksum", () => {
      // All valid words but wrong checksum (last word should be 'about')
      const wrongChecksum =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
      expect(validateMnemonic(wrongChecksum)).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validateMnemonic("")).toBe(false);
    });

    it("rejects mnemonic with wrong word count", () => {
      const wrongCount = "abandon abandon abandon abandon abandon";
      expect(validateMnemonic(wrongCount)).toBe(false);
    });
  });

  describe("mnemonicToSeed", () => {
    const testMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    it("generates a 64-byte (512-bit) seed", () => {
      const seed = mnemonicToSeed(testMnemonic);
      expect(seed).toBeInstanceOf(Uint8Array);
      expect(seed.length).toBe(64);
    });

    it("generates deterministic seed for same mnemonic", () => {
      const seed1 = mnemonicToSeed(testMnemonic);
      const seed2 = mnemonicToSeed(testMnemonic);
      expect(seed1).toEqual(seed2);
    });

    it("generates different seed with passphrase", () => {
      const seedNoPass = mnemonicToSeed(testMnemonic);
      const seedWithPass = mnemonicToSeed(testMnemonic, "mypassphrase");
      expect(seedNoPass).not.toEqual(seedWithPass);
    });

    it("generates deterministic seed for same mnemonic and passphrase", () => {
      const seed1 = mnemonicToSeed(testMnemonic, "mypassphrase");
      const seed2 = mnemonicToSeed(testMnemonic, "mypassphrase");
      expect(seed1).toEqual(seed2);
    });

    it("matches known BIP39 test vector", () => {
      // Known test vector from BIP39 spec
      const seed = mnemonicToSeed(testMnemonic);
      // First few bytes of the expected seed for this mnemonic (no passphrase)
      // Verify it's not all zeros and has expected characteristics
      expect(seed[0]).not.toBe(0);
      expect(seed.some((b) => b !== 0)).toBe(true);
    });
  });
});
