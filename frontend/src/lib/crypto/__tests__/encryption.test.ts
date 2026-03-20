import { describe, it, expect } from "vitest";
import { deriveKey, encrypt, decrypt } from "../encryption";

describe("encryption", () => {
  describe("deriveKey", () => {
    it("derives a 32-byte key from password and salt", () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const key = deriveKey("testpassword", salt);

      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32); // 256 bits
    });

    it("derives same key for same password and salt", () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const key1 = deriveKey("testpassword", salt);
      const key2 = deriveKey("testpassword", salt);

      expect(key1).toEqual(key2);
    });

    it("derives different keys for different passwords", () => {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const key1 = deriveKey("password1", salt);
      const key2 = deriveKey("password2", salt);

      expect(key1).not.toEqual(key2);
    });

    it("derives different keys for different salts", () => {
      const salt1 = crypto.getRandomValues(new Uint8Array(32));
      const salt2 = crypto.getRandomValues(new Uint8Array(32));
      const key1 = deriveKey("testpassword", salt1);
      const key2 = deriveKey("testpassword", salt2);

      expect(key1).not.toEqual(key2);
    });
  });

  describe("encrypt", () => {
    it("encrypts plaintext and returns ciphertext, salt, and nonce", async () => {
      const plaintext = "secret message";
      const password = "testpassword";

      const encrypted = await encrypt(plaintext, password);

      expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
      expect(encrypted.salt).toBeInstanceOf(Uint8Array);
      expect(encrypted.nonce).toBeInstanceOf(Uint8Array);

      expect(encrypted.salt.length).toBe(32);
      expect(encrypted.nonce.length).toBe(12);
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);
    });

    it("produces different ciphertext for same plaintext (random nonce)", async () => {
      const plaintext = "secret message";
      const password = "testpassword";

      const encrypted1 = await encrypt(plaintext, password);
      const encrypted2 = await encrypt(plaintext, password);

      // Different nonce and salt means different ciphertext
      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
      expect(encrypted1.nonce).not.toEqual(encrypted2.nonce);
      expect(encrypted1.salt).not.toEqual(encrypted2.salt);
    });

    it("encrypts empty string", async () => {
      const encrypted = await encrypt("", "testpassword");
      expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
      // AES-GCM adds auth tag even for empty plaintext
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);
    });

    it("encrypts unicode characters", async () => {
      const encrypted = await encrypt("Hello 世界 🌍", "testpassword");
      expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
    });
  });

  describe("decrypt", () => {
    it("decrypts ciphertext back to original plaintext", async () => {
      const plaintext = "secret message";
      const password = "testpassword";

      const encrypted = await encrypt(plaintext, password);
      const decrypted = await decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it("decrypts empty string", async () => {
      const encrypted = await encrypt("", "testpassword");
      const decrypted = await decrypt(encrypted, "testpassword");
      expect(decrypted).toBe("");
    });

    it("decrypts unicode characters", async () => {
      const plaintext = "Hello 世界 🌍 émoji";
      const encrypted = await encrypt(plaintext, "testpassword");
      const decrypted = await decrypt(encrypted, "testpassword");
      expect(decrypted).toBe(plaintext);
    });

    it("decrypts long text", async () => {
      const plaintext =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const encrypted = await encrypt(plaintext, "testpassword");
      const decrypted = await decrypt(encrypted, "testpassword");
      expect(decrypted).toBe(plaintext);
    });

    it("fails with wrong password", async () => {
      const encrypted = await encrypt("secret message", "correctpassword");

      await expect(decrypt(encrypted, "wrongpassword")).rejects.toThrow();
    });

    it("fails with corrupted ciphertext", async () => {
      const encrypted = await encrypt("secret message", "testpassword");

      // Corrupt the ciphertext
      encrypted.ciphertext[0] ^= 0xff;

      await expect(decrypt(encrypted, "testpassword")).rejects.toThrow();
    });

    it("fails with corrupted nonce", async () => {
      const encrypted = await encrypt("secret message", "testpassword");

      // Corrupt the nonce
      encrypted.nonce[0] ^= 0xff;

      await expect(decrypt(encrypted, "testpassword")).rejects.toThrow();
    });
  });

  describe("encrypt/decrypt roundtrip", () => {
    it("handles multiple encrypt/decrypt cycles", async () => {
      const password = "testpassword";

      // Reduced iterations due to Argon2 being slow in test environment
      for (let i = 0; i < 2; i++) {
        const plaintext = `message ${i}`;
        const encrypted = await encrypt(plaintext, password);
        const decrypted = await decrypt(encrypted, password);
        expect(decrypted).toBe(plaintext);
      }
    });

    it("handles mnemonic-like data", async () => {
      const mnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const password = "strongpassword123!";

      const encrypted = await encrypt(mnemonic, password);
      const decrypted = await decrypt(encrypted, password);

      expect(decrypted).toBe(mnemonic);
    });
  });
});
