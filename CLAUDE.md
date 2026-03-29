# CLAUDE.md — Crypto Wallet

## Project Overview

Non-custodial multi-chain cryptocurrency wallet supporting Bitcoin, Ethereum, and Solana. The frontend (Next.js 16, React 19, TypeScript) handles all cryptographic operations — mnemonic generation, key derivation, transaction signing — while the backend (Go/Chi) stores only public metadata (wallet names, addresses, timestamps). Private keys and mnemonics never leave the client.

For task breakdowns and roadmap, see the Development Roadmap section in `documentations/Crypto-Wallet-Design-Doc.md`.
For architecture details, see `documentations/Crypto-Wallet-Design-Doc.md`.

## Quick Start

### Frontend

```bash
cd frontend
npm install
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test:run     # Run all tests once (Vitest)
npm test             # Watch mode
```

### Backend

```bash
cd backend
go build ./cmd/server        # Build
go run ./cmd/server          # Start server at http://localhost:8080
go test ./...                # Run all tests
```

### Environment Variables

| Variable              | Where    | Default                     | Description          |
| --------------------- | -------- | --------------------------- | -------------------- |
| `DATABASE_URL`        | Backend  | `sqlite://./data/wallet.db` | SQLite database path |
| `PORT`                | Backend  | `8080`                      | Server port          |
| `NEXT_PUBLIC_API_URL` | Frontend | `http://localhost:8080`     | Backend API URL      |

## Architecture

### Non-Custodial Security Boundary

```
Frontend (client-side)              │  Backend (server-side)
────────────────────────────────────│──────────────────────────
Generate mnemonic (BIP39)           │
Derive keys (BIP32/BIP44)          │
Encrypt mnemonic (AES-256-GCM)     │
Store encrypted in IndexedDB       │
                                    │
Register address (public only) ───>│  Store wallet name + addresses
Sign transactions locally          │
Send signed tx ──────────────────> │  Broadcast to network
```

**Critical rule**: Sensitive data (mnemonics, private keys, seeds, passwords) must NEVER cross this boundary.

### Multi-Chain Support

| Chain    | Curve     | Derivation Path    | Address Format              |
| -------- | --------- | ------------------ | --------------------------- |
| Bitcoin  | secp256k1 | `m/44'/0'/0'/0/0`  | P2PKH (Base58Check)         |
| Ethereum | secp256k1 | `m/44'/60'/0'/0/0` | Keccak256 (0x-prefixed hex) |
| Solana   | Ed25519   | `m/44'/501'/0'/0'` | Base58 (public key)         |

### Standards: BIP39 (mnemonics), BIP32 (HD wallets), BIP44 (multi-account derivation)

### Encryption: AES-256-GCM with Argon2id key derivation (64MB memory, 3 iterations)

## Project Structure

```
frontend/src/
├── app/                    # Next.js App Router (layout.tsx, page.tsx)
├── components/             # React components (wallet/, security/, transactions/, tokens/)
└── lib/
    ├── crypto/             # Mnemonic, HD wallet, encryption, secure memory cleanup
    ├── storage/            # IndexedDB persistence, session manager, wallet service orchestrator
    ├── api/                # HTTP client with ApiResult<T> pattern, wallet API functions
    ├── stores/             # Zustand state (walletStore.ts, toastBridge.ts)
    ├── utils/              # Toast notifications with security sanitization
    └── types/              # Domain types (wallet.ts)

backend/
├── cmd/server/main.go      # Entry point
└── internal/
    ├── api/                # Chi router, handlers, middleware, request/response types
    └── database/           # SQLite via modernc.org/sqlite — connection, models, CRUD

documentations/             # Architecture design doc, implementation logs, testing guides
```

## Coding Conventions

### General

- **Naming**: camelCase (variables/functions), PascalCase (types/components), UPPER_SNAKE_CASE (constants)
- **Commit messages**: Conventional prefixes — `feat:`, `fix:`, `chore:`, `refactor:` with task references (e.g., `P1-FE-T4`)
- **API types**: snake_case fields (matching Go JSON tags)

### Frontend (TypeScript)

- Use `@/*` path aliases for imports (e.g., `import { useWallet } from '@/lib/stores/walletStore'`)
- Use `ApiResult<T>` discriminated union for API responses — never throw from API calls
- Zustand with `subscribeWithSelector` middleware; use selector hooks to prevent unnecessary re-renders
- Use `showSuccess`/`showError`/`showWarning`/`showInfo` from `@/lib/utils/toast` for user feedback — messages are auto-sanitized to prevent sensitive data leaks
- Tests go in `__tests__/` directories collocated with source (e.g., `lib/crypto/__tests__/mnemonic.test.ts`)
- Test framework: Vitest with `describe`/`it`/`expect`, happy-dom environment, fake-indexeddb for storage tests

### Backend (Go)

- Error handling: return `(T, error)` tuples; map to JSON `{"error": "..."}` responses with appropriate HTTP status codes in handlers
- Logging: `slog` structured logger — `slog.Info()`, `slog.Error()` etc.
- Handler signature pattern: `func(w http.ResponseWriter, r *http.Request)` with Chi router context for URL params
- Database: `database/sql` with `modernc.org/sqlite` driver, manual query building

## Security Rules

These are non-negotiable for a wallet codebase:

1. **NEVER** log, print, or expose private keys, mnemonics, seeds, or passwords — not in errors, not in debug output, not in tests with real values
2. **NEVER** send sensitive cryptographic material to the backend — the non-custodial boundary is sacred
3. **Always** use `withSecureCleanup()` (from `lib/crypto/secureMemory.ts`) when working with sensitive buffers — ensures zeroing even on error
4. **Always** use authenticated encryption (AES-256-GCM) — never unauthenticated modes
5. **Always** use cryptographically secure RNG for key generation and nonces
6. **Validate** all inputs at system boundaries (API handlers, user input)
7. **Never** store sensitive data in localStorage — use IndexedDB with encryption
8. Security headers are enforced in `frontend/src/app/layout.tsx` (XSS protection, frame denial, cache control)
9. Auto-lock clears in-memory sensitive data after 5 minutes of inactivity (via `sessionManager.ts`)

## Testing

### Frontend (~278 tests)

- **Crypto** (~67 tests): mnemonic generation/validation, encryption round-trips, HD wallet derivation for all 3 chains, secure memory cleanup
- **Storage** (~82 tests): IndexedDB CRUD, session manager timers, wallet service lifecycle, backend integration
- **API** (~53 tests): HTTP client error handling, wallet API function correctness
- **Dashboard** (~8 tests): account population on unlock, lock/unlock state, wallet loading, wallet deletion
- **Balance** (~18 tests): balance service API/mock fallback, balance formatting, AccountCard balance display
- **Toast/Utils** (~24 tests): toast sanitization (hex keys, mnemonics, base58), toast bridge store subscriptions

### Backend (~44 tests)

- **Handler tests** (~21 tests): endpoint validation, CRUD operations, error responses
- **Middleware tests** (~13 tests): security headers, CORS, custom header enforcement, JSON error format
- **Database tests** (~10 tests): CRUD operations, foreign key cascades

### Running Tests

```bash
# Frontend — all tests
cd frontend && npm run test:run

# Frontend — specific file
cd frontend && npx vitest run src/lib/crypto/__tests__/mnemonic.test.ts

# Backend — all tests
cd backend && go test ./...

# Backend — verbose
cd backend && go test ./... -v
```

## Key Files Reference

| Purpose                     | File                                         |
| --------------------------- | -------------------------------------------- |
| Wallet state management     | `frontend/src/lib/stores/walletStore.ts`     |
| Wallet service orchestrator | `frontend/src/lib/storage/walletService.ts`  |
| HD wallet derivation        | `frontend/src/lib/crypto/hdwallet.ts`        |
| Client-side encryption      | `frontend/src/lib/crypto/encryption.ts`      |
| Secure memory cleanup       | `frontend/src/lib/crypto/secureMemory.ts`    |
| API client wrapper          | `frontend/src/lib/api/client.ts`             |
| API type definitions        | `frontend/src/lib/api/types.ts`              |
| IndexedDB storage           | `frontend/src/lib/storage/indexedDB.ts`      |
| Wallet dashboard            | `frontend/src/components/wallet/WalletDashboard.tsx` |
| Navigation bar              | `frontend/src/components/wallet/NavBar.tsx`  |
| Toast notifications (sanitized) | `frontend/src/lib/utils/toast.ts`        |
| Toast-store bridge          | `frontend/src/lib/stores/toastBridge.ts`     |
| Backend routes & middleware | `backend/internal/api/server.go`          |
| Backend handlers            | `backend/internal/api/handlers.go`        |
| Backend middleware          | `backend/internal/api/middleware.go`       |
| Database operations         | `backend/internal/database/wallet.go`     |
| Architecture design doc     | `documentations/Crypto-Wallet-Design-Doc.md` |
