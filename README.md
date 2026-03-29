# Multi-Chain Cryptocurrency Wallet

A secure, non-custodial multi-chain cryptocurrency wallet built with a Go (Chi) backend and Next.js frontend. Supports Ethereum, Bitcoin, and Solana with industry-standard security practices.

## Features

- **HD Wallet Support** - BIP39/BIP32/BIP44 compliant hierarchical deterministic wallets
- **Multi-Chain** - Support for Bitcoin, Ethereum (EVM), and Solana
- **Non-Custodial** - Private keys never leave your device; all encryption happens client-side
- **Secure Storage** - AES-256-GCM encryption with Argon2 key derivation
- **Multi-Account** - Derive unlimited accounts from a single mnemonic
- **Modern Stack** - Go backend for simplicity and fast iteration, Next.js 16 + React 19 frontend

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
│                               │                                 │
│              Encrypted Wallets (IndexedDB)                      │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTP API (Metadata Only)
┌───────────────────────────────┼─────────────────────────────────┐
│                         BACKEND (Go/Chi)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ REST API        │  │ Services        │  │ Database        │  │
│  │ - /wallets      │  │ - Balance Check │  │ - SQLite        │  │
│  │ - /addresses    │  │ - TX History    │  │ - Wallet Meta   │  │
│  │ - /health       │  │ - Gas Estimate  │  │ - Addresses     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ⚠️  NO Private Keys  │  ⚠️  NO Mnemonics  │  ⚠️  NO Passwords  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Model

This wallet follows a **true non-custodial architecture**:

| Component              | Frontend (Client) | Backend (Server) |
| ---------------------- | ----------------- | ---------------- |
| Mnemonic Generation    | ✅                | ❌               |
| Private Key Derivation | ✅                | ❌               |
| Transaction Signing    | ✅                | ❌               |
| Encryption/Decryption  | ✅                | ❌               |
| Wallet Metadata        | ✅                | ✅               |
| Address Registration   | ✅                | ✅               |
| Balance Queries        | ❌                | ✅               |
| TX Broadcasting        | ❌                | ✅               |

**Key Security Features:**

- Argon2id key derivation (64MB memory, 3 iterations)
- AES-256-GCM authenticated encryption
- Unique salt and nonce per wallet
- Memory zeroing after sensitive operations
- No sensitive data in logs or error messages

## Tech Stack

### Backend (Go)

| Category  | Technology              |
| --------- | ----------------------- |
| Framework | Chi 5 (HTTP router)     |
| Database  | SQLite (modernc.org)    |
| Logging   | slog (structured)       |

> **Note:** Backend handles metadata only. All cryptographic operations (mnemonic, encryption, signing) are performed client-side.

### Frontend (TypeScript)

| Category  | Technology                                      |
| --------- | ----------------------------------------------- |
| Framework | Next.js 16 (App Router)                         |
| UI        | React 19 + Tailwind CSS 4                       |
| State     | Zustand 5                                       |
| Ethereum  | Viem 2.40                                       |
| Solana    | @solana/web3.js 1.98                            |
| Crypto    | @noble/secp256k1, @noble/ed25519, @noble/hashes |

## Getting Started

### Prerequisites

- Go 1.23+ ([go.dev](https://go.dev/dl/))
- Node.js 18+ ([nodejs.org](https://nodejs.org/))
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd crypto-wallet

# Backend setup
cd backend
go build ./cmd/server

# Frontend setup
cd ../frontend
npm install
```

### Running the Application

**Start the backend:**

```bash
cd backend
go run ./cmd/server
# Server starts on http://localhost:8080
```

**Start the frontend:**

```bash
cd frontend
npm run dev
# App available at http://localhost:3000
```

### Environment Variables

**Backend**:

```bash
DATABASE_URL="sqlite://./data/wallet.db"  # SQLite database path (default)
PORT=8080                                  # Server port (default: 8080)
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
GET    /wallet/{id}/balance        # Get wallet balances
GET    /wallet/{id}/transactions   # Get transaction history
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

| Chain    | Curve     | Derivation Path        | Status |
| -------- | --------- | ---------------------- | ------ |
| Bitcoin  | secp256k1 | m/44'/0'/account'/0/0  | ✅     |
| Ethereum | secp256k1 | m/44'/60'/account'/0/0 | ✅     |
| Solana   | Ed25519   | m/44'/501'/account'/0' | ✅     |

## Project Structure

```
crypto-wallet/
├── backend/                 # Go backend (metadata only)
│   ├── cmd/server/main.go      # Entry point
│   ├── internal/
│   │   ├── api/                # REST endpoints
│   │   │   ├── handlers.go    # Request handlers
│   │   │   ├── middleware.go  # CORS, security headers, auth
│   │   │   ├── server.go     # Chi router config
│   │   │   └── types.go      # Request/response types
│   │   └── database/          # SQLite persistence
│   │       ├── connection.go  # Database pool
│   │       ├── migration.go   # Schema migrations
│   │       ├── models.go      # Data models
│   │       ├── wallet.go      # Wallet CRUD
│   │       └── wallet_address.go # Address CRUD
│   ├── go.mod
│   └── go.sum
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/               # Next.js pages
│   │   ├── components/        # React components
│   │   └── lib/
│   │       ├── api/          # HTTP client, wallet API functions
│   │       ├── crypto/       # Mnemonic, HD wallet, encryption, secure memory
│   │       ├── storage/      # IndexedDB, session manager, wallet service
│   │       ├── stores/       # Zustand state management
│   │       └── types/        # TypeScript type definitions
│   ├── package.json
│   └── public/
├── documentations/             # Project documentation
│   ├── Crypto-Wallet-Design-Doc.md
│   ├── implementation-logs/   # Task implementation logs
│   └── testing/               # Testing guides
└── README.md
```

## Development

### Running Tests

```bash
# Backend tests (44 tests)
cd backend && go test ./...

# Frontend tests (Vitest, ~278 tests)
cd frontend && npm run test:run

# Frontend — specific file
cd frontend && npx vitest run src/lib/crypto/__tests__/mnemonic.test.ts
```

### Security Auditing

```bash
# Audit npm dependencies
cd frontend
npm audit
```

### Building for Production

```bash
# Backend
cd backend
go build -o server ./cmd/server

# Frontend
cd frontend
npm run build
```

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
- [Chi](https://github.com/go-chi/chi) - Go HTTP router

---

**Disclaimer:** This wallet is for educational and development purposes. Use at your own risk. Always test with testnets before using real funds.
