/**
 * Security integration tests for API communication
 *
 * Verifies:
 * 1. Custom X-Requested-With header is always sent
 * 2. Non-custodial boundary: no sensitive fields in request bodies
 * 3. HTML error responses are handled gracefully
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { request, get, post, put, del } from "../client";
import {
  createWallet,
  importWallet,
  registerAddress,
} from "../wallets";

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function capturedHeaders(): Headers {
  const call = vi.mocked(fetch).mock.calls[0];
  return new Headers((call[1] as RequestInit)?.headers);
}

function capturedBody(): string {
  const call = vi.mocked(fetch).mock.calls[0];
  return (call[1] as RequestInit)?.body as string;
}

// ============================================================================
// X-Requested-With header
// ============================================================================

describe("X-Requested-With header", () => {
  it("is sent on GET requests", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true }));
    await get("/test");
    expect(capturedHeaders().get("X-Requested-With")).toBe("CryptoWallet");
  });

  it("is sent on POST requests", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true }));
    await post("/test", { data: "test" });
    expect(capturedHeaders().get("X-Requested-With")).toBe("CryptoWallet");
  });

  it("is sent on PUT requests", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true }));
    await put("/test", { data: "test" });
    expect(capturedHeaders().get("X-Requested-With")).toBe("CryptoWallet");
  });

  it("is sent on DELETE requests", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true }));
    await del("/test");
    expect(capturedHeaders().get("X-Requested-With")).toBe("CryptoWallet");
  });

  it("is sent via raw request function", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true }));
    await request("/test", { method: "PATCH" });
    expect(capturedHeaders().get("X-Requested-With")).toBe("CryptoWallet");
  });
});

// ============================================================================
// Non-custodial boundary regression guard
// ============================================================================

const SENSITIVE_FIELDS = ["mnemonic", "private_key", "seed", "password", "secret"];

describe("Non-custodial boundary", () => {
  it("createWallet does not send sensitive fields", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ wallet_id: "1", name: "Test", created_at: "", message: "" }));
    await createWallet("Test Wallet");

    const body = capturedBody();
    for (const field of SENSITIVE_FIELDS) {
      expect(body).not.toContain(`"${field}"`);
    }
  });

  it("importWallet does not send sensitive fields", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ wallet_id: "1", name: "Test", created_at: "", message: "" }));
    await importWallet("Test Wallet");

    const body = capturedBody();
    for (const field of SENSITIVE_FIELDS) {
      expect(body).not.toContain(`"${field}"`);
    }
  });

  it("registerAddress does not send sensitive fields", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({
      id: 1, wallet_id: "1", address: "0xabc", chain: "ethereum",
      derivation_path: "m/44'/60'/0'/0/0", created_at: "", message: "",
    }));
    await registerAddress("wallet-1", {
      address: "0x742d35Cc6634C0532925a3b8D4C9b8B8b8b8b8b",
      chain: "ethereum",
      derivation_path: "m/44'/60'/0'/0/0",
    });

    const body = capturedBody();
    for (const field of SENSITIVE_FIELDS) {
      expect(body).not.toContain(`"${field}"`);
    }
  });
});

// ============================================================================
// Error response handling
// ============================================================================

describe("Error response sanitization", () => {
  it("handles HTML error pages gracefully", async () => {
    const htmlError = "<html><body><h1>500 Internal Server Error</h1></body></html>";
    vi.mocked(fetch).mockResolvedValue(
      new Response(htmlError, { status: 500, statusText: "Internal Server Error" })
    );

    const result = await get("/test");

    expect(result.success).toBe(false);
    if (!result.success) {
      // Should not expose raw HTML to caller
      expect(result.error).not.toContain("<html>");
      expect(result.error).toBeTruthy();
    }
  });

  it("handles empty error body gracefully", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 500, statusText: "Internal Server Error" })
    );

    const result = await get("/test");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it("extracts error message from JSON error response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 404,
        statusText: "Not Found",
      })
    );

    const result = await get("/test");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Wallet not found");
    }
  });
});
