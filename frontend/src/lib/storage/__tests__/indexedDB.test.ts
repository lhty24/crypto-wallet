/**
 * Tests for IndexedDB Storage Layer
 *
 * Uses fake-indexeddb to simulate IndexedDB in Node.js test environment.
 * These tests verify CRUD operations for encrypted wallet storage.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  saveWallet,
  getWallet,
  getAllWallets,
  deleteWallet,
  StoredWallet,
} from "../indexedDB";

// Helper to create a mock wallet for testing
function createMockWallet(overrides: Partial<StoredWallet> = {}): StoredWallet {
  return {
    id: `wallet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "Test Wallet",
    encryptedMnemonic: {
      ciphertext: new Uint8Array([1, 2, 3, 4, 5]),
      salt: new Uint8Array([6, 7, 8, 9, 10]),
      nonce: new Uint8Array([11, 12, 13, 14, 15]),
    },
    createdAt: Date.now(),
    addresses: {
      ethereum: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      solana: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
      bitcoin: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    },
    ...overrides,
  };
}

// Clear IndexedDB before each test to ensure isolation
beforeEach(async () => {
  // Delete the database to start fresh
  const deleteRequest = indexedDB.deleteDatabase("crypto-wallet");
  await new Promise<void>((resolve, reject) => {
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => reject(deleteRequest.error);
  });
});

describe("indexedDB Storage", () => {
  describe("saveWallet", () => {
    it("saves a new wallet successfully", async () => {
      const wallet = createMockWallet({ id: "test-wallet-1" });

      await saveWallet(wallet);

      // Verify it was saved by retrieving it
      const retrieved = await getWallet("test-wallet-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("test-wallet-1");
      expect(retrieved?.name).toBe("Test Wallet");
    });

    it("updates an existing wallet with the same id", async () => {
      const wallet = createMockWallet({ id: "update-test", name: "Original" });
      await saveWallet(wallet);

      // Update the wallet
      const updatedWallet = { ...wallet, name: "Updated Name" };
      await saveWallet(updatedWallet);

      // Verify it was updated, not duplicated
      const retrieved = await getWallet("update-test");
      expect(retrieved?.name).toBe("Updated Name");

      const allWallets = await getAllWallets();
      const matchingWallets = allWallets.filter((w) => w.id === "update-test");
      expect(matchingWallets).toHaveLength(1);
    });

    it("preserves Uint8Array data correctly", async () => {
      const wallet = createMockWallet({
        id: "uint8-test",
        encryptedMnemonic: {
          ciphertext: new Uint8Array([100, 200, 255, 0, 50]),
          salt: new Uint8Array([10, 20, 30]),
          nonce: new Uint8Array([1, 2, 3, 4]),
        },
      });

      await saveWallet(wallet);
      const retrieved = await getWallet("uint8-test");

      // Check that Uint8Array data is preserved
      expect(retrieved?.encryptedMnemonic.ciphertext).toEqual(
        new Uint8Array([100, 200, 255, 0, 50])
      );
      expect(retrieved?.encryptedMnemonic.salt).toEqual(
        new Uint8Array([10, 20, 30])
      );
      expect(retrieved?.encryptedMnemonic.nonce).toEqual(
        new Uint8Array([1, 2, 3, 4])
      );
    });
  });

  describe("getWallet", () => {
    it("returns undefined for non-existent wallet", async () => {
      const result = await getWallet("non-existent-id");
      expect(result).toBeUndefined();
    });

    it("retrieves the correct wallet by id", async () => {
      // Save multiple wallets
      await saveWallet(createMockWallet({ id: "wallet-a", name: "Wallet A" }));
      await saveWallet(createMockWallet({ id: "wallet-b", name: "Wallet B" }));
      await saveWallet(createMockWallet({ id: "wallet-c", name: "Wallet C" }));

      // Retrieve specific wallet
      const walletB = await getWallet("wallet-b");
      expect(walletB?.id).toBe("wallet-b");
      expect(walletB?.name).toBe("Wallet B");
    });

    it("retrieves all fields correctly", async () => {
      const wallet = createMockWallet({
        id: "full-test",
        name: "Full Test Wallet",
        createdAt: 1234567890,
        addresses: {
          ethereum: "0xabc",
          solana: "sol123",
          // bitcoin intentionally omitted
        },
      });

      await saveWallet(wallet);
      const retrieved = await getWallet("full-test");

      expect(retrieved?.id).toBe("full-test");
      expect(retrieved?.name).toBe("Full Test Wallet");
      expect(retrieved?.createdAt).toBe(1234567890);
      expect(retrieved?.addresses.ethereum).toBe("0xabc");
      expect(retrieved?.addresses.solana).toBe("sol123");
      expect(retrieved?.addresses.bitcoin).toBeUndefined();
    });
  });

  describe("getAllWallets", () => {
    it("returns empty array when no wallets exist", async () => {
      const wallets = await getAllWallets();
      expect(wallets).toEqual([]);
    });

    it("returns all saved wallets", async () => {
      await saveWallet(createMockWallet({ id: "w1", name: "Wallet 1" }));
      await saveWallet(createMockWallet({ id: "w2", name: "Wallet 2" }));
      await saveWallet(createMockWallet({ id: "w3", name: "Wallet 3" }));

      const wallets = await getAllWallets();
      expect(wallets).toHaveLength(3);

      const ids = wallets.map((w) => w.id);
      expect(ids).toContain("w1");
      expect(ids).toContain("w2");
      expect(ids).toContain("w3");
    });

    it("returns wallets with all their data intact", async () => {
      const originalWallet = createMockWallet({
        id: "data-integrity-test",
        name: "Data Integrity Wallet",
      });
      await saveWallet(originalWallet);

      const wallets = await getAllWallets();
      const retrieved = wallets.find((w) => w.id === "data-integrity-test");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("Data Integrity Wallet");
      expect(retrieved?.encryptedMnemonic).toBeDefined();
      expect(retrieved?.addresses).toBeDefined();
    });
  });

  describe("deleteWallet", () => {
    it("deletes an existing wallet", async () => {
      await saveWallet(createMockWallet({ id: "delete-me" }));

      // Verify it exists
      let wallet = await getWallet("delete-me");
      expect(wallet).toBeDefined();

      // Delete it
      await deleteWallet("delete-me");

      // Verify it's gone
      wallet = await getWallet("delete-me");
      expect(wallet).toBeUndefined();
    });

    it("does not throw when deleting non-existent wallet", async () => {
      // Should not throw
      await expect(deleteWallet("non-existent")).resolves.not.toThrow();
    });

    it("only deletes the specified wallet", async () => {
      await saveWallet(createMockWallet({ id: "keep-1" }));
      await saveWallet(createMockWallet({ id: "delete-2" }));
      await saveWallet(createMockWallet({ id: "keep-3" }));

      await deleteWallet("delete-2");

      const wallets = await getAllWallets();
      expect(wallets).toHaveLength(2);

      const ids = wallets.map((w) => w.id);
      expect(ids).toContain("keep-1");
      expect(ids).toContain("keep-3");
      expect(ids).not.toContain("delete-2");
    });
  });

  describe("integration scenarios", () => {
    it("handles full CRUD lifecycle", async () => {
      // Create
      const wallet = createMockWallet({
        id: "lifecycle-test",
        name: "Lifecycle Wallet",
      });
      await saveWallet(wallet);

      // Read
      let retrieved = await getWallet("lifecycle-test");
      expect(retrieved?.name).toBe("Lifecycle Wallet");

      // Update
      await saveWallet({ ...wallet, name: "Updated Lifecycle Wallet" });
      retrieved = await getWallet("lifecycle-test");
      expect(retrieved?.name).toBe("Updated Lifecycle Wallet");

      // Delete
      await deleteWallet("lifecycle-test");
      retrieved = await getWallet("lifecycle-test");
      expect(retrieved).toBeUndefined();
    });

    it("handles multiple wallets independently", async () => {
      // Create multiple wallets
      const wallets = [
        createMockWallet({ id: "multi-1", name: "Wallet 1" }),
        createMockWallet({ id: "multi-2", name: "Wallet 2" }),
        createMockWallet({ id: "multi-3", name: "Wallet 3" }),
      ];

      for (const w of wallets) {
        await saveWallet(w);
      }

      // Update one
      await saveWallet(
        createMockWallet({ id: "multi-2", name: "Wallet 2 Updated" })
      );

      // Delete one
      await deleteWallet("multi-3");

      // Verify final state
      const remaining = await getAllWallets();
      expect(remaining).toHaveLength(2);

      const wallet1 = await getWallet("multi-1");
      const wallet2 = await getWallet("multi-2");
      const wallet3 = await getWallet("multi-3");

      expect(wallet1?.name).toBe("Wallet 1");
      expect(wallet2?.name).toBe("Wallet 2 Updated");
      expect(wallet3).toBeUndefined();
    });

    it("maintains data integrity with realistic wallet data", async () => {
      // Create a wallet that looks like real encrypted data
      const realisticWallet: StoredWallet = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "My Main Wallet",
        encryptedMnemonic: {
          // Simulating realistic encrypted data sizes
          ciphertext: new Uint8Array(128).fill(0).map((_, i) => i % 256),
          salt: new Uint8Array(32).fill(0).map((_, i) => (i * 7) % 256),
          nonce: new Uint8Array(12).fill(0).map((_, i) => (i * 13) % 256),
        },
        createdAt: 1706140800000, // Jan 25, 2024
        addresses: {
          ethereum: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          solana: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
          bitcoin: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
        },
      };

      await saveWallet(realisticWallet);
      const retrieved = await getWallet(realisticWallet.id);

      expect(retrieved).toEqual(realisticWallet);
    });
  });
});
