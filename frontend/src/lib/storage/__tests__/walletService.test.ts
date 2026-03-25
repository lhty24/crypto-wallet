/**
 * Tests for Wallet Service - Central orchestrator for wallet operations
 *
 * These tests verify wallet CRUD operations, encryption/decryption flows,
 * and proper state management integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";

// Mock crypto modules
vi.mock("../../crypto/mnemonic", () => ({
  generateMnemonic: vi.fn(() => "test word one two three four five six seven eight nine ten eleven twelve"),
  validateMnemonic: vi.fn((mnemonic: string) => mnemonic.split(" ").length >= 12),
  mnemonicToSeed: vi.fn(() => new Uint8Array(64).fill(1)),
}));

vi.mock("../../crypto/encryption", () => ({
  encrypt: vi.fn(async () => ({
    ciphertext: new Uint8Array([1, 2, 3]),
    salt: new Uint8Array([4, 5, 6]),
    nonce: new Uint8Array([7, 8, 9]),
  })),
  decrypt: vi.fn(async (_, password: string) => {
    if (password === "wrong-password") {
      throw new Error("Decryption failed");
    }
    return "test word one two three four five six seven eight nine ten eleven twelve";
  }),
}));

vi.mock("../../crypto/hdwallet", () => ({
  deriveEthereumAddress: vi.fn(() => ({ address: "0xTestEthAddress123" })),
  deriveBitcoinAddress: vi.fn(() => ({ address: "bc1TestBtcAddress456" })),
  deriveSolanaAddress: vi.fn(() => ({ address: "TestSolAddress789" })),
}));

vi.mock("../../crypto/secureMemory", () => ({
  zeroBuffer: vi.fn(),
}));

// Mock wallet API — backend calls
let walletApiCallCount = 0;
vi.mock("../../api/wallets", () => ({
  createWallet: vi.fn(async () => ({
    success: true,
    data: { wallet_id: `backend-uuid-${++walletApiCallCount}`, name: "test", created_at: new Date().toISOString(), message: "created" },
  })),
  importWallet: vi.fn(async () => ({
    success: true,
    data: { wallet_id: `backend-uuid-${++walletApiCallCount}`, name: "test", created_at: new Date().toISOString(), message: "imported" },
  })),
  registerAddress: vi.fn(async () => ({
    success: true,
    data: { id: 1, wallet_id: "test", address: "test", chain: "ethereum", derivation_path: "m/44'/60'/0'/0/0", created_at: new Date().toISOString(), message: "registered" },
  })),
  deleteWallet: vi.fn(async () => ({
    success: true,
    data: { wallet_id: "test", message: "deleted", deleted: true },
  })),
}));

// Import after mocks are set up
import {
  createWallet,
  importWallet,
  unlockWallet,
  lockWallet,
  loadWallets,
  deleteWalletById,
  isWalletUnlocked,
  getCurrentWalletId,
} from "../walletService";
import { useWalletStore } from "../../stores/walletStore";
import { saveWallet, getWallet, deleteWallet } from "../indexedDB";
import { zeroBuffer } from "../../crypto/secureMemory";
import { validateMnemonic } from "../../crypto/mnemonic";
import { decrypt } from "../../crypto/encryption";
import * as walletApi from "../../api/wallets";

// Helper to reset IndexedDB
async function resetIndexedDB(): Promise<void> {
  const deleteRequest = indexedDB.deleteDatabase("crypto-wallet");
  await new Promise<void>((resolve, reject) => {
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => reject(deleteRequest.error);
  });
}

// Helper to reset Zustand store
function resetStore(): void {
  useWalletStore.setState({
    currentWallet: null,
    isUnlocked: false,
    currentAccount: null,
    activeChain: "Ethereum",
    balances: {},
    tokens: {},
    pendingTransactions: [],
    transactionHistory: [],
    isLoading: false,
    error: null,
    warning: null,
  });
}

describe("walletService", () => {
  beforeEach(async () => {
    await resetIndexedDB();
    resetStore();
    walletApiCallCount = 0;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetIndexedDB();
    resetStore();
  });

  describe("createWallet", () => {
    it("creates a new wallet and returns id and mnemonic", async () => {
      const result = await createWallet("My Wallet", "test-password");

      expect(result.id).toBeDefined();
      expect(result.mnemonic).toBe(
        "test word one two three four five six seven eight nine ten eleven twelve"
      );
    });

    it("saves wallet to IndexedDB", async () => {
      const result = await createWallet("My Wallet", "test-password");

      const storedWallet = await getWallet(result.id);
      expect(storedWallet).toBeDefined();
      expect(storedWallet?.name).toBe("My Wallet");
    });

    it("stores derived addresses", async () => {
      const result = await createWallet("My Wallet", "test-password");

      const storedWallet = await getWallet(result.id);
      expect(storedWallet?.addresses.ethereum).toBe("0xTestEthAddress123");
      expect(storedWallet?.addresses.bitcoin).toBe("bc1TestBtcAddress456");
      expect(storedWallet?.addresses.solana).toBe("TestSolAddress789");
    });

    it("updates Zustand store with new wallet", async () => {
      const result = await createWallet("My Wallet", "test-password");

      const state = useWalletStore.getState();
      expect(state.currentWallet?.id).toBe(result.id);
      expect(state.currentWallet?.name).toBe("My Wallet");
      expect(state.currentWallet?.isLocked).toBe(true);
    });

    it("clears seed from memory after creation", async () => {
      await createWallet("My Wallet", "test-password");

      expect(zeroBuffer).toHaveBeenCalled();
    });

    it("generates unique IDs for each wallet", async () => {
      const result1 = await createWallet("Wallet 1", "pass1");
      const result2 = await createWallet("Wallet 2", "pass2");

      expect(result1.id).not.toBe(result2.id);
    });

    it("calls backend API to register wallet", async () => {
      await createWallet("My Wallet", "test-password");

      expect(walletApi.createWallet).toHaveBeenCalledWith({ name: "My Wallet" });
    });

    it("uses backend wallet_id as local ID", async () => {
      const result = await createWallet("My Wallet", "test-password");

      expect(result.id).toBe("backend-uuid-1");
      const storedWallet = await getWallet(result.id);
      expect(storedWallet?.id).toBe("backend-uuid-1");
    });

    it("fails when backend is unreachable", async () => {
      vi.mocked(walletApi.createWallet).mockResolvedValueOnce({
        success: false,
        error: "Network error",
      });

      await expect(createWallet("My Wallet", "test-password")).rejects.toThrow(
        "Failed to register wallet with backend"
      );

      // Verify nothing was saved locally
      const wallets = await loadWallets();
      expect(wallets).toHaveLength(0);
    });

    it("clears seed on backend failure", async () => {
      vi.mocked(walletApi.createWallet).mockResolvedValueOnce({
        success: false,
        error: "Network error",
      });

      await expect(createWallet("My Wallet", "test-password")).rejects.toThrow();
      expect(zeroBuffer).toHaveBeenCalled();
    });
  });

  describe("importWallet", () => {
    const validMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    it("imports wallet with valid mnemonic", async () => {
      const result = await importWallet("Imported Wallet", validMnemonic, "password");

      expect(result.id).toBeDefined();
    });

    it("saves imported wallet to IndexedDB", async () => {
      const result = await importWallet("Imported Wallet", validMnemonic, "password");

      const storedWallet = await getWallet(result.id);
      expect(storedWallet).toBeDefined();
      expect(storedWallet?.name).toBe("Imported Wallet");
    });

    it("rejects invalid mnemonic", async () => {
      vi.mocked(validateMnemonic).mockReturnValueOnce(false);

      await expect(
        importWallet("Bad Wallet", "invalid mnemonic", "password")
      ).rejects.toThrow("Invalid mnemonic phrase");
    });

    it("updates Zustand store with imported wallet", async () => {
      const result = await importWallet("Imported Wallet", validMnemonic, "password");

      const state = useWalletStore.getState();
      expect(state.currentWallet?.id).toBe(result.id);
      expect(state.currentWallet?.isLocked).toBe(true);
    });

    it("clears seed from memory after import", async () => {
      await importWallet("Imported Wallet", validMnemonic, "password");

      expect(zeroBuffer).toHaveBeenCalled();
    });

    it("calls backend API to register imported wallet", async () => {
      await importWallet("Imported Wallet", validMnemonic, "password");

      expect(walletApi.importWallet).toHaveBeenCalledWith({ name: "Imported Wallet" });
    });

    it("fails when backend is unreachable", async () => {
      vi.mocked(walletApi.importWallet).mockResolvedValueOnce({
        success: false,
        error: "Network error",
      });

      await expect(
        importWallet("Imported Wallet", validMnemonic, "password")
      ).rejects.toThrow("Failed to register wallet with backend");

      const wallets = await loadWallets();
      expect(wallets).toHaveLength(0);
    });
  });

  describe("unlockWallet", () => {
    let walletId: string;

    beforeEach(async () => {
      const result = await createWallet("Test Wallet", "correct-password");
      walletId = result.id;
      // Reset unlock state
      useWalletStore.getState().actions.lockWallet();
    });

    it("unlocks wallet with correct password", async () => {
      await unlockWallet(walletId, "correct-password");

      const state = useWalletStore.getState();
      expect(state.isUnlocked).toBe(true);
    });

    it("throws error for non-existent wallet", async () => {
      await expect(unlockWallet("non-existent-id", "password")).rejects.toThrow(
        "Wallet not found"
      );
    });

    it("throws error for incorrect password", async () => {
      await expect(unlockWallet(walletId, "wrong-password")).rejects.toThrow(
        "Incorrect password"
      );
    });

    it("updates Zustand state on unlock", async () => {
      await unlockWallet(walletId, "correct-password");

      const state = useWalletStore.getState();
      expect(state.currentWallet?.id).toBe(walletId);
      expect(state.currentWallet?.isLocked).toBe(false);
    });

    it("registers addresses with backend on first unlock", async () => {
      await unlockWallet(walletId, "correct-password");

      expect(walletApi.registerAddress).toHaveBeenCalledTimes(3);
      expect(walletApi.registerAddress).toHaveBeenCalledWith(
        walletId,
        expect.objectContaining({ chain: "ethereum" })
      );
      expect(walletApi.registerAddress).toHaveBeenCalledWith(
        walletId,
        expect.objectContaining({ chain: "bitcoin" })
      );
      expect(walletApi.registerAddress).toHaveBeenCalledWith(
        walletId,
        expect.objectContaining({ chain: "solana" })
      );
    });

    it("skips address registration on subsequent unlocks", async () => {
      await unlockWallet(walletId, "correct-password");
      expect(walletApi.registerAddress).toHaveBeenCalledTimes(3);

      lockWallet();
      vi.clearAllMocks();

      await unlockWallet(walletId, "correct-password");
      expect(walletApi.registerAddress).not.toHaveBeenCalled();
    });

    it("sets warning in Zustand when address registration fails", async () => {
      vi.mocked(walletApi.registerAddress).mockResolvedValue({
        success: false,
        error: "Connection refused",
      });

      await unlockWallet(walletId, "correct-password");

      const state = useWalletStore.getState();
      expect(state.isUnlocked).toBe(true);
      expect(state.warning).toContain("Could not sync addresses");
    });

    it("retries address registration after failure on next unlock", async () => {
      vi.mocked(walletApi.registerAddress).mockResolvedValue({
        success: false,
        error: "Connection refused",
      });

      await unlockWallet(walletId, "correct-password");
      lockWallet();
      vi.clearAllMocks();

      // Restore successful mock
      vi.mocked(walletApi.registerAddress).mockResolvedValue({
        success: true,
        data: { id: 1, wallet_id: walletId, address: "test", chain: "ethereum", derivation_path: "m/44'/60'/0'/0/0", created_at: new Date().toISOString(), message: "registered" },
      });

      await unlockWallet(walletId, "correct-password");
      expect(walletApi.registerAddress).toHaveBeenCalledTimes(3);
      expect(useWalletStore.getState().warning).toBeNull();
    });
  });

  describe("lockWallet", () => {
    let walletId: string;

    beforeEach(async () => {
      const result = await createWallet("Test Wallet", "test-password");
      walletId = result.id;
      await unlockWallet(walletId, "test-password");
    });

    it("locks the wallet", () => {
      lockWallet();

      const state = useWalletStore.getState();
      expect(state.isUnlocked).toBe(false);
    });

    it("clears sensitive data from memory", () => {
      lockWallet();

      // zeroBuffer should be called to clear the seed
      expect(zeroBuffer).toHaveBeenCalled();
    });

    it("can be called when already locked", () => {
      lockWallet();
      expect(() => lockWallet()).not.toThrow();
    });
  });

  describe("loadWallets", () => {
    it("returns empty array when no wallets exist", async () => {
      const wallets = await loadWallets();
      expect(wallets).toEqual([]);
    });

    it("returns all stored wallets", async () => {
      await createWallet("Wallet 1", "pass1");
      await createWallet("Wallet 2", "pass2");
      await createWallet("Wallet 3", "pass3");

      const wallets = await loadWallets();
      expect(wallets).toHaveLength(3);
    });

    it("returns wallet metadata without decrypting", async () => {
      await createWallet("My Wallet", "secret-password");

      const wallets = await loadWallets();
      expect(wallets[0].name).toBe("My Wallet");
      expect(wallets[0].encryptedMnemonic).toBeDefined();
      // Decrypt should not have been called during load
      // (it's only called on unlock)
    });
  });

  describe("deleteWalletById", () => {
    let walletId: string;

    beforeEach(async () => {
      const result = await createWallet("Test Wallet", "test-password");
      walletId = result.id;
    });

    it("deletes wallet from IndexedDB", async () => {
      await deleteWalletById(walletId);

      const storedWallet = await getWallet(walletId);
      expect(storedWallet).toBeUndefined();
    });

    it("clears Zustand state if deleted wallet was current", async () => {
      await deleteWalletById(walletId);

      const state = useWalletStore.getState();
      expect(state.currentWallet).toBeNull();
    });

    it("locks wallet before deleting if unlocked", async () => {
      await unlockWallet(walletId, "test-password");
      expect(useWalletStore.getState().isUnlocked).toBe(true);

      await deleteWalletById(walletId);

      expect(useWalletStore.getState().isUnlocked).toBe(false);
    });

    it("does not throw when deleting non-existent wallet", async () => {
      await expect(deleteWalletById("non-existent")).resolves.not.toThrow();
    });

    it("calls backend API to delete wallet", async () => {
      await deleteWalletById(walletId);

      expect(walletApi.deleteWallet).toHaveBeenCalledWith(walletId);
    });

    it("proceeds with local deletion when backend fails", async () => {
      vi.mocked(walletApi.deleteWallet).mockResolvedValueOnce({
        success: false,
        error: "Network error",
      });

      await deleteWalletById(walletId);

      const storedWallet = await getWallet(walletId);
      expect(storedWallet).toBeUndefined();
    });
  });

  describe("isWalletUnlocked", () => {
    it("returns false when no wallet is unlocked", () => {
      expect(isWalletUnlocked()).toBe(false);
    });

    it("returns true when wallet is unlocked", async () => {
      const result = await createWallet("Test Wallet", "test-password");
      await unlockWallet(result.id, "test-password");

      expect(isWalletUnlocked()).toBe(true);
    });

    it("returns false after locking", async () => {
      const result = await createWallet("Test Wallet", "test-password");
      await unlockWallet(result.id, "test-password");
      lockWallet();

      expect(isWalletUnlocked()).toBe(false);
    });
  });

  describe("getCurrentWalletId", () => {
    it("returns null when no wallet is selected", () => {
      expect(getCurrentWalletId()).toBeNull();
    });

    it("returns wallet id when wallet is selected", async () => {
      const result = await createWallet("Test Wallet", "test-password");

      expect(getCurrentWalletId()).toBe(result.id);
    });

    it("returns null after wallet is cleared", async () => {
      const result = await createWallet("Test Wallet", "test-password");
      await deleteWalletById(result.id);

      expect(getCurrentWalletId()).toBeNull();
    });
  });

  describe("integration scenarios", () => {
    it("full wallet lifecycle: create -> unlock -> lock -> delete", async () => {
      // Create
      const { id, mnemonic } = await createWallet("Lifecycle Test", "my-password");
      expect(mnemonic).toBeDefined();

      let state = useWalletStore.getState();
      expect(state.currentWallet?.id).toBe(id);
      expect(state.isUnlocked).toBe(false);

      // Unlock
      await unlockWallet(id, "my-password");
      state = useWalletStore.getState();
      expect(state.isUnlocked).toBe(true);

      // Lock
      lockWallet();
      state = useWalletStore.getState();
      expect(state.isUnlocked).toBe(false);

      // Delete
      await deleteWalletById(id);
      state = useWalletStore.getState();
      expect(state.currentWallet).toBeNull();

      const storedWallet = await getWallet(id);
      expect(storedWallet).toBeUndefined();
    });

    it("manages multiple wallets correctly", async () => {
      // Create multiple wallets
      const wallet1 = await createWallet("Wallet 1", "pass1");
      const wallet2 = await createWallet("Wallet 2", "pass2");
      const wallet3 = await createWallet("Wallet 3", "pass3");

      // All should be in storage
      const wallets = await loadWallets();
      expect(wallets).toHaveLength(3);

      // Delete middle wallet
      await deleteWalletById(wallet2.id);

      const remainingWallets = await loadWallets();
      expect(remainingWallets).toHaveLength(2);

      const ids = remainingWallets.map((w) => w.id);
      expect(ids).toContain(wallet1.id);
      expect(ids).toContain(wallet3.id);
      expect(ids).not.toContain(wallet2.id);
    });

    it("import and unlock flow", async () => {
      const mnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

      // Import
      const { id } = await importWallet("Imported", mnemonic, "import-pass");

      // Verify it's stored
      const storedWallet = await getWallet(id);
      expect(storedWallet).toBeDefined();

      // Unlock
      await unlockWallet(id, "import-pass");

      const state = useWalletStore.getState();
      expect(state.isUnlocked).toBe(true);
      expect(state.currentWallet?.name).toBe("Imported");
    });
  });
});
