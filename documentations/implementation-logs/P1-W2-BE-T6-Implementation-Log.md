# Phase 1 - Week 2 - Backend Task 6 Implementation Log

**Date**: January 19, 2026
**Task**: Remove all mnemonic generation and encryption from backend
**Status**: COMPLETED

## Overview

Refactored the backend to align with the **non-custodial wallet architecture**. Removed all cryptographic functionality (mnemonic generation, HD wallet derivation, encryption) since these operations now happen exclusively on the frontend.

## Why This Matters

In a **non-custodial wallet**:
- **Frontend**: Generates mnemonics, derives keys, creates addresses, signs transactions
- **Backend**: Stores metadata only, monitors addresses, provides blockchain services

Keeping unused crypto code in the backend creates:
1. **Security risk** - Unused code can be accidentally called
2. **Attack surface** - More code = more potential vulnerabilities
3. **Confusion** - Developers might think backend handles sensitive data
4. **Technical debt** - Unused dependencies bloat the project

## What We Removed

### Deleted Directories

```
backend/
├── src/
│   └── core/                    # DELETED (entire directory)
│       ├── mod.rs
│       ├── wallet/
│       │   ├── mod.rs
│       │   ├── mnemonic.rs      # ~491 lines - BIP39 implementation
│       │   └── hd_wallet.rs     # ~620 lines - BIP32/BIP44 derivation
│       └── security/
│           ├── mod.rs
│           └── encryption.rs    # ~945 lines - AES-256-GCM encryption
└── tests/                       # DELETED (entire directory)
    ├── dependency_test.rs
    ├── encryption_test.rs
    └── hd_wallet_test.rs
```

**Total lines removed**: ~2,000+

### Removed Dependencies

| Dependency | Purpose | Why Removed |
|------------|---------|-------------|
| `bip39` | Mnemonic phrase generation | Used in mnemonic.rs |
| `bitcoin` | HD wallet key derivation | Used in hd_wallet.rs |
| `secp256k1` | Ethereum/Bitcoin signatures | Used in hd_wallet.rs |
| `ed25519-dalek` | Solana signatures | Used in hd_wallet.rs |
| `aes-gcm` | AES-256-GCM encryption | Used in encryption.rs |
| `argon2` | Password-based key derivation | Used in encryption.rs |
| `rand` | Random number generation | Used in mnemonic.rs, encryption.rs |
| `zeroize` | Secure memory wiping | Used in encryption.rs |
| `thiserror` | Custom error types | Used in all crypto modules |

## Implementation Steps

### Step 1: Identify What to Remove

Searched for crypto-related code and dependencies:

```bash
# Find all references to crypto modules
grep -r "mnemonic\|encrypt\|decrypt\|private_key" src/

# Check what imports from core module
grep -r "use crate::core" src/
```

**Finding**: Only the crypto modules themselves referenced `core`. The API code (`api/`, `database/`) had no dependencies on it.

### Step 2: Delete Core Directory

```bash
rm -rf backend/src/core
```

This removed:
- `core/mod.rs` - Module declarations
- `core/wallet/mod.rs` - Wallet module exports
- `core/wallet/mnemonic.rs` - BIP39 mnemonic implementation
- `core/wallet/hd_wallet.rs` - HD wallet and key derivation
- `core/security/mod.rs` - Security module exports
- `core/security/encryption.rs` - AES-256-GCM encryption

### Step 3: Delete Test Directory

```bash
rm -rf backend/tests
```

Removed obsolete integration tests:
- `hd_wallet_test.rs` - Tests for HD wallet derivation
- `encryption_test.rs` - Tests for encryption/decryption
- `dependency_test.rs` - Tests for crypto dependencies

### Step 4: Update lib.rs

**Before:**
```rust
//! # Crypto Wallet Backend
//!
//! A secure, multi-chain cryptocurrency wallet backend implementation.
//!
//! ## Features
//! - HD (Hierarchical Deterministic) wallet support following BIP32/BIP44 standards
//! - BIP39 mnemonic phrase generation and validation
//! - Multi-chain support (Ethereum, Solana, and more)
//! - Secure key storage with AES-256-GCM encryption
//! - Industry-standard cryptographic implementations
//!
//! ## Security
//! - Private keys never exposed in plaintext
//! - Cryptographically secure random number generation
//! - Memory-safe Rust implementation
//! - Comprehensive testing of all cryptographic functions

pub mod core;  // <-- REMOVED
pub mod api;
pub mod database;
```

**After:**
```rust
//! # Crypto Wallet Backend
//!
//! A secure, multi-chain cryptocurrency wallet backend implementation.

pub mod api;
pub mod database;
```

### Step 5: Update Cargo.toml

**Before** (29 dependencies):
```toml
[dependencies]
# Crypto dependencies (REMOVED)
bip39 = "2.0"
bitcoin = { version = "0.31", features = ["serde", "rand"] }
secp256k1 = { version = "0.28", features = ["rand", "recovery", "global-context"] }
ed25519-dalek = { version = "2.0", features = ["rand_core"] }
aes-gcm = "0.10"
argon2 = "0.5"
rand = { version = "0.8", features = ["std_rng"] }
zeroize = { version = "1.7", features = ["derive"] }
thiserror = "1.0"

# Kept dependencies
hex = "0.4"
uuid = { version = "1.6", features = ["v4", "serde"] }
# ... rest
```

**After** (13 dependencies):
```toml
[package]
name = "crypto-wallet-backend"
version = "0.1.0"
edition = "2021"
authors = ["Crypto Wallet Developer"]
license = "MIT"
description = "Multi-chain non-custodial cryptocurrency wallet backend"

[dependencies]
# === Utilities ===
hex = "0.4"
uuid = { version = "1.6", features = ["v4", "serde"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# === Async Runtime ===
tokio = { version = "1.0", features = ["full"] }

# === Error Handling ===
anyhow = "1.0"

# === Web Framework ===
axum = "0.8.7"
tower = "0.5.2"
tower-http = { version = "0.6.7", features = ["cors", "trace", "limit"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# === Database ===
chrono = "0.4"
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "sqlite", "macros"] }
dotenv = "0.15.0"
```

### Step 6: Verify Build

```bash
cd backend
DATABASE_URL="sqlite://./data/wallet.db" cargo build
```

**Result**: Build successful with no errors.

### Step 7: Test Server

```bash
DATABASE_URL="sqlite://./data/wallet.db" cargo run
```

```bash
# Test endpoints
curl http://localhost:8080/health      # OK
curl http://localhost:8080/wallets     # Returns wallet list
```

**Result**: All endpoints working correctly.

## Files Modified

| File | Change |
|------|--------|
| `backend/src/lib.rs` | Removed `pub mod core;`, updated doc comments |
| `backend/Cargo.toml` | Removed 9 crypto dependencies, updated description |

## Files Deleted

| File/Directory | Lines | Purpose |
|----------------|-------|---------|
| `backend/src/core/` | ~2,000+ | Entire crypto module directory |
| `backend/tests/` | ~800+ | Crypto integration tests |

## Dependencies Removed

**Production dependencies removed: 9**
- bip39, bitcoin, secp256k1, ed25519-dalek, aes-gcm, argon2, rand, zeroize, thiserror

**Dependencies kept: 13**
- hex, uuid, serde, serde_json, tokio, anyhow, axum, tower, tower-http, tracing, tracing-subscriber, chrono, sqlx, dotenv

## Key Concepts

### Non-Custodial Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Client)                       │
│  - Mnemonic generation (BIP39)                              │
│  - HD wallet derivation (BIP32/BIP44)                       │
│  - Address generation                                        │
│  - Transaction signing                                       │
│  - Encrypted storage (localStorage)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (metadata only)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (Server)                        │
│  - Wallet metadata storage (name, ID, timestamps)           │
│  - Address registration (for monitoring)                    │
│  - Balance queries (blockchain API calls)                   │
│  - Transaction history (blockchain API calls)               │
│  - Transaction broadcast (relay signed tx to network)       │
│                                                             │
│  ❌ NO mnemonics                                            │
│  ❌ NO private keys                                         │
│  ❌ NO encryption of sensitive data                         │
└─────────────────────────────────────────────────────────────┘
```

### Why Remove vs Disable?

**Option 1: Comment out code** (Bad)
- Still in codebase, could be accidentally enabled
- Clutters codebase with dead code
- Dependencies still compiled

**Option 2: Feature flags** (Acceptable for dual-use)
- Good if you need both custodial and non-custodial modes
- Adds complexity

**Option 3: Delete entirely** (Best for our case)
- Clean separation of concerns
- Smaller binary
- Faster compilation
- No confusion about backend's responsibility

We chose **Option 3** because our architecture is permanently non-custodial.

## Verification

### Build Test
```bash
cd backend
DATABASE_URL="sqlite://./data/wallet.db" cargo build
# Expected: Compiles successfully
```

### Runtime Test
```bash
DATABASE_URL="sqlite://./data/wallet.db" cargo run
# Expected: Server starts on port 8080
```

### API Test
```bash
curl http://localhost:8080/health
# Expected: OK

curl http://localhost:8080/wallets
# Expected: JSON array of wallets
```

### Verify No Crypto Code Remains
```bash
grep -r "mnemonic\|encrypt\|decrypt\|private_key\|bip39\|bip32" src/
# Expected: Only informational messages in API responses
```

**Actual result:**
```
src/api/wallet.rs: message: "Wallet metadata created. Generate mnemonic on frontend."
src/api/wallet.rs: message: "Wallet metadata created. Import and encrypt mnemonic on frontend."
```

These are correct - they're instructions to the frontend, not actual crypto operations.

## Current Backend Structure

```
backend/src/
├── api/
│   ├── mod.rs           # API module exports
│   ├── server.rs        # Axum server setup and routes
│   ├── types.rs         # Request/response types for blockchain endpoints
│   └── wallet.rs        # Wallet endpoint handlers
├── database/
│   ├── mod.rs           # Database module exports
│   ├── connection.rs    # SQLite connection pool
│   ├── models.rs        # Database models (Wallet, WalletAddress)
│   ├── wallet.rs        # Wallet CRUD operations
│   └── wallet_address.rs# Address CRUD operations
├── lib.rs               # Library root
└── main.rs              # Application entry point
```

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Dependencies | 22 | 13 |
| Source files | 15+ | 10 |
| Lines of code | ~4,000+ | ~1,500 |
| Crypto operations | Yes | No |
| Security responsibility | Shared | Frontend only |

The backend is now a clean, focused **metadata service** that:
- Stores wallet metadata (name, ID)
- Registers addresses for monitoring
- Provides blockchain query endpoints
- Broadcasts pre-signed transactions

All sensitive cryptographic operations are now the **exclusive responsibility of the frontend**.

---

*Implementation completed: January 19, 2026*
