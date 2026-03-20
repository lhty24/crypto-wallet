/**
 * Tests for HTTP Client
 *
 * Strategy: mock the global fetch() so we control what the network returns.
 * We test the client's behavior (URL building, error handling, JSON parsing)
 * without making real network calls.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { request, get, post, put, del, API_BASE_URL } from "../client";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Build a mock Response object that fetch() would return.
 * This mimics the browser's Response API.
 */
function mockResponse(body: unknown, status = 200): Response {
  const json = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(json, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Build a mock Response with an empty body.
 */
function mockEmptyResponse(status = 204): Response {
  return new Response(null, { status });
}

/**
 * Build a mock Response with plain text (not JSON).
 */
function mockTextResponse(text: string, status = 500): Response {
  return new Response(text, { status });
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  // Replace global fetch with a vitest mock before each test
  vi.stubGlobal("fetch", vi.fn());
});

// ============================================================================
// API_BASE_URL
// ============================================================================

describe("API_BASE_URL", () => {
  it("defaults to localhost:8080", () => {
    expect(API_BASE_URL).toBe("http://localhost:8080");
  });
});

// ============================================================================
// request() - Core function
// ============================================================================

describe("request()", () => {
  describe("successful responses", () => {
    it("returns success: true with parsed JSON data on 200", async () => {
      const payload = { wallet_id: "abc-123", name: "Test" };
      vi.mocked(fetch).mockResolvedValue(mockResponse(payload, 200));

      const result = await request<typeof payload>("/wallet/create");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(payload);
      }
    });

    it("builds the full URL from base + endpoint", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}));

      await request("/some/endpoint");

      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/some/endpoint`,
        expect.any(Object)
      );
    });

    it("always sets Content-Type: application/json header", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}));

      await request("/endpoint");

      const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
      expect((callArgs.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/json"
      );
    });

    it("caller headers override default headers", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}));

      await request("/endpoint", {
        headers: { Authorization: "Bearer token123" },
      });

      const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer token123");
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("handles empty response body gracefully", async () => {
      vi.mocked(fetch).mockResolvedValue(mockEmptyResponse(204));

      const result = await request("/endpoint");

      expect(result.success).toBe(true);
    });
  });

  describe("HTTP error responses", () => {
    it("returns success: false on 404", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Wallet not found" }, 404)
      );

      const result = await request("/wallet/bad-id");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Wallet not found");
        expect(result.code).toBe("404");
      }
    });

    it("returns success: false on 500", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Internal server error" }, 500)
      );

      const result = await request("/endpoint");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("500");
      }
    });

    it("returns success: false on 400", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Wallet name cannot be empty" }, 400)
      );

      const result = await request("/wallet/create", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Wallet name cannot be empty");
      }
    });

    it("extracts error from 'message' field if no 'error' field", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ message: "Something went wrong" }, 422)
      );

      const result = await request("/endpoint");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Something went wrong");
      }
    });

    it("extracts error from 'detail' field as last resort", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ detail: "Validation failed" }, 422)
      );

      const result = await request("/endpoint");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
      }
    });

    it("falls back to statusText when body has no error field", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response("{}", { status: 503, statusText: "Service Unavailable" })
      );

      const result = await request("/endpoint");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Service Unavailable");
      }
    });

    it("handles non-JSON error bodies (e.g., plain text or HTML)", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockTextResponse("Internal Server Error", 500)
      );

      const result = await request("/endpoint");

      // Should not throw - should return failure with text as error context
      expect(result.success).toBe(false);
    });
  });

  describe("network failures", () => {
    it("returns success: false when fetch throws (no internet)", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Failed to fetch"));

      const result = await request("/endpoint");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Failed to fetch");
      }
    });

    it("returns success: false on CORS error", async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError("NetworkError"));

      const result = await request("/endpoint");

      expect(result.success).toBe(false);
    });

    it("handles non-Error thrown values", async () => {
      // Some environments throw strings instead of Error objects
      vi.mocked(fetch).mockRejectedValue("connection refused");

      const result = await request("/endpoint");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Network error");
      }
    });
  });
});

// ============================================================================
// HTTP method helpers
// ============================================================================

describe("get()", () => {
  it("uses GET method", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse([]));

    await get("/wallets");

    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.method).toBe("GET");
  });

  it("sends no body", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}));

    await get("/wallets");

    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.body).toBeUndefined();
  });
});

describe("post()", () => {
  it("uses POST method", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}));

    await post("/wallet/create", { name: "Test" });

    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.method).toBe("POST");
  });

  it("serializes the request body as JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}));

    await post("/wallet/create", { name: "My Wallet" });

    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.body).toBe(JSON.stringify({ name: "My Wallet" }));
  });
});

describe("put()", () => {
  it("uses PUT method", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}));

    await put("/wallet/abc-123", { name: "New Name" });

    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.method).toBe("PUT");
  });

  it("serializes the request body as JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}));

    await put("/wallet/abc-123", { name: "New Name" });

    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.body).toBe(JSON.stringify({ name: "New Name" }));
  });
});

describe("del()", () => {
  it("uses DELETE method", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}));

    await del("/wallet/abc-123");

    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.method).toBe("DELETE");
  });

  it("sends no body", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}));

    await del("/wallet/abc-123");

    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.body).toBeUndefined();
  });
});
