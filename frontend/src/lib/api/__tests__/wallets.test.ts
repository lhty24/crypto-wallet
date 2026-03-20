/**
 * Tests for Wallet API functions
 *
 * Strategy: mock fetch() and verify that each function calls the correct
 * URL with the correct HTTP method and request body.
 *
 * We are NOT testing HTTP mechanics here (that's client.test.ts).
 * We ARE testing: URL correctness, method correctness, body correctness.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createWallet,
  importWallet,
  listWallets,
  updateWallet,
  deleteWallet,
  registerAddress,
  getBalance,
  getTransactions,
} from "../wallets";
import { API_BASE_URL } from "../client";

// ============================================================================
// Test Fixtures
// ============================================================================

const WALLET_ID = "550e8400-e29b-41d4-a716-446655440000";

const walletResponse = {
  wallet_id: WALLET_ID,
  name: "Test Wallet",
  created_at: "2026-01-01T00:00:00Z",
  message: "Success",
};

const deleteResponse = {
  wallet_id: WALLET_ID,
  message: "Wallet deleted successfully",
  deleted: true,
};

const addressResponse = {
  id: 1,
  wallet_id: WALLET_ID,
  address: "0x742d35Cc6634C0532925a3b8D4C9b8B8b8b8b8b",
  chain: "ethereum",
  derivation_path: "m/44'/60'/0'/0/0",
  created_at: "2026-01-01T00:00:00Z",
  message: "Address registered successfully",
};

// ============================================================================
// Helpers
// ============================================================================

function mockFetchSuccess(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
}

function mockFetchError(status: number, error: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error }), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
}

/** Extract which URL fetch was called with */
function calledUrl(): string {
  return vi.mocked(fetch).mock.calls[0][0] as string;
}

/** Extract fetch call options */
function calledOptions(): RequestInit {
  return vi.mocked(fetch).mock.calls[0][1] as RequestInit;
}

// ============================================================================
// createWallet
// ============================================================================

describe("createWallet()", () => {
  beforeEach(() => mockFetchSuccess(walletResponse));

  it("calls POST /wallet/create", async () => {
    await createWallet({ name: "My Wallet" });

    expect(calledUrl()).toBe(`${API_BASE_URL}/wallet/create`);
    expect(calledOptions().method).toBe("POST");
  });

  it("sends name in request body", async () => {
    await createWallet({ name: "My Wallet" });

    expect(calledOptions().body).toBe(JSON.stringify({ name: "My Wallet" }));
  });

  it("returns success with wallet data", async () => {
    const result = await createWallet({ name: "My Wallet" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wallet_id).toBe(WALLET_ID);
      expect(result.data.name).toBe("Test Wallet");
    }
  });

  it("returns failure on error", async () => {
    mockFetchError(400, "Wallet name cannot be empty");

    const result = await createWallet({ name: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Wallet name cannot be empty");
    }
  });
});

// ============================================================================
// importWallet
// ============================================================================

describe("importWallet()", () => {
  beforeEach(() => mockFetchSuccess(walletResponse));

  it("calls POST /wallet/import", async () => {
    await importWallet({ name: "Imported Wallet" });

    expect(calledUrl()).toBe(`${API_BASE_URL}/wallet/import`);
    expect(calledOptions().method).toBe("POST");
  });

  it("sends name in request body", async () => {
    await importWallet({ name: "Imported Wallet" });

    expect(calledOptions().body).toBe(
      JSON.stringify({ name: "Imported Wallet" })
    );
  });

  it("returns success with wallet data", async () => {
    const result = await importWallet({ name: "Imported Wallet" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wallet_id).toBeDefined();
    }
  });
});

// ============================================================================
// listWallets
// ============================================================================

describe("listWallets()", () => {
  it("calls GET /wallets", async () => {
    mockFetchSuccess([walletResponse]);

    await listWallets();

    expect(calledUrl()).toBe(`${API_BASE_URL}/wallets`);
    expect(calledOptions().method).toBe("GET");
  });

  it("returns array of wallets on success", async () => {
    mockFetchSuccess([walletResponse, { ...walletResponse, wallet_id: "other-id" }]);

    const result = await listWallets();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  it("returns empty array when no wallets", async () => {
    mockFetchSuccess([]);

    const result = await listWallets();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });
});

// ============================================================================
// updateWallet
// ============================================================================

describe("updateWallet()", () => {
  beforeEach(() => mockFetchSuccess(walletResponse));

  it("calls PUT /wallet/{id}", async () => {
    await updateWallet(WALLET_ID, { name: "New Name" });

    expect(calledUrl()).toBe(`${API_BASE_URL}/wallet/${WALLET_ID}`);
    expect(calledOptions().method).toBe("PUT");
  });

  it("interpolates wallet ID into URL correctly", async () => {
    const otherId = "different-wallet-uuid";
    await updateWallet(otherId, { name: "New Name" });

    expect(calledUrl()).toContain(otherId);
  });

  it("sends new name in request body", async () => {
    await updateWallet(WALLET_ID, { name: "New Name" });

    expect(calledOptions().body).toBe(JSON.stringify({ name: "New Name" }));
  });

  it("returns failure when wallet not found", async () => {
    mockFetchError(404, "Wallet not found");

    const result = await updateWallet("bad-id", { name: "New Name" });

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// deleteWallet
// ============================================================================

describe("deleteWallet()", () => {
  beforeEach(() => mockFetchSuccess(deleteResponse));

  it("calls DELETE /wallet/{id}", async () => {
    await deleteWallet(WALLET_ID);

    expect(calledUrl()).toBe(`${API_BASE_URL}/wallet/${WALLET_ID}`);
    expect(calledOptions().method).toBe("DELETE");
  });

  it("interpolates wallet ID into URL correctly", async () => {
    const otherId = "another-uuid";
    await deleteWallet(otherId);

    expect(calledUrl()).toContain(otherId);
  });

  it("returns deleted: true on success", async () => {
    const result = await deleteWallet(WALLET_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deleted).toBe(true);
      expect(result.data.wallet_id).toBe(WALLET_ID);
    }
  });

  it("returns failure when wallet not found", async () => {
    mockFetchError(404, "Wallet not found");

    const result = await deleteWallet("bad-id");

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// registerAddress
// ============================================================================

describe("registerAddress()", () => {
  beforeEach(() => mockFetchSuccess(addressResponse));

  it("calls POST /wallet/{id}/addresses", async () => {
    await registerAddress(WALLET_ID, {
      address: "0xABC",
      chain: "ethereum",
      derivation_path: "m/44'/60'/0'/0/0",
    });

    expect(calledUrl()).toBe(`${API_BASE_URL}/wallet/${WALLET_ID}/addresses`);
    expect(calledOptions().method).toBe("POST");
  });

  it("sends all address fields in request body", async () => {
    const addressRequest = {
      address: "0x742d35Cc6634C0532925a3b8D4C9b8B8b8b8b8b",
      chain: "ethereum",
      derivation_path: "m/44'/60'/0'/0/0",
    };

    await registerAddress(WALLET_ID, addressRequest);

    expect(calledOptions().body).toBe(JSON.stringify(addressRequest));
  });

  it("works for different chains", async () => {
    const btcRequest = {
      address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
      chain: "bitcoin",
      derivation_path: "m/44'/0'/0'/0/0",
    };

    await registerAddress(WALLET_ID, btcRequest);

    expect(calledOptions().body).toBe(JSON.stringify(btcRequest));
  });

  it("returns address data on success", async () => {
    const result = await registerAddress(WALLET_ID, {
      address: "0xABC",
      chain: "ethereum",
      derivation_path: "m/44'/60'/0'/0/0",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chain).toBe("ethereum");
      expect(result.data.wallet_id).toBe(WALLET_ID);
    }
  });
});

// ============================================================================
// getBalance
// ============================================================================

describe("getBalance()", () => {
  it("calls GET /wallet/{id}/balance", async () => {
    mockFetchSuccess({ wallet_id: WALLET_ID, balances: [] });

    await getBalance(WALLET_ID);

    expect(calledUrl()).toBe(`${API_BASE_URL}/wallet/${WALLET_ID}/balance`);
    expect(calledOptions().method).toBe("GET");
  });

  it("returns balance data on success", async () => {
    const balancePayload = {
      wallet_id: WALLET_ID,
      balances: [
        {
          address: "0xABC",
          chain: "ethereum",
          balance: "0.0",
          symbol: "ETH",
          timestamp: "2026-01-01T00:00:00Z",
        },
      ],
    };
    mockFetchSuccess(balancePayload);

    const result = await getBalance(WALLET_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.balances).toHaveLength(1);
      expect(result.data.balances[0].symbol).toBe("ETH");
    }
  });
});

// ============================================================================
// getTransactions
// ============================================================================

describe("getTransactions()", () => {
  it("calls GET /wallet/{id}/transactions", async () => {
    mockFetchSuccess({ wallet_id: WALLET_ID, transactions: [] });

    await getTransactions(WALLET_ID);

    expect(calledUrl()).toBe(`${API_BASE_URL}/wallet/${WALLET_ID}/transactions`);
    expect(calledOptions().method).toBe("GET");
  });

  it("returns empty transactions array initially", async () => {
    mockFetchSuccess({ wallet_id: WALLET_ID, transactions: [] });

    const result = await getTransactions(WALLET_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transactions).toEqual([]);
    }
  });
});

// ============================================================================
// types - isSupportedChain
// ============================================================================

describe("isSupportedChain()", () => {
  it("returns true for supported chains", async () => {
    const { isSupportedChain } = await import("../types");

    expect(isSupportedChain("ethereum")).toBe(true);
    expect(isSupportedChain("bitcoin")).toBe(true);
    expect(isSupportedChain("solana")).toBe(true);
  });

  it("is case-insensitive", async () => {
    const { isSupportedChain } = await import("../types");

    expect(isSupportedChain("Ethereum")).toBe(true);
    expect(isSupportedChain("BITCOIN")).toBe(true);
  });

  it("returns false for unsupported chains", async () => {
    const { isSupportedChain } = await import("../types");

    expect(isSupportedChain("polygon")).toBe(false);
    expect(isSupportedChain("arbitrum")).toBe(false);
    expect(isSupportedChain("")).toBe(false);
  });
});
