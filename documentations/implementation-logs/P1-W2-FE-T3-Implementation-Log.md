# P1-W2-FE-T3: API Client for Metadata-Only Backend Communication

**Phase**: 1 - Foundation
**Week**: 2 - Basic Wallet Operations
**Task**: Frontend Task 3 - Implement API client for metadata-only backend communication
**Date**: February 2026
**Status**: Completed ✅

---

## Overview

Implemented a typed HTTP client that bridges the frontend and the Rust/Axum backend. The client enforces the non-custodial security boundary — only wallet metadata (names, public addresses, timestamps) ever crosses the network. Mnemonics, passwords, and private keys never appear in API types and are never sent.

### Components Built

| Component | File | Purpose |
|-----------|------|---------|
| API Types | `types.ts` | Request/response contracts matching backend structs |
| HTTP Client | `client.ts` | fetch() wrapper with error normalization |
| Wallet API | `wallets.ts` | Named functions for each backend endpoint |
| Public Index | `index.ts` | Single import point for the module |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application / UI (Future)                     │
│           import { walletApi } from "@/lib/api"                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     wallets.ts                                   │
│  Named functions mapping 1:1 to backend routes                   │
│  createWallet() importWallet() listWallets() updateWallet()     │
│  deleteWallet() registerAddress() getBalance() getTransactions() │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     client.ts                                    │
│  get() post() put() del()                                        │
│        └──────────────────────────────────────────┐             │
│                     request<T>()                   │             │
│  - Builds full URL (base + endpoint)               │             │
│  - Sets Content-Type header                        │             │
│  - Parses JSON response                            │             │
│  - Maps HTTP errors → ApiResult failure            │             │
│  - Catches network failures → ApiResult failure    │             │
└─────────────────────────────┬──────────────────────────────────-┘
                              │ Uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     fetch() API (Browser)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. API Types (`types.ts`)

**Purpose**: TypeScript interfaces that mirror backend Rust structs. Fields use `snake_case` to match serde's default serialization.

**Security principle**: sensitive fields are absent from types entirely — impossible to accidentally include them.

```typescript
// What we SEND — only the wallet name, nothing sensitive
export interface CreateWalletRequest {
  name: string;
  // No mnemonic. No password. No private key. By design.
}

// What we RECEIVE — public metadata only
export interface WalletResponse {
  wallet_id: string;
  name: string;
  created_at: string; // ISO 8601 timestamp
  message: string;
}
```

**Generic error wrapper using a discriminated union**:
```typescript
export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
```

The discriminated union on `success` means TypeScript narrows the type automatically:
```typescript
const result = await walletApi.createWallet({ name: "Test" });
if (result.success) {
  result.data.wallet_id; // ✅ TypeScript knows data exists
} else {
  result.error;          // ✅ TypeScript knows error exists
}
```

**Type guard for chain validation**:
```typescript
export type SupportedChain = "bitcoin" | "ethereum" | "solana";

export function isSupportedChain(chain: string): chain is SupportedChain {
  return ["bitcoin", "ethereum", "solana"].includes(chain.toLowerCase());
}
```

---

### 2. HTTP Client (`client.ts`)

**Purpose**: Central fetch() wrapper. All API calls go through here — one place for error handling, headers, and URL construction.

```typescript
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
```

`NEXT_PUBLIC_` prefix is required by Next.js to expose environment variables to the browser bundle. Without it, the variable is stripped at build time and only available server-side.

**Core request function**:
```typescript
export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });

    const body = await parseResponseBody(response); // Always read body first

    if (!response.ok) {
      return {
        success: false,
        error: extractErrorMessage(body, response.statusText),
        code: String(response.status),
      };
    }

    return { success: true, data: body as T };
  } catch (error) {
    // fetch() threw — network failure, CORS, DNS error
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
```

**Key design decisions**:

1. **Body is always read before checking `response.ok`** — error responses frequently contain a JSON body explaining why the request failed. Reading it after the check would mean losing that context.

2. **`fetch()` only throws on network failure, not HTTP errors** — a 404 or 500 will NOT throw. The `!response.ok` check is required separately.

3. **Never throw, always return `ApiResult`** — callers never need try/catch. The type forces them to handle both outcomes.

**Error message extraction** — backends return errors in different shapes:
```typescript
function extractErrorMessage(body: unknown, statusText: string): string {
  if (body !== null && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.error === "string") return b.error;   // Our backend's shape
    if (typeof b.message === "string") return b.message;
    if (typeof b.detail === "string") return b.detail; // Django-style
  }
  return statusText || "An unexpected error occurred";
}
```

**Method helpers** — thin wrappers that set the HTTP verb and serialize the body:
```typescript
export function get<T>(endpoint: string): Promise<ApiResult<T>> {
  return request<T>(endpoint, { method: "GET" });
}

export function post<T>(endpoint: string, data: unknown): Promise<ApiResult<T>> {
  return request<T>(endpoint, { method: "POST", body: JSON.stringify(data) });
}
```

---

### 3. Wallet API (`wallets.ts`)

**Purpose**: Named, typed functions mapping 1:1 to backend routes. The value is naming, typing, and centralization — not logic.

**Route map** (from `backend/src/api/server.rs`):

```typescript
// GET    /wallets                   → listWallets()
// POST   /wallet/create             → createWallet()
// POST   /wallet/import             → importWallet()
// PUT    /wallet/{id}               → updateWallet(walletId, ...)
// DELETE /wallet/{id}               → deleteWallet(walletId)
// POST   /wallet/{id}/addresses     → registerAddress(walletId, ...)
// GET    /wallet/{id}/balance       → getBalance(walletId)
// GET    /wallet/{id}/transactions  → getTransactions(walletId)
```

Each function is intentionally thin — its value is the name and types, not logic:
```typescript
export function createWallet(
  request: CreateWalletRequest
): Promise<ApiResult<WalletResponse>> {
  return post<WalletResponse>("/wallet/create", request);
}
```

---

### 4. Public Index (`index.ts`)

**Purpose**: Single import point. Consumers never import from `client.ts` or `wallets.ts` directly.

```typescript
export * from "./types";
export * as walletApi from "./wallets";  // Namespace groups all API calls
export { API_BASE_URL } from "./client";
```

The `walletApi` namespace makes call sites self-documenting:
```typescript
// Ambiguous — is this local or remote?
createWallet({ name: "Test" });

// Obviously a network call
walletApi.createWallet({ name: "Test" });
```

---

## Backend Contract Reference

Confirmed against `backend/src/api/server.rs` and `backend/src/api/wallet.rs`:

| Route | Method | Backend Handler |
|-------|--------|-----------------|
| `/wallets` | GET | `get_wallets` |
| `/wallet/create` | POST | `create_wallet` |
| `/wallet/import` | POST | `import_wallet` |
| `/wallet/{id}` | PUT | `update_wallet` |
| `/wallet/{id}` | DELETE | `delete_wallet` |
| `/wallet/{id}/addresses` | POST | `register_address` |
| `/wallet/{id}/balance` | GET | `get_wallet_balance` |
| `/wallet/{id}/transactions` | GET | `get_transaction_history` |

Backend runs on port **8080** in development (configured in `server.rs` line 30).

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/api/types.ts` | 143 | Request/response type contracts |
| `src/lib/api/client.ts` | 118 | HTTP client with fetch wrapper |
| `src/lib/api/wallets.ts` | 115 | Named wallet API functions |
| `src/lib/api/index.ts` | 9 | Public module exports |
| `src/lib/api/__tests__/client.test.ts` | 207 | 24 client tests |
| `src/lib/api/__tests__/wallets.test.ts` | 243 | 29 wallet API tests |

---

## Testing

### Run Tests

```bash
cd frontend
npm test -- --run src/lib/api/__tests__/
```

### Test Results

```
✓ src/lib/api/__tests__/client.test.ts  (24 tests)
✓ src/lib/api/__tests__/wallets.test.ts (29 tests)

Test Files  2 passed (2)
Tests       53 passed (53)
```

### Test Strategy

**`client.test.ts`** — Tests HTTP mechanics by mocking global `fetch()`:
- Success path: 200 → `{ success: true, data }`
- HTTP errors: 400/404/500 → `{ success: false, error, code }`
- Error extraction: `error` / `message` / `detail` fields, fallback to `statusText`
- Network failures: thrown `Error`, thrown non-Error, CORS failures
- Method helpers: correct verb set, body serialized for POST/PUT, no body for GET/DELETE

**`wallets.test.ts`** — Tests API contract (URL correctness, not HTTP mechanics):
- Every function calls the correct URL
- Wallet ID interpolated correctly into path segments
- Request bodies match backend struct field names
- Response data matches expected shape
- Error propagation from client to caller

---

## Key Patterns Learned

### `ApiResult<T>` — Never throw from API calls
```typescript
// ❌ Requires try/catch everywhere, easy to forget
const wallet = await createWallet({ name: "Test" }); // might throw

// ✅ Caller must handle both outcomes — TypeScript enforces it
const result = await walletApi.createWallet({ name: "Test" });
if (result.success) { ... }
else { ... }
```

### `fetch()` does not throw on HTTP errors
```typescript
const response = await fetch("/endpoint");
// response.status might be 404 or 500 — fetch did NOT throw
// Must check response.ok explicitly
if (!response.ok) { /* handle error */ }
```

### `NEXT_PUBLIC_` prefix for browser env vars
```typescript
// ✅ Available in browser (included in bundle)
process.env.NEXT_PUBLIC_API_URL

// ❌ Stripped from browser bundle (server-side only)
process.env.API_URL
```

---

## Next Steps

- Task 4: Wallet creation/import UI — will use `walletApi.createWallet()` and `walletApi.registerAddress()`
- Task 5: Wallet dashboard — will use `walletApi.listWallets()` and `walletApi.getBalance()`

---

## References

- [fetch() API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/fetch)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- Backend routes: `backend/src/api/server.rs`
- Backend types: `backend/src/api/wallet.rs`, `backend/src/api/types.rs`
- Previous task: P1-W2-FE-T2-Implementation-Log.md
