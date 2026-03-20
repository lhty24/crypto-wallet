# Multi-Chain Cryptocurrency Wallet - Design Document

## Table of Contents

1. [Project Scope](#project-scope)
2. [Core Features to Build](#core-features-to-build)
3. [Development Approach](#development-approach)
4. [Development Style](#development-style)
5. [Technical Stack](#technical-stack)
6. [Detailed Architecture](#detailed-architecture)
7. [Component Breakdown](#component-breakdown)
8. [Development Roadmap](#development-roadmap)
9. [Security Considerations](#security-considerations)
10. [Testing Strategy](#testing-strategy)
11. [Key Technical Decisions](#key-technical-decisions)
12. [Future Enhancements](#future-enhancements)

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

## Core Features to Build

### Phase 1: Foundation

1. **Wallet Creation & Management**

   - Mnemonic generation (BIP39)
   - Wallet import from mnemonic/private key
   - Secure password-based encryption

2. **Key Management**
   - HD wallet implementation (BIP32, BIP44)
   - Multi-account support
   - Private key derivation

### Phase 2: Basic Operations

3. **Balance Operations**

   - Native token balance checking (ETH, SOL)
   - Multi-account balance display
   - Real-time balance updates

4. **Transaction Management**
   - Send/receive transactions
   - Transaction signing
   - Gas estimation and management

### Phase 3: Enhanced Features

5. **Token Support**

   - ERC-20 token support (Ethereum ecosystem)
   - SPL token support (Solana ecosystem)
   - Custom token addition

6. **Transaction History**
   - Local transaction logging
   - Transaction status tracking
   - Detailed transaction views

### Phase 4: Multi-Chain Support

7. **Extended Chain Support**
   - Ethereum mainnet and testnets
   - Layer 2 solutions (Polygon, Arbitrum, Optimism)
   - Solana mainnet and devnet

---

## Development Approach

### Development Methodology

1. **Incremental Development**: Build and test each component before moving to the next
2. **Security Focus**: Implement security best practices from the beginning
3. **Testing Integration**: Test each component thoroughly before progression
4. **Code Quality**: Maintain high standards throughout development

### Development Phases

- **Phase 1**: Foundation (Weeks 1-2) - Core cryptography and basic wallet
- **Phase 2**: EVM Support (Weeks 2-3) - Ethereum integration and basic UI
- **Phase 3**: Enhanced Features (Weeks 3-4) - Tokens and transaction history
- **Phase 4**: Multi-Chain (Weeks 4-5) - Solana integration and chain abstraction
- **Phase 5**: Production Polish (Weeks 5-6) - Security hardening and UX improvements

---

## Development Style

### Code Quality Standards

- **Production-quality code** with proper error handling
- **Comprehensive inline comments** for complex implementations
- **Type safety** throughout the application (TypeScript + Rust)
- **Security-first mindset** with defensive programming practices

### Documentation Requirements

- Inline code comments for complex crypto operations
- API documentation for all endpoints
- Security considerations documented for each component
- Architecture decisions recorded with rationale

### Testing Philosophy

- Unit tests for all cryptographic functions
- Integration tests with testnets
- End-to-end testing for user flows
- Security testing for key management

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

### Backend: Rust + Axum ✅

**Role**: Metadata Cache and API Aggregator

The backend does NOT proxy real-time blockchain queries. Instead, it focuses on:

- **Metadata Storage**: Wallet names, address labels, user preferences
- **Historical Data Indexing**: Transaction history (on-demand, not proactive)
- **API Aggregation**: Token lists, price feeds from multiple sources
- **Caching**: Reduce frontend API calls for non-real-time data

**Rationale**:

- Memory safety for data processing
- Performance for caching and aggregation
- Secure by default with compiler guarantees
- Simplified scope: no blockchain RPC proxying

**Key Crates** (Metadata-only backend):

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
│ │ ❌ NO Private Keys   ││ │ SQLite Database   │  │ │ Redis Cache              │ │
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

#### Core Wallet Components

```typescript
src/
├── components/
│   ├── wallet/
│   │   ├── WalletDashboard.tsx     // Main wallet overview
│   │   ├── AccountList.tsx         // HD wallet account management
│   │   ├── CreateWallet.tsx        // Client-side mnemonic generation UI
│   │   ├── ImportWallet.tsx        // Import and encrypt mnemonic
│   │   ├── UnlockWallet.tsx        // Password entry and decryption
│   │   └── WalletSelector.tsx      // Select from local encrypted wallets
│   ├── transactions/
│   │   ├── SendForm.tsx           // Transaction creation and signing
│   │   ├── TransactionHistory.tsx  // TX history with filtering
│   │   ├── TransactionDetails.tsx  // Detailed TX view
│   │   ├── TransactionSigner.tsx   // Client-side transaction signing
│   │   └── GasEstimator.tsx       // Gas price estimation
│   ├── tokens/
│   │   ├── TokenList.tsx          // ERC-20/SPL token balances
│   │   ├── TokenDetails.tsx       // Individual token view
│   │   └── AddToken.tsx           // Custom token addition
│   ├── security/
│   │   ├── SecuritySettings.tsx   // Backup, password change
│   │   ├── BackupMnemonic.tsx     // Mnemonic backup flow
│   │   ├── PasswordManager.tsx    // Password management
│   │   └── AutoLockSettings.tsx   // Session timeout configuration
│   └── crypto/
│       ├── MnemonicGenerator.tsx  // BIP39 mnemonic generation
│       ├── EncryptionManager.tsx  // AES-256 encryption/decryption
│       ├── KeyDerivation.tsx      // BIP32/BIP44 key derivation
│       └── LocalStorage.tsx       // Secure local storage management
```

#### State Management (Zustand)

```typescript
interface WalletState {
  // Core State
  isUnlocked: boolean;
  currentWallet: EncryptedWallet | null;
  currentAccount: Account | null;
  accounts: Account[];
  localWallets: EncryptedWallet[]; // From localStorage

  // Multi-Chain State
  activeChain: SupportedChain;
  supportedChains: ChainConfig[];

  // Balance & Token State (fetched from backend)
  balances: Record<string, Balance>;
  tokens: Record<string, Token[]>;

  // Transaction State
  pendingTransactions: Transaction[];
  transactionHistory: Transaction[];

  // Security State
  autoLockTimer: number;
  lastActivity: Date;

  // Crypto Actions (Client-Side)
  generateMnemonic: () => string;
  encryptMnemonic: (mnemonic: string, password: string) => EncryptedWallet;
  decryptMnemonic: (wallet: EncryptedWallet, password: string) => string;
  deriveKeys: (mnemonic: string, chain: SupportedChain) => PrivateKey[];
  signTransaction: (
    tx: UnsignedTransaction,
    privateKey: PrivateKey
  ) => SignedTransaction;

  // Storage Actions
  saveWalletLocally: (wallet: EncryptedWallet) => void;
  loadLocalWallets: () => EncryptedWallet[];

  // Backend Actions (Metadata Only)
  registerWallet: (name: string) => Promise<string>; // Returns wallet_id
  registerAddresses: (walletId: string, addresses: string[]) => Promise<void>;
  fetchBalances: (walletId: string) => Promise<Balance[]>;
  broadcastTransaction: (signedTx: SignedTransaction) => Promise<string>;
}
```

### Backend Components (Rust)

#### Project Structure (Current - Post T6 Refactor)

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

**HD Wallet Core** (Frontend - TypeScript/conceptual):

```rust
pub struct HDWallet {
    mnemonic: Mnemonic,
    seed: [u8; 64],
    master_key: ExtendedPrivKey,
}

impl HDWallet {
    pub fn new(entropy_bits: usize) -> Result<Self>;
    pub fn from_mnemonic(mnemonic: Mnemonic) -> Result<Self>;
    pub fn derive_account(&self, chain: Chain, index: u32) -> Result<Account>;
}
```

**Transaction Engine**:

```rust
pub struct TransactionBuilder {
    chain: Chain,
    from: Address,
    to: Address,
    amount: u64,
    gas_price: Option<u64>,
    nonce: Option<u64>,
}

impl TransactionBuilder {
    pub async fn build_evm_transaction(&self) -> Result<EvmTransaction>;
    pub async fn build_solana_transaction(&self) -> Result<SolanaTransaction>;
    pub async fn estimate_gas(&self) -> Result<u64>;
    pub async fn sign_transaction(&self, private_key: &PrivateKey) -> Result<SignedTransaction>;
}
```

**Security Layer**:

```rust
pub struct EncryptedKeystore {
    encrypted_data: Vec<u8>,
    salt: [u8; 32],
    nonce: [u8; 12],
    version: u8,
}

impl EncryptedKeystore {
    pub fn encrypt_mnemonic(mnemonic: &str, password: &str) -> Result<Self>;
    pub fn decrypt_mnemonic(&self, password: &str) -> Result<String>;
}
```

---

## Development Roadmap

### Phase 1: Foundation (Weeks 1-2)

#### Week 1: Project Setup & Core Cryptography

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

- [ ] **Initialization & Setup**:
  - [ ] Initialize Next.js project with TypeScript and App Router
  - [ ] Set up Tailwind CSS styling framework
  - [ ] Install Viem (Ethereum) and Solana web3.js dependencies
  - [ ] Configure Zustand state management store
  - [ ] Create project structure with component directories
  - [ ] Set up TypeScript types and security headers

**Deliverables**:

- Working HD wallet generation and key derivation
- Basic UI for wallet creation/import
- Comprehensive test suite for crypto functions

#### Week 2: Basic Wallet Operations

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
  - [x] POST /wallet/{id}/broadcast - Broadcast signed transactions (mock, ready for integration)
- [x] T6: Remove all mnemonic generation and encryption from backend ✅
  - [x] Deleted `src/core/` directory (~2000 lines of crypto code)
  - [x] Removed 9 crypto dependencies from Cargo.toml
  - [x] Deleted obsolete `tests/` directory

**Frontend Tasks**:

- [x] Implement client-side cryptographic functionality
  - [x] Client-side mnemonic generation (BIP39)
  - [x] Password-based encryption system (AES-256-GCM + Argon2)
  - [x] HD wallet derivation (BIP32/BIP44) for address generation
  - [x] Secure memory management and cleanup
- [x] Build secure client-side storage management
  - [x] Encrypted mnemonic storage in IndexedDB
  - [x] Wallet operations (create, import, unlock, lock, delete)
  - [x] Auto-timeout and security features
- [ ] Implement API client for metadata-only backend communication
- [ ] Create wallet creation/import UI with client-side crypto
  - [ ] Mnemonic generation and display
  - [ ] Password entry and validation
  - [ ] Mnemonic backup confirmation flow
- [ ] Create wallet dashboard with locally-stored encrypted wallets
  - [ ] Wallet listing from local storage
  - [ ] Unlock/lock interface
  - [ ] Account derivation and display
- [ ] Add basic balance display (mock data initially)

**Integration**:

- [ ] End-to-end wallet creation and import flow
- [ ] Secure communication between frontend and backend
- [ ] Basic error handling and user feedback
- [ ] Remove `/broadcast` endpoint from backend (frontend broadcasts directly via RPC per Write-Direct pattern)

### Phase 2: EVM Support (Weeks 2-3)

#### Week 2-3: Ethereum Integration

**Goals**: Add full Ethereum support with balance checking and transactions

**Backend Tasks** (Metadata & History Only - per Write-Direct pattern):

- [ ] Implement transaction history indexing for registered addresses
  - [ ] On-demand fetch from block explorers/indexers (Etherscan, etc.)
  - [ ] Cache and store transaction history
- [ ] Add token list aggregation from external sources
- [ ] Implement price feed integration (CoinGecko, etc.)

> **Note:** Per "Write-Direct, Read-Indexed" pattern, frontend handles real-time RPC calls
> (balance, gas estimation, nonce, broadcast) directly via Viem. Backend focuses on
> historical data indexing and API aggregation.

**Frontend Tasks** (Direct RPC via Viem):

- [ ] Implement Ethereum private key derivation from mnemonic
  - [ ] BIP44 Ethereum derivation path (m/44'/60'/0'/0/x)
  - [ ] Private key generation for Ethereum accounts
  - [ ] Address generation from private keys
- [ ] Set up Viem for direct Ethereum RPC interactions
  - [ ] Configure RPC providers (Infura, Alchemy, public RPCs)
  - [ ] Implement balance fetching (frontend → RPC)
  - [ ] Implement gas estimation (frontend → RPC)
  - [ ] Implement nonce management (frontend → RPC)
  - [ ] Implement transaction broadcasting (frontend → RPC)
- [ ] Implement client-side transaction signing
  - [ ] Sign ETH transfer transactions with private keys
  - [ ] Secure private key handling during signing
- [ ] Create send transaction form with real-time gas estimation
- [ ] Add transaction history view (frontend → backend for cached history)
- [ ] Implement network switching (mainnet/testnets)
- [ ] Register derived Ethereum addresses with backend

**Testing**:

- [ ] Integration tests with Ethereum testnets
- [ ] Transaction signing verification
- [ ] Balance accuracy testing

### Phase 3: Enhanced Features (Weeks 3-4)

#### Week 3: Token Support

**Goals**: Add ERC-20 token support and enhanced transaction features

**Backend Tasks** (Token Metadata & Aggregation Only):

- [ ] Aggregate token lists from external sources (Uniswap, CoinGecko)
- [ ] Cache token metadata (symbol, decimals, name, logo)
- [ ] Implement token transaction history indexing
- [ ] Add custom token registry for user-added tokens

> **Note:** Frontend handles token balance queries directly via Viem (ERC-20 balanceOf calls).
> Backend provides token discovery and metadata aggregation.

**Frontend Tasks** (Direct RPC for Balances):

- [ ] Implement ERC-20 balance fetching via Viem (frontend → RPC)
- [ ] Implement ERC-20 transaction signing with private keys
- [ ] Create token list component with IndexedDB caching
- [ ] Add token balance display with real-time updates
- [ ] Implement token transfer UI with gas estimation (frontend → RPC)
- [ ] Create custom token addition flow
- [ ] Add token search and filtering
- [ ] Secure handling of token contract interactions

#### Week 4: Transaction History & UX

**Goals**: Improve transaction management and user experience

**Backend Tasks**:

- [ ] Implement transaction history storage
- [ ] Add transaction status tracking
- [ ] Create WebSocket notifications for real-time updates
- [ ] Implement transaction retry logic

**Frontend Tasks**:

- [ ] Enhanced transaction history with filtering
- [ ] Real-time balance and transaction updates
- [ ] Improved loading states and error handling
- [ ] Transaction details and explorer links

### Phase 4: Multi-Chain Support (Weeks 4-5)

#### Week 4-5: Solana Integration

**Goals**: Add Solana support and create chain abstraction

**Backend Tasks** (History & Token Aggregation Only):

- [ ] Implement Solana transaction history indexing (on-demand)
- [ ] Aggregate SPL token lists (Jupiter, etc.)
- [ ] Cache Solana token metadata

> **Note:** Per "Write-Direct, Read-Indexed" pattern, frontend handles real-time Solana RPC calls
> (balance, transaction broadcast) directly via @solana/web3.js.

**Frontend Tasks** (Direct RPC via @solana/web3.js):

- [ ] Implement Solana private key derivation from mnemonic
  - [ ] BIP44 Solana derivation path (m/44'/501'/0'/0')
  - [ ] Ed25519 key pair generation for Solana
  - [ ] Solana address generation from public keys
- [ ] Set up @solana/web3.js for direct Solana RPC interactions
  - [ ] Configure RPC endpoints (mainnet, devnet)
  - [ ] Implement SOL balance fetching (frontend → RPC)
  - [ ] Implement SPL token balance fetching (frontend → RPC)
  - [ ] Implement transaction broadcasting (frontend → RPC)
- [ ] Implement client-side Solana transaction signing
  - [ ] Sign SOL transfer transactions
  - [ ] Sign SPL token transactions
  - [ ] Secure handling of Ed25519 private keys
- [ ] Add Solana network support in UI
- [ ] Implement chain switching interface
- [ ] Add SPL token support with real-time balances
- [ ] Create unified transaction interface for multiple chains
- [ ] Register derived Solana addresses with backend

**Architecture**:

- [ ] Refactor frontend for multi-chain private key management
- [ ] Create common interfaces for different chains (Ethereum/Solana)
- [ ] Implement chain-specific configurations and derivation paths
- [ ] Unified IndexedDB storage for multi-chain encrypted wallets

### Phase 5: Production Features (Weeks 5-6)

#### Week 5: Security Hardening

**Goals**: Implement production-level security features for non-custodial architecture

**Frontend Security Tasks**:

- [ ] Security audit of client-side key management
- [ ] Implement advanced encryption options (hardware security modules prep)
- [ ] Add comprehensive backup and recovery flows
  - [ ] Mnemonic phrase backup verification
  - [ ] Encrypted wallet export/import
  - [ ] Recovery phrase testing interface
- [ ] Implement robust session management
  - [ ] Auto-lock timer configuration
  - [ ] Memory clearing verification
  - [ ] Secure session state management
- [ ] Add security warnings and confirmations
  - [ ] Large transaction confirmations
  - [ ] Suspicious activity warnings
  - [ ] Phishing protection measures

**Backend Security Tasks**:

- [ ] API security hardening
- [ ] Rate limiting implementation
- [ ] Address validation and monitoring
- [ ] Blockchain data integrity verification

#### Week 6: UX Polish & Documentation

**Goals**: Polish user experience and create comprehensive documentation

**Tasks**:

- [ ] UI/UX improvements and responsive design
- [ ] Comprehensive error handling and user feedback
- [ ] Performance optimization for client-side crypto operations
- [ ] Complete documentation
  - [ ] Non-custodial architecture documentation
  - [ ] Client-side security implementation guide
  - [ ] Frontend crypto library documentation
- [ ] Security best practices guide for non-custodial wallets

---

## Security Considerations

### Critical Security Principles

#### 1. Non-Custodial Security Model 🔒

- **Frontend-only key management** - Private keys never leave client device
- **Zero backend trust** - Backend never sees mnemonics, passwords, or private keys
- **Client-side encryption** - All sensitive data encrypted before storage
- **Local storage only** - Encrypted mnemonics stored in browser localStorage
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

### Encryption Implementation

```rust
// Key Derivation using Argon2
fn derive_encryption_key(password: &str, salt: &[u8; 32]) -> Result<[u8; 32]> {
    let config = Config {
        variant: Variant::Argon2id,
        version: Version::Version13,
        mem_cost: 65536,      // 64 MB
        time_cost: 3,         // 3 iterations
        lanes: 4,             // 4 parallel threads
        secret: &[],
        ad: &[],
        hash_length: 32,
    };

    let mut key = [0u8; 32];
    argon2::hash_raw(password.as_bytes(), salt, &config, &mut key)?;
    Ok(key)
}

// AES-256-GCM Encryption
fn encrypt_sensitive_data(data: &[u8], password: &str) -> Result<EncryptedData> {
    let salt = generate_secure_random_32();
    let nonce = generate_secure_random_12();
    let key = derive_encryption_key(password, &salt)?;

    let cipher = Aes256Gcm::new(&key.into());
    let ciphertext = cipher.encrypt(&nonce.into(), data)?;

    Ok(EncryptedData {
        ciphertext,
        salt,
        nonce,
        version: 1,
    })
}
```

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

#### Frontend Testing (Jest + React Testing Library)

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
      isValidEthereumAddress("0x742d35Cc12C4F24aF6a8fa1d8F78CC2E8f3C72Ac")
    ).toBe(true);
    expect(isValidEthereumAddress("invalid")).toBe(false);
  });
});
```

#### Backend Testing (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mnemonic_generation() {
        let mnemonic = generate_mnemonic(256).unwrap();
        assert_eq!(mnemonic.word_count(), 24);
        assert!(mnemonic.validate().is_ok());
    }

    #[test]
    fn test_hd_wallet_derivation() {
        let wallet = HDWallet::from_test_mnemonic();
        let eth_account = wallet.derive_account(Chain::Ethereum, 0).unwrap();
        let sol_account = wallet.derive_account(Chain::Solana, 0).unwrap();

        assert!(eth_account.address().starts_with("0x"));
        assert_ne!(eth_account.address(), sol_account.address());
    }

    #[test]
    fn test_transaction_signing() {
        // Test Ethereum transaction signing
        // Test Solana transaction signing
        // Verify signature validation
    }

    #[test]
    fn test_encryption_decryption() {
        let original_data = "test mnemonic phrase";
        let password = "secure_password123";

        let encrypted = encrypt_mnemonic(original_data, password).unwrap();
        let decrypted = decrypt_mnemonic(&encrypted, password).unwrap();

        assert_eq!(original_data, decrypted);
    }
}
```

### Integration Testing

#### API Testing

```typescript
// Test wallet creation flow
describe("Wallet API Integration", () => {
  test("complete wallet creation flow", async () => {
    // 1. Create wallet
    const createResponse = await api.post("/wallet/create", {
      password: "test_password",
    });
    expect(createResponse.data.mnemonic).toBeDefined();

    // 2. Unlock wallet
    const unlockResponse = await api.post("/wallet/unlock", {
      password: "test_password",
    });
    expect(unlockResponse.data.success).toBe(true);

    // 3. Derive accounts
    const accountsResponse = await api.get("/accounts");
    expect(accountsResponse.data.accounts).toHaveLength(1);
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

### End-to-End Testing

#### User Flow Testing (Playwright)

```typescript
// Test complete user workflows
test("complete wallet setup and transaction flow", async ({ page }) => {
  // 1. Navigate to app
  await page.goto("http://localhost:3000");

  // 2. Create new wallet
  await page.click('[data-testid="create-wallet-btn"]');
  await page.fill('[data-testid="password-input"]', "secure_password123");
  await page.click('[data-testid="create-btn"]');

  // 3. Backup mnemonic
  const mnemonic = await page.textContent('[data-testid="mnemonic-display"]');
  await page.click('[data-testid="backup-confirmed-btn"]');

  // 4. Send transaction
  await page.click('[data-testid="send-btn"]');
  await page.fill('[data-testid="recipient-input"]', "test_address");
  await page.fill('[data-testid="amount-input"]', "0.001");
  await page.click('[data-testid="send-transaction-btn"]');

  // 5. Verify transaction in history
  await page.click('[data-testid="history-tab"]');
  await expect(
    page.locator('[data-testid="transaction-list"] >> nth=0')
  ).toBeVisible();
});
```

### Security Testing

#### Penetration Testing Checklist

- [ ] SQL injection testing on all endpoints
- [ ] Cross-site scripting (XSS) testing
- [ ] Cross-site request forgery (CSRF) testing
- [ ] Authentication bypass attempts
- [ ] Session management testing
- [ ] Input validation testing
- [ ] Rate limiting verification
- [ ] File upload security (if applicable)
- [ ] Error message information disclosure
- [ ] Cryptographic implementation testing

#### Automated Security Tools

- **Frontend**: ESLint security plugins, npm audit
- **Backend**: Cargo audit, clippy security lints
- **Dependencies**: Dependabot, Snyk scanning
- **Static Analysis**: SonarQube, CodeQL

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
- **Storage Model**: Encrypted mnemonics in client localStorage, metadata only in backend database
- **Security Flow**: Password → Argon2 → AES-256-GCM encryption → Local storage

**Trade-offs Considered**:

- **Complexity**: Increased frontend cryptographic complexity vs simplified backend
- **Recovery**: No backend-assisted recovery vs user-controlled backup responsibility
- **UX**: Password requirements vs convenience of custodial solutions
- **Support**: Users responsible for key management vs backend-assisted recovery

### 2. Web App vs Chrome Extension vs Mobile App

**Decision**: Start with Web Application
**Rationale**:

- **Development Focus**: Maximizes time spent on core wallet features vs platform APIs
- **Development Speed**: Fastest iteration and debugging
- **Rich UI**: No size constraints for educational interfaces
- **Easy Demo**: Simple deployment and sharing
- **Future Flexibility**: Can convert to extension later

**Trade-offs Considered**:

- Security: Web apps less trusted for real funds (acceptable for initial development)
- Integration: No dApp connection initially (can add later)
- Distribution: No app store requirements

### 2. Rust Backend vs Node.js/TypeScript

**Decision**: Rust Backend
**Rationale**:

- **Memory Safety**: Prevents buffer overflows and memory leaks in crypto operations
- **Performance**: Critical for cryptographic computations
- **Security**: Compiler prevents many classes of security vulnerabilities
- **Industry Standard**: Rust increasingly used for blockchain infrastructure
- **Ecosystem**: Rich crypto library ecosystem (bip39, secp256k1, ed25519-dalek)

**Trade-offs Considered**:

- Learning Curve: Rust more complex than TypeScript
- Development Speed: Initially slower (offset by safety benefits)
- Ecosystem: TypeScript has broader general ecosystem (Rust crypto ecosystem sufficient)

### 3. Viem vs Ethers.js for Ethereum

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

### 4. State Management: Zustand vs Redux

**Decision**: Zustand
**Rationale**:

- **Simplicity**: Less boilerplate for learning project
- **TypeScript**: Excellent TypeScript support out of the box
- **Bundle Size**: Significantly smaller than Redux
- **Developer Experience**: Simpler API and less boilerplate
- **Sufficient Features**: Meets all wallet state management needs

### 5. Monorepo vs Separate Repositories

**Decision**: Monorepo Structure
**Rationale**:

- **Simplified Development**: Single clone, coordinated changes
- **Shared Types**: Easy type sharing between frontend/backend
- **Unified Tooling**: Single CI/CD pipeline
- **Development Efficiency**: Easier to manage as single project

### 6. Database: SQLite vs PostgreSQL

**Decision**: SQLite for Development
**Rationale**:

- **Simplicity**: No separate database server needed
- **Portability**: Single file, easy backup and migration
- **Development Focus**: Minimal infrastructure overhead
- **Performance**: Sufficient for single-user wallet
- **Production Path**: Can migrate to PostgreSQL if needed

### 7. Authentication Strategy

**Decision**: Password-Based Key Derivation
**Rationale**:

- **Security**: User controls key derivation password
- **Simplicity**: No external auth providers needed
- **Standard Practice**: Common pattern in crypto wallets
- **Industry Standard**: Common pattern in crypto wallets

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

- **Bitcoin Support**: Native Bitcoin transactions
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

### Performance Optimizations

#### Frontend Optimizations

- **Code Splitting**: Route-based and component-based
- **Service Worker**: Offline capability and caching
- **Virtual Scrolling**: For large transaction lists
- **Memoization**: Expensive computation caching

#### Backend Optimizations

- **Connection Pooling**: Database and RPC connections
- **Caching Strategy**: Redis for frequently accessed data
- **Background Jobs**: Async transaction processing
- **Horizontal Scaling**: Load balancing for multiple instances

### Developer Experience

#### Tooling Improvements

- **Hot Reload**: Rust backend hot reload for development
- **Docker Compose**: Simplified local development setup
- **CLI Tools**: Wallet management command-line interface
- **Debug Dashboard**: Real-time system monitoring

#### Documentation

- **Interactive Tutorials**: Step-by-step crypto concept guides
- **API Documentation**: OpenAPI/Swagger integration
- **Video Walkthroughs**: Visual learning content
- **Community Guides**: User-contributed content

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

## Getting Started

### Prerequisites

- **Rust**: Latest stable version (rustup recommended)
- **Node.js**: Version 18+ with npm/yarn
- **Git**: Version control
- **Code Editor**: VS Code recommended with Rust and TypeScript extensions

### Initial Setup Commands

```bash
# Create project structure
mkdir crypto-wallet && cd crypto-wallet

# Initialize backend
cargo new --lib backend
cd backend && cargo add axum tokio serde bip39 bitcoin secp256k1

# Initialize frontend
cd .. && npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend && npm install viem @solana/web3.js zustand

# Set up development environment
# Add configuration files, Docker setup, etc.
```

### Development Workflow

1. **Start Backend**: `cargo run` in backend directory
2. **Start Frontend**: `npm run dev` in frontend directory
3. **Run Tests**: `cargo test` and `npm test`
4. **Check Security**: `cargo audit` and `npm audit`

---

_This design document serves as the comprehensive guide for building a multi-chain cryptocurrency wallet. It should be updated as the project evolves and new requirements emerge._
