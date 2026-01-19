# Backend Testing Guide

A comprehensive guide for testing the non-custodial cryptocurrency wallet backend API.

## Table of Contents

1. [Testing Setup](#testing-setup)
2. [Quick Start](#quick-start)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [Endpoint Testing](#endpoint-testing)
5. [Test Scenarios](#test-scenarios)
6. [Troubleshooting](#troubleshooting)

---

## Testing Setup

### Prerequisites

- **Rust**: Install via [rustup](https://rustup.rs/)
- **SQLite**: Included with most systems
- **curl**: For API testing (pre-installed on macOS/Linux)
- **jq** (optional): For pretty-printing JSON responses

```bash
# Verify installations
rustc --version
cargo --version
sqlite3 --version
curl --version
```

### Environment Configuration

1. **Navigate to backend directory:**
   ```bash
   cd /Users/daddy/Documents/iliad/crypto/crypto-wallet/backend
   ```

2. **Set environment variables:**
   ```bash
   export DATABASE_URL="sqlite://./data/wallet.db"
   export PORT=8080  # Optional, defaults to 8080
   ```

3. **Alternative: Create `.env` file:**
   ```bash
   echo 'DATABASE_URL="sqlite://./data/wallet.db"' > .env
   echo 'PORT=8080' >> .env
   ```

### Database Setup

The database initializes automatically on first run. To reset:

```bash
# Remove existing database
rm -rf data/wallet.db

# Database will be recreated on next server start
```

---

## Quick Start

### Start the Server

```bash
# From backend directory
cd /Users/daddy/Documents/iliad/crypto/crypto-wallet/backend

# Option 1: With environment variable
DATABASE_URL="sqlite://./data/wallet.db" cargo run

# Option 2: With .env file configured
cargo run
```

**Expected output:**
```
INFO crypto_wallet_backend::api::server: Starting crypto wallet server...
INFO crypto_wallet_backend::api::server: Initializing database...
INFO crypto_wallet_backend::api::server: Database initialized successfully
INFO crypto_wallet_backend::api::server: Server listening on http://127.0.0.1:8080
```

### Verify Server is Running

```bash
curl http://localhost:8080/health
```

**Expected response:**
```
OK
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Root endpoint - API version |
| GET | `/health` | Health check |
| GET | `/wallets` | List all wallets |
| POST | `/wallet/create` | Create new wallet metadata |
| POST | `/wallet/import` | Import wallet metadata |
| PUT | `/wallet/{id}` | Update wallet name |
| DELETE | `/wallet/{id}` | Delete wallet |
| POST | `/wallet/{id}/addresses` | Register address for monitoring |
| GET | `/wallet/{id}/balance` | Get wallet balances |
| GET | `/wallet/{id}/transactions` | Get transaction history |
| POST | `/wallet/{id}/broadcast` | Broadcast signed transaction |

---

## Endpoint Testing

### 1. Health Check

**Purpose:** Verify server and database connectivity.

```bash
curl http://localhost:8080/health
```

**Expected Response:**
```
OK
```

---

### 2. Root Endpoint

**Purpose:** Get API version information.

```bash
curl http://localhost:8080/
```

**Expected Response:**
```
Crypto Wallet API v1.0
```

---

### 3. Create Wallet

**Purpose:** Create new wallet metadata (no sensitive data).

```bash
curl -X POST "http://localhost:8080/wallet/create" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Test Wallet"}'
```

**Expected Response:**
```json
{
  "wallet_id": "uuid-generated-here",
  "name": "My Test Wallet",
  "created_at": "2026-01-19T00:00:00+00:00",
  "message": "Wallet metadata created. Generate mnemonic on frontend."
}
```

**Save the `wallet_id` for subsequent tests:**
```bash
# Store wallet_id in variable
WALLET_ID=$(curl -s -X POST "http://localhost:8080/wallet/create" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Wallet"}' | jq -r '.wallet_id')

echo "Created wallet: $WALLET_ID"
```

---

### 4. Import Wallet

**Purpose:** Import existing wallet metadata.

```bash
curl -X POST "http://localhost:8080/wallet/import" \
  -H "Content-Type: application/json" \
  -d '{"name": "Imported Wallet"}'
```

**Expected Response:**
```json
{
  "wallet_id": "uuid-generated-here",
  "name": "Imported Wallet",
  "created_at": "2026-01-19T00:00:00+00:00",
  "message": "Wallet metadata created. Import and encrypt mnemonic on frontend."
}
```

---

### 5. List All Wallets

**Purpose:** Retrieve all wallet metadata.

```bash
curl http://localhost:8080/wallets
```

**Expected Response:**
```json
[
  {
    "wallet_id": "uuid-1",
    "name": "My Test Wallet",
    "created_at": "2026-01-19T00:00:00+00:00",
    "message": "Wallet metadata retrieved."
  },
  {
    "wallet_id": "uuid-2",
    "name": "Imported Wallet",
    "created_at": "2026-01-19T00:00:00+00:00",
    "message": "Wallet metadata retrieved."
  }
]
```

**Pretty print with jq:**
```bash
curl -s http://localhost:8080/wallets | jq
```

---

### 6. Update Wallet Name

**Purpose:** Update an existing wallet's name.

```bash
# Replace {wallet_id} with actual ID
curl -X PUT "http://localhost:8080/wallet/{wallet_id}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Wallet Name"}'
```

**Expected Response:**
```json
{
  "wallet_id": "uuid-here",
  "name": "Updated Wallet Name",
  "created_at": "2026-01-19T00:00:00+00:00",
  "message": "Wallet updated successfully."
}
```

**Error Response (wallet not found):**
```
HTTP 404 Not Found
```

---

### 7. Delete Wallet

**Purpose:** Delete wallet and all associated addresses (CASCADE).

```bash
# Replace {wallet_id} with actual ID
curl -X DELETE "http://localhost:8080/wallet/{wallet_id}"
```

**Expected Response:**
```json
{
  "wallet_id": "uuid-here",
  "message": "Wallet deleted successfully.",
  "deleted": true
}
```

**Error Response (wallet not found):**
```
HTTP 404 Not Found
```

---

### 8. Register Address

**Purpose:** Register a derived address for blockchain monitoring.

```bash
# Replace {wallet_id} with actual ID
curl -X POST "http://localhost:8080/wallet/{wallet_id}/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
    "chain": "ethereum",
    "derivation_path": "m/44'"'"'/60'"'"'/0'"'"'/0/0"
  }'
```

**Expected Response:**
```json
{
  "id": 1,
  "wallet_id": "uuid-here",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
  "chain": "ethereum",
  "derivation_path": "m/44'/60'/0'/0/0",
  "created_at": "2026-01-19T00:00:00+00:00",
  "message": "Address registered successfully."
}
```

**Supported Chains:**
- `ethereum`
- `bitcoin`
- `solana`

**Validation Errors:**
- Empty address: `400 Bad Request`
- Unsupported chain: `400 Bad Request`
- Invalid derivation path: `400 Bad Request`
- Wallet not found: `404 Not Found`

---

### 9. Get Wallet Balance

**Purpose:** Get balances for all registered addresses (mock data).

```bash
# Replace {wallet_id} with actual ID
curl "http://localhost:8080/wallet/{wallet_id}/balance"
```

**Expected Response:**
```json
{
  "wallet_id": "uuid-here",
  "balances": [
    {
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
      "chain": "ethereum",
      "balance": "1.234567890000000000",
      "symbol": "ETH",
      "timestamp": "2026-01-19T00:00:00+00:00"
    }
  ]
}
```

**Note:** Currently returns mock data. Will integrate with blockchain APIs in future phases.

---

### 10. Get Transaction History

**Purpose:** Get transaction history for wallet (mock data).

```bash
# Replace {wallet_id} with actual ID
curl "http://localhost:8080/wallet/{wallet_id}/transactions"
```

**Expected Response:**
```json
{
  "wallet_id": "uuid-here",
  "transactions": [
    {
      "hash": "0xabc123...",
      "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
      "to": "0x123456...",
      "amount": "0.5",
      "chain": "ethereum",
      "symbol": "ETH",
      "status": "confirmed",
      "timestamp": "2026-01-19T00:00:00+00:00",
      "block_number": "12345678"
    }
  ]
}
```

**Note:** Currently returns mock data. Will integrate with blockchain APIs in future phases.

---

### 11. Broadcast Transaction

**Purpose:** Broadcast a signed transaction to the blockchain.

```bash
# Replace {wallet_id} with actual ID
curl -X POST "http://localhost:8080/wallet/{wallet_id}/broadcast" \
  -H "Content-Type: application/json" \
  -d '{
    "signed_tx": "0xf86c0a8502540be400825208...",
    "chain": "ethereum"
  }'
```

**Expected Response (Success):**
```json
{
  "tx_hash": "0xmock_tx_hash_abc123...",
  "chain": "ethereum",
  "status": "pending",
  "message": "Transaction broadcast successfully (mock)"
}
```

**Error Response (Invalid chain):**
```json
{
  "tx_hash": "",
  "chain": "invalid_chain",
  "status": "failed",
  "message": "Unsupported chain: invalid_chain"
}
```

**Supported Chains:**
- `ethereum`
- `bitcoin`
- `solana`

---

## Test Scenarios

### Complete Wallet Lifecycle Test

Run this script to test the full workflow:

```bash
#!/bin/bash
# Save as: test_wallet_lifecycle.sh

BASE_URL="http://localhost:8080"

echo "=== 1. Health Check ==="
curl -s "$BASE_URL/health"
echo -e "\n"

echo "=== 2. Create Wallet ==="
WALLET_RESPONSE=$(curl -s -X POST "$BASE_URL/wallet/create" \
  -H "Content-Type: application/json" \
  -d '{"name": "Lifecycle Test Wallet"}')
echo "$WALLET_RESPONSE" | jq
WALLET_ID=$(echo "$WALLET_RESPONSE" | jq -r '.wallet_id')
echo "Wallet ID: $WALLET_ID"
echo ""

echo "=== 3. List Wallets ==="
curl -s "$BASE_URL/wallets" | jq
echo ""

echo "=== 4. Update Wallet Name ==="
curl -s -X PUT "$BASE_URL/wallet/$WALLET_ID" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Test Wallet"}' | jq
echo ""

echo "=== 5. Register Ethereum Address ==="
curl -s -X POST "$BASE_URL/wallet/$WALLET_ID/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
    "chain": "ethereum",
    "derivation_path": "m/44'"'"'/60'"'"'/0'"'"'/0/0"
  }' | jq
echo ""

echo "=== 6. Register Bitcoin Address ==="
curl -s -X POST "$BASE_URL/wallet/$WALLET_ID/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "chain": "bitcoin",
    "derivation_path": "m/44'"'"'/0'"'"'/0'"'"'/0/0"
  }' | jq
echo ""

echo "=== 7. Get Wallet Balance ==="
curl -s "$BASE_URL/wallet/$WALLET_ID/balance" | jq
echo ""

echo "=== 8. Get Transaction History ==="
curl -s "$BASE_URL/wallet/$WALLET_ID/transactions" | jq
echo ""

echo "=== 9. Broadcast Transaction ==="
curl -s -X POST "$BASE_URL/wallet/$WALLET_ID/broadcast" \
  -H "Content-Type: application/json" \
  -d '{
    "signed_tx": "0xf86c0a8502540be40082520894...",
    "chain": "ethereum"
  }' | jq
echo ""

echo "=== 10. Delete Wallet ==="
curl -s -X DELETE "$BASE_URL/wallet/$WALLET_ID" | jq
echo ""

echo "=== 11. Verify Deletion ==="
curl -s "$BASE_URL/wallets" | jq
echo ""

echo "=== Test Complete ==="
```

**Run the script:**
```bash
chmod +x test_wallet_lifecycle.sh
./test_wallet_lifecycle.sh
```

---

### Error Handling Tests

```bash
# Test: Create wallet with empty name
curl -X POST "http://localhost:8080/wallet/create" \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'
# Expected: 400 Bad Request

# Test: Get non-existent wallet
curl "http://localhost:8080/wallet/non-existent-id/balance"
# Expected: 404 Not Found

# Test: Register address with unsupported chain
curl -X POST "http://localhost:8080/wallet/{wallet_id}/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x123...",
    "chain": "dogecoin",
    "derivation_path": "m/44'"'"'/3'"'"'/0'"'"'/0/0"
  }'
# Expected: 400 Bad Request with error message

# Test: Broadcast with invalid chain
curl -X POST "http://localhost:8080/wallet/{wallet_id}/broadcast" \
  -H "Content-Type: application/json" \
  -d '{
    "signed_tx": "0xabc...",
    "chain": "invalid"
  }'
# Expected: Response with status "failed"
```

---

## Troubleshooting

### Common Issues

#### 1. "Address already in use" Error

**Problem:**
```
Application error: Failed to bind to 127.0.0.1:8080. Is the port already in use?
```

**Solutions:**
```bash
# Option A: Kill existing process
pkill -f "crypto-wallet-backend"

# Option B: Use different port
PORT=8081 cargo run

# Option C: Find and kill process on port
lsof -i :8080
kill -9 <PID>
```

#### 2. DATABASE_URL Not Set

**Problem:**
```
error: set `DATABASE_URL` to use query macros online
```

**Solution:**
```bash
# Set environment variable
export DATABASE_URL="sqlite://./data/wallet.db"

# Or create .env file
echo 'DATABASE_URL="sqlite://./data/wallet.db"' > .env
```

#### 3. Database File Not Found

**Problem:**
```
Failed to initialize database
```

**Solution:**
```bash
# Create data directory
mkdir -p data

# Database will be auto-created on next run
cargo run
```

#### 4. Compilation Errors After Cleanup

**Problem:** Build fails after removing crypto modules.

**Solution:**
```bash
# Clean build artifacts
cargo clean

# Rebuild
DATABASE_URL="sqlite://./data/wallet.db" cargo build
```

#### 5. SQLx Offline Mode

**Problem:** Need to compile without database connection.

**Solution:**
```bash
# Generate query cache
cargo sqlx prepare

# Build in offline mode
SQLX_OFFLINE=true cargo build
```

### Server Logs

Enable detailed logging:
```bash
RUST_LOG=debug DATABASE_URL="sqlite://./data/wallet.db" cargo run
```

Log levels:
- `error` - Only errors
- `warn` - Warnings and errors
- `info` - General information (default)
- `debug` - Detailed debugging
- `trace` - Very detailed tracing

---

## Quick Reference

### Start Server
```bash
cd /Users/daddy/Documents/iliad/crypto/crypto-wallet/backend
DATABASE_URL="sqlite://./data/wallet.db" cargo run
```

### Test All Endpoints
```bash
# Health
curl localhost:8080/health

# Create wallet
curl -X POST localhost:8080/wallet/create -H "Content-Type: application/json" -d '{"name":"Test"}'

# List wallets
curl localhost:8080/wallets

# Get balance (replace ID)
curl localhost:8080/wallet/{id}/balance

# Get transactions (replace ID)
curl localhost:8080/wallet/{id}/transactions
```

### Stop Server
```bash
# Ctrl+C in terminal, or:
pkill -f "crypto-wallet-backend"
```

---

*Last updated: January 2026*
*Backend Version: Non-custodial architecture (Phase 1 Week 2)*
