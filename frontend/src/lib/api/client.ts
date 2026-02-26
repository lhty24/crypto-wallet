/**
 * HTTP Client - Base layer for all backend communication
 *
 * This module wraps the native fetch() API with:
 * - Centralized base URL configuration
 * - Consistent JSON request/response handling
 * - Normalized error handling via ApiResult<T>
 * - Convenience helpers for each HTTP method
 */

import { ApiResult } from "./types";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Base URL for all API requests.
 *
 * NEXT_PUBLIC_ prefix is required for Next.js to expose env vars to the browser.
 * Without this prefix, the variable is only available server-side.
 *
 * Defaults to localhost:3001 where the Rust backend runs in development.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ============================================================================
// Core Request Function
// ============================================================================

/**
 * Central fetch wrapper that all API calls go through.
 *
 * Handles the full request lifecycle:
 * 1. Build the full URL from base + endpoint
 * 2. Attach default headers
 * 3. Send the request
 * 4. Check for HTTP errors (4xx, 5xx)
 * 5. Parse JSON response
 * 6. Return a typed ApiResult<T>
 *
 * @param endpoint - Path relative to base URL (e.g., "/wallet/create")
 * @param options  - Standard fetch RequestInit options (method, body, headers, etc.)
 * @returns        - ApiResult<T>: either { success: true, data: T } or { success: false, error: string }
 */
export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        // Spread caller's headers last so they can override defaults
        ...options.headers,
      },
    });

    // Parse body regardless of status - errors often have a JSON body explaining why
    const body = await parseResponseBody(response);

    // HTTP 2xx = success, anything else = failure
    if (!response.ok) {
      return {
        success: false,
        error: extractErrorMessage(body, response.statusText),
        code: String(response.status),
      };
    }

    return { success: true, data: body as T };
  } catch (error) {
    // fetch() itself threw - network failure, CORS, or DNS error
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ============================================================================
// HTTP Method Helpers
// ============================================================================

/**
 * GET request - for fetching data, no request body.
 *
 * @example
 * const result = await get<WalletResponse[]>("/wallets");
 */
export function get<T>(endpoint: string): Promise<ApiResult<T>> {
  return request<T>(endpoint, { method: "GET" });
}

/**
 * POST request - for creating resources, sends JSON body.
 *
 * @example
 * const result = await post<WalletResponse>("/wallet/create", { name: "My Wallet" });
 */
export function post<T>(endpoint: string, data: unknown): Promise<ApiResult<T>> {
  return request<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * PUT request - for updating resources, sends JSON body.
 *
 * @example
 * const result = await put<WalletResponse>("/wallet/abc123", { name: "New Name" });
 */
export function put<T>(endpoint: string, data: unknown): Promise<ApiResult<T>> {
  return request<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request - for removing resources, no request body.
 * Named 'del' because 'delete' is a reserved JavaScript keyword.
 *
 * @example
 * const result = await del<DeleteWalletResponse>("/wallet/abc123");
 */
export function del<T>(endpoint: string): Promise<ApiResult<T>> {
  return request<T>(endpoint, { method: "DELETE" });
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Safely parse a response body as JSON.
 *
 * Returns null if the body is empty or not valid JSON.
 * We don't throw here - a non-JSON error body should not crash the client.
 */
async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Backend returned non-JSON (e.g., plain text error, HTML error page)
    return text;
  }
}

/**
 * Extract a human-readable error message from an API error response.
 *
 * Backends return errors in different shapes - this handles the common ones:
 *   { "error": "..." }      ← Most of our backend errors
 *   { "message": "..." }    ← Some frameworks use this
 *   { "detail": "..." }     ← Django REST framework style
 *
 * Falls back to the HTTP status text (e.g., "Not Found", "Bad Request").
 */
function extractErrorMessage(body: unknown, statusText: string): string {
  if (body !== null && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.error === "string") return b.error;
    if (typeof b.message === "string") return b.message;
    if (typeof b.detail === "string") return b.detail;
  }
  return statusText || "An unexpected error occurred";
}
