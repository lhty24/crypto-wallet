# Multi-Chain Cryptocurrency Wallet

A secure, non-custodial multi-chain cryptocurrency wallet built with Rust (Axum) backend and Next.js frontend. Supports Ethereum, Bitcoin, and Solana with industry-standard security practices.

## Features

- **HD Wallet Support** - BIP39/BIP32/BIP44 compliant hierarchical deterministic wallets
- **Multi-Chain** - Support for Bitcoin, Ethereum (EVM), and Solana
- **Non-Custodial** - Private keys never leave your device; all encryption happens client-side
- **Secure Storage** - AES-256-GCM encryption with Argon2 key derivation
- **Multi-Account** - Derive unlimited accounts from a single mnemonic
- **Modern Stack** - Rust backend for memory safety, Next.js 16 + React 19 frontend

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Crypto Engine   │  │ State (Zustand) │  │ UI Components   │  │
│  │ - BIP39 Gen     │  │ - Wallet State  │  │ - Dashboard     │  │
│  │ - AES Encrypt   │  │ - Chain Config  │  │ - Send/Receive  │  │
│  │ - HD Derivation │  │ - Balances      │  │ - History       │  │
│  │ - TX Signing    │  │ - Transactions  │  │ - Settings      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                               │                                  │
│              Encrypted Wallets (localStorage)                   │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTP API (Metadata Only)
┌───────────────────────────────┼─────────────────────────────────┐
│                        BACKEND (Rust/Axum)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ REST API        │  │ Services        │  │ Database        │  │
│  │ - /wallets      │  │ - Balance Check │  │ - SQLite        │  │
│  │ - /addresses    │  │ - TX Broadcast  │  │ - Wallet Meta   │  │
│  │ - /health       │  │ - Gas Estimate  │  │ - Addresses     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│  ⚠️  NO Private Keys  │  ⚠️  NO Mnemonics  │  ⚠️  NO Passwords  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Model

This wallet follows a **true non-custodial architecture**:

| Component | Frontend (Client) | Backend (Server) |
|-----------|-------------------|------------------|
| Mnemonic Generation | ✅ | ❌ |
| Private Key Derivation | ✅ | ❌ |
| Transaction Signing | ✅ | ❌ |
| Encryption/Decryption | ✅ | ❌ |
| Wallet Metadata | ✅ | ✅ |
| Address Registration | ✅ | ✅ |
| Balance Queries | ❌ | ✅ |
| TX Broadcasting | ❌ | ✅ |

**Key Security Features:**
- Argon2id key derivation (64MB memory, 3 iterations)
- AES-256-GCM authenticated encryption
- Unique salt and nonce per wallet
- Memory zeroing after sensitive operations
- No sensitive data in logs or error messages

## Tech Stack

### Backend (Rust)
| Category | Technology |
|----------|------------|
| Framework | Axum 0.8 |
| Runtime | Tokio (async) |
| Database | SQLite + sqlx |
| Crypto | bip39, bitcoin, secp256k1, ed25519-dalek, aes-gcm, argon2 |
| Logging | tracing + tracing-subscriber |

### Frontend (TypeScript)
| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| State | Zustand 5 |
| Ethereum | Viem 2.40 |
| Solana | @solana/web3.js 1.98 |
| Crypto | @noble/secp256k1, @noble/ed25519, @noble/hashes |

## Getting Started

### Prerequisites

- Rust 1.70+ ([rustup](https://rustup.rs/))
- Node.js 18+ ([nodejs.org](https://nodejs.org/))
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd crypto-wallet

# Backend setup
cd backend
cargo build

# Frontend setup
cd ../frontend
npm install
```

### Running the Application

**Start the backend:**
```bash
cd backend
cargo run
# Server starts on http://localhost:8080
```

**Start the frontend:**
```bash
cd frontend
npm run dev
# App available at http://localhost:3000
```

### Environment Variables

**Backend** (optional):
```bash
DATABASE_URL=sqlite:wallet.db   # SQLite database path (default: wallet.db)
PORT=8080                        # Server port (default: 8080)
```

**Frontend**:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080  # Backend API URL
```

## API Reference

### Health Check
```
GET /health
Response: { "status": "healthy", "database": "connected" }
```

### Wallet Management
```
GET    /wallets                    # List all wallets
POST   /wallet/create              # Create wallet metadata
POST   /wallet/import              # Import wallet metadata
PUT    /wallet/{id}                # Update wallet name
DELETE /wallet/{id}                # Delete wallet
POST   /wallet/{id}/addresses      # Register derived addresses
```

### Request/Response Examples

**Create Wallet:**
```bash
curl -X POST http://localhost:8080/wallet/create \
  -H "Content-Type: application/json" \
  -d '{"name": "My Wallet"}'
```

**Register Addresses:**
```bash
curl -X POST http://localhost:8080/wallet/{wallet_id}/addresses \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": [
      {
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f1a6cC",
        "chain": "ethereum",
        "derivation_path": "m/44'\''/60'\''/0'\''/0/0"
      }
    ]
  }'
```

## Blockchain Support

| Chain | Curve | Derivation Path | Status |
|-------|-------|-----------------|--------|
| Bitcoin | secp256k1 | m/44'/0'/account'/0/0 | ✅ |
| Ethereum | secp256k1 | m/44'/60'/account'/0/0 | ✅ |
| Solana | Ed25519 | m/44'/501'/account'/0' | ✅ |

## Project Structure

```
crypto-wallet/
├── backend/                    # Rust backend
│   ├── src/
│   │   ├── main.rs            # Entry point, server setup
│   │   ├── lib.rs             # Library exports
│   │   ├── api/               # REST endpoints
│   │   │   ├── mod.rs
│   │   │   └── wallet.rs      # Wallet CRUD endpoints
│   │   ├── core/              # Core cryptography
│   │   │   ├── mod.rs
│   │   │   ├── mnemonic.rs    # BIP39 implementation
│   │   │   ├── hd_wallet.rs   # BIP32/44 derivation
│   │   │   └── encryption.rs  # AES-256-GCM
│   │   └── database/          # SQLite persistence
│   │       ├── mod.rs
│   │       └── wallet_store.rs
│   ├── Cargo.toml
│   └── tests/
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/               # Next.js pages
│   │   ├── components/        # React components
│   │   └── lib/               # Utilities & state
│   ├── package.json
│   └── public/
├── Crypto-Wallet-Design-Doc.md # Detailed design document
└── README.md
```

## Development

### Running Tests

```bash
# Backend tests
cd backend
cargo test

# Frontend tests
cd frontend
npm test
```

### Security Auditing

```bash
# Audit Rust dependencies
cd backend
cargo audit

# Audit npm dependencies
cd frontend
npm audit
```

### Building for Production

```bash
# Backend
cd backend
cargo build --release

# Frontend
cd frontend
npm run build
```

## Roadmap

### Phase 1: Foundation (Current)
- [x] HD wallet generation (BIP39/BIP32/BIP44)
- [x] Multi-chain account derivation
- [x] Wallet metadata API
- [x] SQLite persistence
- [x] Address registration

### Phase 2: Basic Operations
- [ ] Balance checking (ETH, SOL)
- [ ] Transaction signing
- [ ] Gas estimation
- [ ] TX broadcasting

### Phase 3: Enhanced Features
- [ ] ERC-20 token support
- [ ] SPL token support
- [ ] Transaction history
- [ ] Real-time WebSocket updates

### Phase 4: Multi-Chain Expansion
- [ ] Layer 2 support (Polygon, Arbitrum, Optimism)
- [ ] Testnet support
- [ ] Cross-chain transactions

## Security Considerations

### For Developers
- Never log private keys or mnemonics
- Always use secure random number generation
- Clear sensitive data from memory after use
- Validate all user inputs
- Keep dependencies updated

### For Users
- **Backup your mnemonic phrase** - It's the only way to recover your wallet
- Use a strong password (12+ characters, mixed case, numbers, symbols)
- Never share your mnemonic or private keys
- Verify transaction details before signing
- Use testnets for development and testing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) - Mnemonic code standard
- [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) - HD wallet specification
- [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) - Multi-account hierarchy
- [Viem](https://viem.sh/) - Modern Ethereum library
- [Axum](https://github.com/tokio-rs/axum) - Rust web framework

---

**Disclaimer:** This wallet is for educational and development purposes. Use at your own risk. Always test with testnets before using real funds.
