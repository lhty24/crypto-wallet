# CLAUDE.md — Crypto Wallet

## Project Overview

Non-custodial multi-chain cryptocurrency wallet supporting Bitcoin, Ethereum, and Solana. The frontend (Next.js 16, React 19, TypeScript) handles all cryptographic operations — mnemonic generation, key derivation, transaction signing — while the backend (currently Rust/Axum, migrating to Go in Phase 1.5) stores only public metadata (wallet names, addresses, timestamps). Private keys and mnemonics never leave the client.

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
cargo build                  # Debug build
cargo run                    # Start server at http://localhost:8080
cargo test                   # Run all tests
cargo build --release        # Optimized build (LTO, opt-level=3)
```

### Environment Variables

| Variable              | Where    | Default                     | Description          |
| --------------------- | -------- | --------------------------- | -------------------- |
| `DATABASE_URL`        | Backend  | `sqlite://./data/wallet.db` | SQLite database path |
| `PORT`                | Backend  | `8080`                      | Server port          |
| `RUST_LOG`            | Backend  | `info`                      | Log level            |
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
    ├── stores/             # Zustand state (walletStore.ts)
    └── types/              # Domain types (wallet.ts)

backend/src/
├── api/                    # Axum server setup, wallet handlers, request/response types
├── database/               # SQLite via sqlx — connection pool, models, CRUD operations
└── main.rs / lib.rs        # Entry point, module declarations

documentations/             # Architecture design doc, implementation logs, testing guides
```

## Coding Conventions

### General

- **Naming**: camelCase (variables/functions), PascalCase (types/components), UPPER_SNAKE_CASE (constants)
- **Commit messages**: Conventional prefixes — `feat:`, `fix:`, `chore:`, `refactor:` with task references (e.g., `P1-FE-T4`)
- **API types**: snake_case fields (matching Rust serde serialization)

### Frontend (TypeScript)

- Use `@/*` path aliases for imports (e.g., `import { useWallet } from '@/lib/stores/walletStore'`)
- Use `ApiResult<T>` discriminated union for API responses — never throw from API calls
- Zustand with `subscribeWithSelector` middleware; use selector hooks to prevent unnecessary re-renders
- Tests go in `__tests__/` directories collocated with source (e.g., `lib/crypto/__tests__/mnemonic.test.ts`)
- Test framework: Vitest with `describe`/`it`/`expect`, happy-dom environment, fake-indexeddb for storage tests

### Backend (Rust — migrating to Go in Phase 1.5)

> These conventions apply to the current Rust backend until the Go migration is complete.

- Error handling: `anyhow::Result<T>` with `.context()` for propagation; map to HTTP status codes in handlers
- Logging: `tracing` crate — `tracing::info!`, `tracing::error!` etc.
- Handler signature pattern: `async fn(State(pool): State<DbPool>, ...) -> Result<Json<T>, StatusCode>`
- SQLx compile-time checked queries with `#[derive(sqlx::FromRow)]`

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

### Frontend (~213 tests)

- **Crypto** (~67 tests): mnemonic generation/validation, encryption round-trips, HD wallet derivation for all 3 chains, secure memory cleanup
- **Storage** (~70 tests): IndexedDB CRUD, session manager timers, wallet service lifecycle
- **API** (~53 tests): HTTP client error handling, wallet API function correctness
- **Dashboard** (~8 tests): account population on unlock, lock/unlock state, wallet loading, wallet deletion

### Backend

- API tests: endpoint validation, error responses
- Database tests: CRUD operations, foreign key cascades

### Running Tests

```bash
# Frontend — all tests
cd frontend && npm run test:run

# Frontend — specific file
cd frontend && npx vitest run src/lib/crypto/__tests__/mnemonic.test.ts

# Backend — all tests
cd backend && cargo test

# Backend — specific test
cd backend && cargo test test_name -- --nocapture
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
| Backend routes & middleware | `backend/src/api/server.rs`                  |
| Backend wallet handlers     | `backend/src/api/wallet.rs`                  |
| Database operations         | `backend/src/database/wallet.rs`             |
| Architecture design doc     | `documentations/Crypto-Wallet-Design-Doc.md` |
