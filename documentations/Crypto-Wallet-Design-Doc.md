# Multi-Chain Cryptocurrency Wallet - Design Document

## Table of Contents

1. [Project Scope](#project-scope)
2. [Technical Stack](#technical-stack)
3. [Detailed Architecture](#detailed-architecture)
4. [Component Breakdown](#component-breakdown)
5. [Development Roadmap](#development-roadmap)
6. [Security Considerations](#security-considerations)
7. [Testing Strategy](#testing-strategy)
8. [Key Technical Decisions](#key-technical-decisions)
9. [Future Enhancements](#future-enhancements)

---

## Project Scope

### Overview

Build a functional multi-chain cryptocurrency wallet from scratch. The wallet will be a web application supporting multiple blockchains with a focus on security best practices.

### Primary Goals

- **Functional**: Create a working wallet with comprehensive cryptocurrency operations including:
  - HD wallet creation and import (BIP39/BIP32/BIP44)
  - Multi-account management and derivation
  - Native token balance checking and monitoring (ETH, SOL)
  - Transaction creation, signing, and broadcasting
  - ERC-20 and SPL token support with custom token addition
  - Real-time transaction history and status tracking
  - Gas fee estimation and optimization
  - Multi-network support (mainnet, testnet, devnet)
  - Secure key storage and wallet backup/recovery
- **Secure**: Implement industry-standard security practices
- **Multi-chain**: Support Ethereum/EVM chains and Solana initially

### Target Users

- Cryptocurrency users requiring multi-chain wallet functionality
- Users seeking secure, self-custodial wallet solutions

### Platform Decision

**Web Application** - Chosen for fastest development iteration and broad platform compatibility, with ability to convert to Chrome extension later.

---

## Technical Stack

### Frontend: React/Next.js + TypeScript ✅

**Rationale**:

- Industry standard for crypto dApps
- Excellent TypeScript support
- Rich ecosystem and documentation
- Server-side rendering capabilities

**Key Libraries**:

- **Viem**: Modern Ethereum library (preferred over ethers.js)
- **@solana/web3.js**: Official Solana JavaScript library
- **Zustand**: Lightweight state management
- **@noble/crypto**: Audited cryptographic primitives

### Backend: Rust + Axum ✅ → Migrating to Go in Phase 1.5

**Role**: Metadata Cache and API Aggregator

The backend does NOT proxy real-time blockchain queries. Instead, it focuses on:

- **Metadata Storage**: Wallet names, address labels, user preferences
- **Historical Data Indexing**: Transaction history (on-demand, not proactive)
- **API Aggregation**: Token lists, price feeds from multiple sources
- **Caching**: Reduce frontend API calls for non-real-time data

**Rationale for Go migration**:

- Backend is a simple metadata store and API proxy — Rust's complexity is unnecessary
- Go offers faster iteration for REST API + database CRUD workloads
- Simpler error handling for straightforward business logic
- Single binary deployment (same as Rust)
- All cryptographic operations are frontend-only, so Rust's memory safety guarantees aren't needed here

**Current Crates** (Rust — until Phase 1.5 migration):

- **axum**: Modern web framework
- **sqlx**: Async SQLite database
- **tokio**: Async runtime
- **serde/serde_json**: JSON serialization
- **tower-http**: CORS, tracing, rate limiting
- **uuid**: Wallet ID generation

> **Note:** Crypto crates (bip39, bitcoin, secp256k1, ed25519-dalek, aes-gcm) removed in T6.
> All cryptographic operations are frontend-only per non-custodial architecture.

### Storage Strategy

- **Client-Side Storage**: IndexedDB for encrypted wallet data
  - Better binary data handling (Uint8Array natively)
  - Async API (non-blocking UI)
  - Larger storage limits than localStorage
  - Structured object stores for different data types
- **Production Considerations**:
  - Hardware Security Modules (HSM)
  - Hardware wallet integration for key management
  - Web Workers for isolated crypto operations

---

## Detailed Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                     │
│                         (Next.js + TypeScript)                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ UI Components          │ Crypto Engine (🔐)     │ Blockchain Connectors        │
│ ┌─────────────────────┐│ ┌───────────────────┐  │ ┌──────────────────────────┐ │
│ │ WalletDashboard     ││ │ BIP39 Generator   │  │ │ EVM Provider (Viem)      │ │
│ │ CreateWallet        ││ │ - Mnemonic Gen    │  │ │ - Ethereum               │ │
│ │ UnlockWallet        ││ │ - Entropy Source  │  │ │ - Polygon                │ │
│ │ SendTransaction     ││ │ AES Encryption    │  │ │ - Arbitrum               │ │
│ │ TransactionHistory  ││ │ - Argon2 KDF      │  │ │ - Optimism               │ │
│ │ SecuritySettings    ││ │ - Local Storage   │  │ └──────────────────────────┘ │
│ └─────────────────────┘│ │ HD Key Derivation │  │ ┌──────────────────────────┐ │
│ ┌─────────────────────┐│ │ - BIP32/BIP44     │  │ │ Solana Provider          │ │
│ │ State Management    ││ │ - Private Keys    │  │ │ (@solana/web3.js)        │ │
│ │ - UI State          ││ │ TX Signing        │  │ │ - Mainnet                │ │
│ │ - Session State     ││ │ - Ethereum        │  │ │ - Devnet                 │ │
│ │ - Settings          ││ │ - Solana (Ed25519)│  │ └──────────────────────────┘ │
│ └─────────────────────┘│ └───────────────────┘  │                              │
└─────────────────────────────────────────────────────────────────────────────────┘
│                               CLIENT STORAGE (IndexedDB)                      │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ IndexedDB Database: "crypto-wallet"                                         │ │
│ │ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────────┐ │ │
│ │ │ Encrypted Wallets│ │ User Preferences│ │ Session Data                    │ │ │
│ │ │ - AES-256 Blob   │ │ - UI Settings   │ │ - Unlocked Wallet IDs           │ │ │
│ │ │ - Salt & Nonce   │ │ - Network Prefs │ │ - Auto-lock Timers              │ │ │
│ │ │ - Wallet Metadata│ │ - Theme         │ │ - Temporary State               │ │ │
│ │ └─────────────────┘ └─────────────────┘ └─────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────────┐ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                           ┌──────────┴──────────┐
                           │    HTTP API         │
                           │  (REST + WebSocket) │
                           └──────────┬──────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               BACKEND LAYER                                     │
│                    (Rust + Axum - Metadata Cache & API Aggregator)             │
├─────────────────────────────────────────────────────────────────────────────────┤
│ API Layer              │ Data Services          │ External APIs               │
│ ┌─────────────────────┐│ ┌───────────────────┐  │ ┌──────────────────────────┐ │
│ │ Metadata Endpoints  ││ │ History Indexing  │  │ │ Price Feed APIs          │ │
│ │ - /wallets (CRUD)   ││ │ - TX History      │  │ │ - CoinGecko              │ │
│ │ - /wallet/addresses ││ │ - On-demand fetch │  │ │ - CoinMarketCap          │ │
│ │ - /history          ││ │ - Cache & store   │  │ └──────────────────────────┘ │
│ │ - /tokens           ││ │ Token Discovery   │  │ ┌──────────────────────────┐ │
│ │ - /prices           ││ │ - Token lists     │  │ │ Token List APIs          │ │
│ └─────────────────────┘│ │ - Metadata        │  │ │ - Uniswap token list     │ │
│ ┌─────────────────────┐│ └───────────────────┘  │ │ - Jupiter token list     │ │
│ │ Address Registry    ││ ┌───────────────────┐  │ └──────────────────────────┘ │
│ │ - Public addresses  ││ │ Caching Layer     │  │                              │
│ │ - Labels & notes    ││ │ - Price cache     │  │ ⚠️  NO PRIVATE KEYS         │
│ │ - Categories        ││ │ - Token cache     │  │ ⚠️  NO MNEMONICS            │
│ └─────────────────────┘│ │ - History cache   │  │ ⚠️  NO PASSWORDS            │
│                        │ └───────────────────┘  │ ⚠️  NO RPC PROXYING         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND STORAGE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ⚠️  NO SENSITIVE DATA   │ Metadata Storage      │ Blockchain Cache             │
│ ┌─────────────────────┐│ ┌───────────────────┐  │ ┌──────────────────────────┐ │
│ │ ❌ NO Private Keys   ││ │ SQLite Database   │  │ │ SQLite Cache             │ │
│ │ ❌ NO Mnemonics     ││ │ - Wallet Metadata │  │ │ - Token Prices           │ │
│ │ ❌ NO Passwords     ││ │ - Public Addresses│  │ │ - Transaction History    │ │
│ │                     ││ │ - Account Labels  │  │ │ - Balance Cache          │ │
│ │ ✅ Public Data Only ││ │ - Settings        │  │ │ - Network Status         │ │
│ └─────────────────────┘│ └───────────────────┘  │ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Non-Custodial Security**: Private keys never leave client device
2. **Frontend Crypto Responsibility**: All sensitive operations client-side
3. **Zero Backend Trust**: Backend never sees mnemonics, passwords, or keys
4. **Client-Side Encryption**: AES-256-GCM with user-derived passwords
5. **Modular Design**: Easy to add new blockchain support
6. **Separation of Concerns**: Clear boundaries between crypto and coordination layers
7. **Fail-Safe Defaults**: Secure configurations by default

### RPC Responsibility Pattern: "Write-Direct, Read-Indexed"

To avoid state drift and the "Double RPC Problem" (both frontend and backend querying blockchain for the same data), we use a clear separation of RPC responsibilities:

| Operation            | Responsibility     | Rationale                          |
| -------------------- | ------------------ | ---------------------------------- |
| **TX Broadcast**     | Frontend → RPC     | Must be real-time, user-initiated  |
| **Current Balance**  | Frontend → RPC     | Real-time accuracy required        |
| **Gas Estimation**   | Frontend → RPC     | Must reflect current network state |
| **Nonce Query**      | Frontend → RPC     | Must be current for TX signing     |
| **TX History**       | Frontend → Backend | Backend indexes and caches         |
| **Token Discovery**  | Frontend → Backend | Backend aggregates token lists     |
| **Address Metadata** | Frontend → Backend | Labels, notes, categories          |
| **Price Data**       | Frontend → Backend | Backend aggregates price feeds     |

**Key Insight**: The frontend handles all "write" operations and real-time queries directly with the blockchain RPC. The backend serves as a **Metadata Cache and API Aggregator** for historical data and enriched information.

**Benefits**:

- No state drift from duplicate blockchain queries
- Frontend has authoritative real-time data for transaction signing
- Backend can focus on indexing, caching, and aggregation
- Clear responsibility boundaries reduce bugs and complexity

---

## Component Breakdown

### Frontend Components (Next.js)

#### Planned Component Directories

```
src/components/
├── wallet/          # Wallet creation, import, unlock, dashboard
├── transactions/    # Send form, TX history, signing, gas estimation
├── tokens/          # Token list, details, custom token addition
└── security/        # Backup, password management, auto-lock settings
```

### Backend Components (Rust → migrating to Go in Phase 1.5)

#### Project Structure (Current Rust — will be replaced by Go in Phase 1.5)

```rust
src/
├── api/                       // REST API endpoints
│   ├── mod.rs                // Module exports
│   ├── server.rs             // Axum server configuration
│   ├── types.rs              // Request/response types
│   └── wallet.rs             // Wallet CRUD endpoints
├── database/                  // SQLite persistence
│   ├── mod.rs                // Module exports
│   ├── connection.rs         // Database pool
│   ├── models.rs             // Data models (Wallet, WalletAddress)
│   ├── wallet.rs             // Wallet CRUD operations
│   └── wallet_address.rs     // Address CRUD operations
├── lib.rs                     // Library exports
└── main.rs                    // Entry point
```

> **Note:** No `core/` directory. All cryptographic functionality (mnemonic generation,
> HD wallet derivation, encryption) is handled by the frontend per non-custodial design.

#### Key Implementations

> **⚠️ Architecture Note:** The following code examples represent **frontend** implementations.
> Per the non-custodial design, all cryptographic operations (HD wallet, transactions, encryption)
> are handled client-side in TypeScript/JavaScript. The backend only stores metadata and provides
> blockchain query services.

**HD Wallet** (Frontend — `lib/crypto/hdwallet.ts`):

```typescript
type SupportedChain = 'bitcoin' | 'ethereum' | 'solana';

interface DerivedAddress {
  address: string;
  publicKey: Uint8Array;
  derivationPath: string;
}

function deriveAddressFromMnemonic(
  mnemonic: string,
  chain: SupportedChain
): Promise<DerivedAddress>;
// Derives BIP44 address for the given chain from a BIP39 mnemonic
// Bitcoin: m/44'/0'/0'/0/0 (secp256k1, P2PKH)
// Ethereum: m/44'/60'/0'/0/0 (secp256k1, Keccak256)
// Solana: m/44'/501'/0'/0' (Ed25519)
```

**Encryption** (Frontend — `lib/crypto/encryption.ts`):

```typescript
interface EncryptedData {
  ciphertext: Uint8Array;
  salt: Uint8Array;      // 32 bytes
  nonce: Uint8Array;     // 12 bytes
}

function encryptMnemonic(
  mnemonic: string,
  password: string
): Promise<EncryptedData>;
// AES-256-GCM encryption with Argon2id key derivation (64MB, 3 iterations)

function decryptMnemonic(
  encrypted: EncryptedData,
  password: string
): Promise<string>;
```

**Secure Memory** (Frontend — `lib/crypto/secureMemory.ts`):

```typescript
function zeroBuffer(buffer: Uint8Array): void;
// Fills buffer with zeros to clear sensitive data from memory

function withSecureCleanup<T>(
  buffer: Uint8Array,
  fn: (buffer: Uint8Array) => T | Promise<T>
): Promise<T>;
// Executes fn with buffer, guarantees zeroing even on error
```

---

## Development Roadmap

### Phase 1: Foundation

#### Project Setup & Core Cryptography

**Goals**: Establish development environment and implement core wallet functionality

**Backend Tasks**:

- [x] Initialize Rust project with Cargo ✅
- [x] ~~Set up core dependencies (bip39, bitcoin, secp256k1)~~ → Removed in T6 (non-custodial)
- [x] ~~Implement BIP39 mnemonic generation and validation~~ → Moved to frontend (non-custodial)
- [x] ~~Implement BIP32/BIP44 key derivation~~ → Moved to frontend (non-custodial)
- [x] ~~Create basic encryption/decryption for key storage~~ → Moved to frontend (non-custodial)

> **Note:** Week 1 backend crypto tasks were initially implemented, then refactored out in Week 2 T6
> to align with non-custodial architecture. All crypto operations now happen on frontend.

**Frontend Tasks**:

- [x] **Initialization & Setup** ✅:
  - [x] Initialize Next.js project with TypeScript and App Router
  - [x] Set up Tailwind CSS styling framework
  - [x] Install Viem (Ethereum) and Solana web3.js dependencies
  - [x] Configure Zustand state management store
  - [x] Create project structure with component directories
  - [x] Set up TypeScript types and security headers

**Deliverables**:

- Working HD wallet generation and key derivation
- Basic UI for wallet creation/import
- Comprehensive test suite for crypto functions

#### Basic Wallet Operations

**Goals**: Connect frontend to backend and implement basic wallet operations

**Backend Tasks**:

- [x] T1: Set up Axum web server ✅
- [x] T2: Implement simplified wallet metadata-only API endpoints ✅
  - [x] Remove sensitive data (passwords, mnemonics) from create/import endpoints
  - [x] Simplify request structures to metadata-only
  - [x] Update response structures for non-custodial model
- [x] T3: Add basic SQLite database for wallet metadata ✅
- [x] T4: Implement wallet management endpoints ✅
  - [x] GET /wallets - List user's wallet metadata
  - [x] POST /wallet/{id}/addresses - Register derived addresses from frontend
  - [x] Wallet metadata CRUD operations (no sensitive data)
- [x] T5: Create foundation for blockchain service endpoints ✅
  - [x] GET /wallet/{id}/balance - Balance checking (mock data, ready for blockchain API)
  - [x] GET /wallet/{id}/transactions - Transaction history (mock data)
- [x] T6: Remove all mnemonic generation and encryption from backend ✅
  - [x] Deleted `src/core/` directory (~2000 lines of crypto code)
  - [x] Removed 9 crypto dependencies from Cargo.toml
  - [x] Deleted obsolete `tests/` directory

**Frontend Tasks**:

- [x] T1: Implement client-side cryptographic functionality ✅
  - [x] Client-side mnemonic generation (BIP39)
  - [x] Password-based encryption system (AES-256-GCM + Argon2)
  - [x] HD wallet derivation (BIP32/BIP44) for address generation
  - [x] Secure memory management and cleanup
- [x] T2: Build secure client-side storage management ✅
  - [x] Encrypted mnemonic storage in IndexedDB
  - [x] Wallet operations (create, import, unlock, lock, delete)
  - [x] Auto-timeout and security features
- [x] T3: Implement API client for metadata-only backend communication ✅
- [x] T4: Create wallet creation/import UI with client-side crypto ✅
  - [x] Mnemonic generation and display
  - [x] Password entry and validation
  - [x] Mnemonic backup confirmation flow
- [x] T5: Create wallet dashboard with locally-stored encrypted wallets ✅
  - [x] Wallet listing from local storage
  - [x] Unlock/lock interface
  - [x] Account derivation and display
- [ ] T6: Add basic balance display (mock data initially)

**Integration**:

- [ ] T1: End-to-end wallet creation and import flow
- [ ] T2: Secure communication between frontend and backend
- [ ] T3: Basic error handling and user feedback

### Phase 1.5: Backend Migration — Rust to Go

**Goals**: Rewrite the backend in Go while preserving the existing API contract. The backend is a metadata store and API proxy — Go's simplicity and fast iteration speed are a better fit than Rust for this workload.

**Approach**: Rewrite against the existing API spec. Frontend stays unchanged — all endpoints, request/response shapes, and behavior must match 1:1.

**Tasks**:

- [ ] T1: Initialize Go project and core structure
  - [ ] Set up Go module with project layout (cmd/, internal/api/, internal/database/)
  - [ ] Choose and configure HTTP router (Chi or stdlib)
  - [ ] Set up structured logging (slog or zerolog)
  - [ ] Configure CORS middleware (matching current Axum CORS config)
  - [ ] Add request size limiting middleware

- [ ] T2: Database layer (SQLite)
  - [ ] Set up SQLite connection with go-sqlite3 or modernc.org/sqlite
  - [ ] Implement auto-migration (same schema: wallets, wallet_addresses tables)
  - [ ] Implement wallet CRUD operations (create, list, get, update, delete)
  - [ ] Implement wallet_address CRUD operations (register, list, delete)
  - [ ] Ensure foreign key CASCADE delete behavior matches

- [ ] T3: Wallet API endpoints
  - [ ] GET /health
  - [ ] POST /wallet/create
  - [ ] POST /wallet/import
  - [ ] GET /wallets
  - [ ] PUT /wallet/{id}
  - [ ] DELETE /wallet/{id}
  - [ ] POST /wallet/{id}/addresses
  - [ ] Input validation matching existing rules (name length, chain validation, etc.)

- [ ] T4: Blockchain service endpoints (mock, same as Rust)
  - [ ] GET /wallet/{id}/balance (mock data)
  - [ ] GET /wallet/{id}/transactions (empty array)

- [ ] T5: Testing and verification
  - [ ] Port existing backend tests to Go
  - [ ] Verify all endpoints match existing API contract (same URLs, methods, request/response JSON; /broadcast intentionally removed per Write-Direct pattern)
  - [ ] Run frontend test suite against Go backend to confirm compatibility
  - [ ] Verify CORS, error responses, and status codes match

- [ ] T6: Cleanup
  - [ ] Remove backend/ Rust directory
  - [ ] Update README.md backend sections (tech stack, commands, project structure)
  - [ ] Update CLAUDE.md backend sections
  - [ ] Update environment variable documentation if any changes

### Phase 2: EVM Transactions & RPC Integration

**Goals**: Add full Ethereum support with balance checking and transactions

**Backend Tasks** (Metadata & History Only - per Write-Direct pattern):

- [ ] T1: Implement transaction history indexing for registered addresses
  - [ ] On-demand fetch from block explorers/indexers (Etherscan, etc.)
  - [ ] Cache and store transaction history
- [ ] T2: Add token list aggregation from external sources
- [ ] T3: Implement price feed integration (CoinGecko, etc.)

> **Note:** Per "Write-Direct, Read-Indexed" pattern, frontend handles real-time RPC calls
> (balance, gas estimation, nonce, broadcast) directly via Viem. Backend focuses on
> historical data indexing and API aggregation.

**Frontend Tasks** (Direct RPC via Viem):

- [ ] T1: Set up Viem for direct Ethereum RPC interactions
  - [ ] Configure RPC providers (Infura, Alchemy, public RPCs)
  - [ ] Implement balance fetching (frontend → RPC)
  - [ ] Implement gas estimation (frontend → RPC)
  - [ ] Implement nonce management (frontend → RPC)
  - [ ] Implement transaction broadcasting (frontend → RPC)
- [ ] T2: Implement client-side transaction signing
  - [ ] Sign ETH transfer transactions with private keys
  - [ ] Secure private key handling during signing
- [ ] T3: Create send transaction form with real-time gas estimation
- [ ] T4: Implement network switching (mainnet/testnets)
- [ ] T5: Register derived Ethereum addresses with backend

**Testing**:

- [ ] T1: Integration tests with Ethereum testnets
- [ ] T2: Transaction signing verification
- [ ] T3: Balance accuracy testing

### Phase 3: Token Support & UX

#### Token Support

**Goals**: Add ERC-20 token support and enhanced transaction features

**Backend Tasks** (Token Metadata & Aggregation Only):

- [ ] T1: Aggregate token lists from external sources (Uniswap, CoinGecko)
- [ ] T2: Cache token metadata (symbol, decimals, name, logo)
- [ ] T3: Implement token transaction history indexing
- [ ] T4: Add custom token registry for user-added tokens

> **Note:** Frontend handles token balance queries directly via Viem (ERC-20 balanceOf calls).
> Backend provides token discovery and metadata aggregation.

**Frontend Tasks** (Direct RPC for Balances):

- [ ] T1: Implement ERC-20 balance fetching via Viem (frontend → RPC)
- [ ] T2: Implement ERC-20 transaction signing with private keys
- [ ] T3: Create token list component with IndexedDB caching
- [ ] T4: Add token balance display with real-time updates
- [ ] T5: Implement token transfer UI with gas estimation (frontend → RPC)
- [ ] T6: Create custom token addition flow
- [ ] T7: Add token search and filtering
- [ ] T8: Secure handling of token contract interactions

#### Transaction History & UX

**Goals**: Improve transaction management and user experience

**Backend Tasks**:

- [ ] T1: Implement transaction history storage
- [ ] T2: Add transaction status tracking
- [ ] T3: Create WebSocket notifications for real-time updates
- [ ] T4: Implement transaction retry logic

**Frontend Tasks**:

- [ ] T1: Enhanced transaction history with filtering
- [ ] T2: Real-time balance and transaction updates
- [ ] T3: Improved loading states and error handling
- [ ] T4: Transaction details and explorer links

### Phase 4: Solana Integration

**Goals**: Add Solana support and create chain abstraction

**Backend Tasks** (History & Token Aggregation Only):

- [ ] T1: Implement Solana transaction history indexing (on-demand)
- [ ] T2: Aggregate SPL token lists (Jupiter, etc.)
- [ ] T3: Cache Solana token metadata

> **Note:** Per "Write-Direct, Read-Indexed" pattern, frontend handles real-time Solana RPC calls
> (balance, transaction broadcast) directly via @solana/web3.js.

**Frontend Tasks** (Direct RPC via @solana/web3.js):

- [ ] T1: Set up @solana/web3.js for direct Solana RPC interactions
  - [ ] Configure RPC endpoints (mainnet, devnet)
  - [ ] Implement SOL balance fetching (frontend → RPC)
  - [ ] Implement SPL token balance fetching (frontend → RPC)
  - [ ] Implement transaction broadcasting (frontend → RPC)
- [ ] T2: Implement client-side Solana transaction signing
  - [ ] Sign SOL transfer transactions
  - [ ] Sign SPL token transactions
  - [ ] Secure handling of Ed25519 private keys
- [ ] T3: Add Solana network support in UI
- [ ] T4: Implement chain switching interface
- [ ] T5: Add SPL token support with real-time balances
- [ ] T6: Create unified transaction interface for multiple chains
- [ ] T7: Register derived Solana addresses with backend

**Architecture**:

- [ ] T1: Refactor frontend for multi-chain private key management
- [ ] T2: Create common interfaces for different chains (Ethereum/Solana)
- [ ] T3: Implement chain-specific configurations and derivation paths
- [ ] T4: Unified IndexedDB storage for multi-chain encrypted wallets

### Phase 5: Bitcoin Integration

**Goals**: Add Bitcoin transaction support leveraging the existing key derivation (secp256k1, BIP44 m/44'/0'/0'/0/0) already implemented in `hdwallet.ts`.

> **Note:** Bitcoin uses a UTXO model (unlike Ethereum/Solana's account model), requiring different transaction building logic. Key derivation and address generation are already complete.

**Frontend Tasks** (Direct RPC via Bitcoin API providers):

- [ ] T1: Set up Bitcoin RPC/API provider (Blockstream, Mempool.space)
- [ ] T2: Implement UTXO fetching and balance calculation
- [ ] T3: Implement Bitcoin transaction building (UTXO selection, change output)
- [ ] T4: Implement Bitcoin transaction signing (secp256k1)
- [ ] T5: Implement Bitcoin fee estimation
- [ ] T6: Implement Bitcoin transaction broadcasting (frontend → RPC)
- [ ] T7: Register derived Bitcoin addresses with backend

**Backend Tasks** (History Only):

- [ ] T1: Implement Bitcoin transaction history indexing (on-demand)
- [ ] T2: Cache Bitcoin transaction metadata

**Testing**:

- [ ] T1: Integration tests with Bitcoin testnet
- [ ] T2: UTXO selection and change calculation verification
- [ ] T3: Transaction signing verification

### Phase 6: Production Features

#### Security Hardening

**Goals**: Implement production-level security features for non-custodial architecture

**Frontend Security Tasks**:

- [ ] T1: Security audit of client-side key management
- [ ] T2: Implement advanced encryption options (hardware security modules prep)
- [ ] T3: Add comprehensive backup and recovery flows
  - [ ] Mnemonic phrase backup verification
  - [ ] Encrypted wallet export/import
  - [ ] Recovery phrase testing interface
- [ ] T4: Implement robust session management
  - [ ] Auto-lock timer configuration
  - [ ] Memory clearing verification
  - [ ] Secure session state management
- [ ] T5: Add security warnings and confirmations
  - [ ] Large transaction confirmations
  - [ ] Suspicious activity warnings
  - [ ] Phishing protection measures

**Backend Security Tasks**:

- [ ] T1: API security hardening
- [ ] T2: Rate limiting implementation
- [ ] T3: Address validation and monitoring
- [ ] T4: Blockchain data integrity verification

#### UX Polish & Documentation

**Goals**: Polish user experience and create comprehensive documentation

**Tasks**:

- [ ] T1: UI/UX improvements and responsive design
- [ ] T2: Comprehensive error handling and user feedback
- [ ] T3: Performance optimization for client-side crypto operations
- [ ] T4: Complete documentation
  - [ ] Non-custodial architecture documentation
  - [ ] Client-side security implementation guide
  - [ ] Frontend crypto library documentation
- [ ] T5: Security best practices guide for non-custodial wallets

---

## Security Considerations

### Critical Security Principles

#### 1. Non-Custodial Security Model 🔒

- **Frontend-only key management** - Private keys never leave client device
- **Zero backend trust** - Backend never sees mnemonics, passwords, or private keys
- **Client-side encryption** - All sensitive data encrypted before storage
- **IndexedDB storage** - Encrypted mnemonics stored in browser IndexedDB
- **No server-side custody** - Backend handles only metadata and blockchain services

#### 2. Private Key Protection

- **Never log private keys** - Not even in development environments
- **Secure random generation** - Use Web Crypto API or crypto-js with secure entropy
- **Encryption at rest** - AES-256-GCM with user-derived passwords (Argon2)
- **Memory protection** - Clear sensitive data from memory after use
- **No network transmission** - Private keys and mnemonics never sent to backend
- **Derivation security** - Secure BIP32/BIP44 key derivation implementation

#### 3. Mnemonic Security

- **Client-side generation** - Mnemonics generated in frontend using crypto-secure RNG
- **BIP39 compliance** - Use standardized wordlist and validation
- **Entropy requirements** - Minimum 128-bit entropy (12 words), prefer 256-bit (24 words)
- **Secure display** - Mask mnemonics when not explicitly viewing
- **Backup verification** - Require users to confirm backup before proceeding
- **Recovery testing** - Provide interface to test mnemonic recovery

#### 4. Transaction Security

- **Transaction verification** - Always display transaction details before signing
- **Gas limit protection** - Prevent excessive gas costs and potential attacks
- **Address validation** - Verify address checksums and formats
- **Replay protection** - Proper nonce management and chain ID validation
- **Amount validation** - Prevent integer overflow and negative amounts

#### 5. Network Security

- **HTTPS enforcement** - All communications must use TLS
- **RPC endpoint validation** - Verify SSL certificates for blockchain connections
- **Rate limiting** - Prevent API abuse and DoS attacks
- **Input sanitization** - Validate and sanitize all user inputs
- **CORS configuration** - Restrict cross-origin requests appropriately

#### 6. Application Security

- **Content Security Policy** - Prevent XSS attacks
- **Dependency auditing** - Regular `npm audit` and `cargo audit`
- **Secret management** - Use environment variables, never hardcode secrets
- **Session security** - Secure session management and timeout
- **Error handling** - Don't expose sensitive information in error messages

### Security Checklist

**Before Production**:

- [ ] All private keys encrypted with strong passwords
- [ ] Secure random number generation verified
- [ ] No hardcoded secrets in code
- [ ] All dependencies audited for vulnerabilities
- [ ] Input validation on all endpoints
- [ ] Rate limiting implemented
- [ ] HTTPS enforced everywhere
- [ ] Error messages don't leak sensitive information
- [ ] Transaction amounts and gas limits validated
- [ ] Address validation and checksums verified
- [ ] Session timeout implemented
- [ ] Backup and recovery flows tested
- [ ] Security headers configured
- [ ] Cross-site scripting protection enabled

---

## Testing Strategy

### Unit Testing

#### Frontend Testing (Vitest, ~190 tests)

```typescript
// Example: Wallet component tests
describe("WalletDashboard", () => {
  test("displays correct balance for active account", () => {
    // Test balance display accuracy
  });

  test("handles network errors gracefully", () => {
    // Test error handling
  });

  test("updates balance when account changes", () => {
    // Test state management
  });
});

// Example: Crypto utility tests
describe("Address validation", () => {
  test("validates Ethereum addresses correctly", () => {
    expect(
      isValidEthereumAddress("0x742d35Cc12C4F24aF6a8fa1d8F78CC2E8f3C72Ac"),
    ).toBe(true);
    expect(isValidEthereumAddress("invalid")).toBe(false);
  });
});
```

### Integration Testing

#### API Testing

```typescript
// Test non-custodial wallet creation flow
describe("Wallet API Integration", () => {
  test("complete wallet creation flow", async () => {
    // 1. Create wallet metadata on backend (no sensitive data)
    const createResult = await createWallet("My Wallet");
    expect(createResult.success).toBe(true);
    expect(createResult.data.wallet_id).toBeDefined();

    // 2. Register derived addresses (public data only)
    const registerResult = await registerAddress(createResult.data.wallet_id, {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
      chain: "ethereum",
      derivation_path: "m/44'/60'/0'/0/0",
    });
    expect(registerResult.success).toBe(true);

    // 3. List wallets
    const listResult = await listWallets();
    expect(listResult.data).toHaveLength(1);
  });
});
```

#### Blockchain Integration Testing

```typescript
describe("Blockchain Integration", () => {
  test("Ethereum testnet integration", async () => {
    // Test with Goerli or Sepolia testnet
    // Verify balance fetching
    // Test transaction sending
    // Verify transaction confirmation
  });

  test("Solana devnet integration", async () => {
    // Test with Solana devnet
    // Verify account creation
    // Test SOL transfers
    // Test SPL token operations
  });
});
```

---

## Key Technical Decisions

### 1. Non-Custodial vs Custodial Architecture

**Decision**: True Non-Custodial Architecture (Frontend Encryption)
**Rationale**:

- **User Sovereignty**: Users maintain complete control over their private keys and funds
- **Zero Trust**: Backend never sees plaintext mnemonics, passwords, or private keys
- **Security**: Eliminates server-side custody risks and attack vectors
- **Industry Standard**: Follows established crypto wallet patterns (MetaMask, hardware wallets)
- **Regulatory Clarity**: No custody responsibilities or compliance requirements

**Implementation Details**:

- **Frontend Responsibilities**: Mnemonic generation, encryption, private key derivation, transaction signing
- **Backend Responsibilities**: Metadata storage, blockchain services, address monitoring
- **Storage Model**: Encrypted mnemonics in client IndexedDB, metadata only in backend database
- **Security Flow**: Password → Argon2 → AES-256-GCM encryption → Local storage

**Trade-offs Considered**:

- **Complexity**: Increased frontend cryptographic complexity vs simplified backend
- **Recovery**: No backend-assisted recovery vs user-controlled backup responsibility
- **UX**: Password requirements vs convenience of custodial solutions
- **Support**: Users responsible for key management vs backend-assisted recovery

### 2. Other Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform | Web Application | Fastest iteration, rich UI, can convert to Chrome extension later |
| State Management | Zustand | Simpler than Redux, excellent TypeScript support, small bundle size |
| Repository | Monorepo | Single clone, coordinated changes, shared types, unified CI/CD |
| Database | SQLite | No separate server, single file, sufficient for single-user wallet |
| Authentication | Password-based KDF | User controls key derivation, no external auth providers needed |

### 3. Backend Language: Rust → Go

**Original Decision**: Rust Backend
**Updated Decision**: Migrating to Go in Phase 1.5

**Original Rationale** (for Rust):

- Memory safety for cryptographic operations
- Performance for crypto computations
- Compiler-enforced security guarantees

**Why migrating to Go**:

- Backend no longer handles crypto (moved to frontend in non-custodial refactor)
- Backend is a simple metadata store and API proxy — Rust's complexity is unnecessary
- Go offers faster iteration speed for REST API + CRUD workloads
- Simpler error handling and deployment
- Single binary deployment (same benefit as Rust)

### 4. Viem vs Ethers.js for Ethereum

**Decision**: Viem
**Rationale**:

- **Modern Architecture**: Better TypeScript integration and tree-shaking
- **Performance**: Lighter weight and faster
- **Developer Experience**: Better error handling and debugging
- **Type Safety**: Superior TypeScript support
- **Modular Design**: Import only what you need

**Trade-offs Considered**:

- Documentation: Ethers.js has more tutorials (Viem docs sufficient)
- Adoption: Ethers.js more widely adopted (Viem gaining rapidly)

---

## Future Enhancements

### Architecture Backlog

Items deferred from the current design for future consideration:

#### Proactive Blockchain Indexing

**Current**: On-demand indexing - backend fetches TX history when requested
**Future**: Proactive indexing with background jobs that monitor registered addresses

Benefits of proactive indexing:

- Faster history retrieval (pre-indexed)
- Real-time notifications for incoming transactions
- Better analytics and reporting capabilities

Trade-offs:

- Increased backend complexity
- Higher infrastructure costs (continuous RPC polling)
- Rate limit management with RPC providers

#### Backend WebSocket Relay for Multi-Chain

**Current**: Frontend connects directly to each chain's RPC/WebSocket
**Future**: Backend acts as WebSocket relay/multiplexer

Benefits of backend relay:

- Single WebSocket connection from frontend
- Backend handles multi-chain connection management
- Better for mobile (battery, connection limits)
- Centralized rate limiting and caching

Trade-offs:

- Added latency through backend hop
- Backend becomes critical path for real-time data
- More complex backend infrastructure

### Phase 6: Advanced Features (Future)

#### Enhanced Security

- **Hardware Wallet Integration**: Support for Ledger/Trezor
- **Multi-Signature Wallets**: Basic multisig support
- **Time-Locked Transactions**: Transaction scheduling
- **Biometric Authentication**: For supported platforms

#### DeFi Integration

- **DEX Integration**: Uniswap, SushiSwap, Raydium connections
- **Staking Support**: ETH 2.0 staking, Solana staking
- **Yield Farming**: Basic DeFi protocol interactions
- **Portfolio Tracking**: DeFi position monitoring

#### Additional Blockchains

- **Cosmos Ecosystem**: IBC transfers and staking
- **Polkadot Parachain**: DOT and parachain tokens
- **Layer 2 Expansion**: More L2 solutions (zkSync, StarkNet)

#### Advanced Features

- **NFT Support**: Display and transfer NFTs
- **Address Book**: Contact management
- **Transaction Templates**: Recurring payments
- **Cross-Chain Bridges**: Automated bridging
- **Price Alerts**: Token price notifications

### Platform Expansion

#### Chrome Extension Conversion

**Timeline**: Post-MVP
**Benefits**:

- Real dApp integration
- Enhanced security model
- Standard wallet UX

**Migration Strategy**:

1. Extract core logic to shared libraries
2. Create extension-specific UI layer
3. Implement content script for dApp injection
4. Add extension-specific security features

#### Mobile Application

**Timeline**: Long-term consideration
**Platforms**: React Native or native iOS/Android
**Benefits**:

- Mobile-first crypto experience
- QR code scanning
- Push notifications
- Biometric authentication

### Security Enhancements

#### Advanced Security Features

- **Security Audits**: Professional security assessments
- **Bug Bounty Program**: Community security testing
- **Formal Verification**: Mathematical proof of critical functions
- **Hardware Security Module**: Enterprise-grade key storage

#### Compliance and Legal

- **AML Screening**: Address risk assessment
- **Regulatory Compliance**: Jurisdiction-specific requirements
- **Privacy Features**: Enhanced transaction privacy
- **Audit Logging**: Comprehensive security logging

---

_This design document serves as the comprehensive guide for building a multi-chain cryptocurrency wallet. It should be updated as the project evolves and new requirements emerge._
