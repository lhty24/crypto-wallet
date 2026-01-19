# Phase 1 - Week 2 - Backend Task 5 Implementation Log

**Date**: January 18, 2026
**Task**: Create foundation for blockchain service endpoints
**Status**: COMPLETED & TESTED

## Overview

Implemented the foundation for blockchain service endpoints in the non-custodial cryptocurrency wallet backend. These endpoints provide the API structure for balance checking, transaction history, and transaction broadcasting. Currently returns mock data with infrastructure ready for real blockchain RPC integration.

## What We Built

### API Endpoints
```
GET    /wallet/{id}/balance       - Get balances for all registered addresses
GET    /wallet/{id}/transactions  - Get transaction history for wallet
POST   /wallet/{id}/broadcast     - Broadcast signed transaction to network
```

### Key Features
- Balance endpoint returns mock "0.0" balance for each registered address
- Transaction history endpoint returns empty array (placeholder)
- Broadcast endpoint validates chain support and returns mock tx_hash
- Reusable `verify_wallet_exists` helper to reduce code duplication
- Chain-to-symbol conversion helper (`ethereum` -> `ETH`)

## Implementation Steps

### Component 1: Balance Checking Endpoint

**Step 1: Types** (`/backend/src/api/types.rs`)
```rust
#[derive(Debug, Clone, Serialize)]
pub struct AddressBalance {
    pub address: String,   // "0x..." or "bc1..."
    pub chain: String,     // "ethereum", "bitcoin", "solana"
    pub balance: String,   // String for precision (e.g., "1.234567890123456789")
    pub symbol: String,    // "ETH", "BTC", "SOL"
    pub timestamp: String, // ISO 8601
}

#[derive(Debug, Clone, Serialize)]
pub struct WalletBalanceResponse {
    pub wallet_id: String,
    pub balances: Vec<AddressBalance>,
}
```

**Step 2: Handler** (`/backend/src/api/wallet.rs`)
```rust
pub async fn get_wallet_balance(
    State(pool): State<DbPool>,
    Path(wallet_id): Path<String>,
) -> Result<ResponseJson<WalletBalanceResponse>, StatusCode> {
    verify_wallet_exists(&pool, &wallet_id).await?;

    let addresses = database::get_wallet_addresses(&pool, &wallet_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch wallet addresses: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let timestamp = chrono::Utc::now().to_rfc3339();
    let balances: Vec<AddressBalance> = addresses
        .into_iter()
        .map(|addr| AddressBalance {
            address: addr.address,
            chain: addr.chain.clone(),
            balance: "0.0".to_string(),  // Mock balance
            symbol: chain_to_symbol(&addr.chain),
            timestamp: timestamp.clone(),
        })
        .collect();

    Ok(ResponseJson(WalletBalanceResponse { wallet_id, balances }))
}
```

**Step 3: Route** (`/backend/src/api/server.rs`)
```rust
.route("/wallet/{id}/balance", get(wallet::get_wallet_balance))
```

### Component 2: Transaction History Endpoint

**Types:**
```rust
#[derive(Debug, Clone, Serialize)]
pub struct Transaction {
    pub hash: String,
    pub from: String,
    pub to: String,
    pub amount: String,
    pub chain: String,
    pub symbol: String,
    pub status: String,                // "confirmed", "pending", "failed"
    pub timestamp: String,
    pub block_number: Option<String>,  // None if pending
}

#[derive(Debug, Clone, Serialize)]
pub struct WalletTransactionResponse {
    pub wallet_id: String,
    pub transactions: Vec<Transaction>,
}
```

**Handler:**
```rust
pub async fn get_transaction_history(
    State(pool): State<DbPool>,
    Path(wallet_id): Path<String>,
) -> Result<ResponseJson<WalletTransactionResponse>, StatusCode> {
    verify_wallet_exists(&pool, &wallet_id).await?;

    let transactions: Vec<Transaction> = vec![];  // Empty for now

    Ok(ResponseJson(WalletTransactionResponse { wallet_id, transactions }))
}
```

### Component 3: Transaction Broadcast Endpoint

**Types:**
```rust
#[derive(Debug, Clone, Deserialize)]
pub struct BroadcastTransactionRequest {
    pub signed_tx: String,  // Hex-encoded signed transaction
    pub chain: String,      // "bitcoin", "ethereum", "solana"
}

#[derive(Debug, Clone, Serialize)]
pub struct BroadcastTransactionResponse {
    pub tx_hash: String,
    pub chain: String,
    pub status: String,     // "pending", "submitted", "failed"
    pub message: String,
}
```

**Handler:**
```rust
pub async fn broadcast_transaction(
    State(pool): State<DbPool>,
    Path(wallet_id): Path<String>,
    Json(request): Json<BroadcastTransactionRequest>,
) -> Result<ResponseJson<BroadcastTransactionResponse>, StatusCode> {
    verify_wallet_exists(&pool, &wallet_id).await?;

    if let Err(error_msg) = validate_broadcast_request(&request) {
        tracing::warn!("Broadcast validation failed: {}", error_msg);
        return Err(StatusCode::BAD_REQUEST);
    }

    let mock_tx_hash = format!("0x{}", Uuid::new_v4().to_string().replace("-", ""));

    Ok(ResponseJson(BroadcastTransactionResponse {
        tx_hash: mock_tx_hash,
        chain: request.chain,
        status: "pending".to_string(),
        message: "Transaction broadcast queued (mock)".to_string(),
    }))
}
```

### Helper Functions

**Wallet Existence Check (refactored to reduce duplication):**
```rust
async fn verify_wallet_exists(pool: &DbPool, wallet_id: &str) -> Result<(), StatusCode> {
    database::get_wallet_by_id(pool, wallet_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check wallet existence: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or_else(|| {
            tracing::warn!("Wallet not found: {}", wallet_id);
            StatusCode::NOT_FOUND
        })?;
    Ok(())
}
```

**Broadcast Validation:**
```rust
fn validate_broadcast_request(request: &BroadcastTransactionRequest) -> Result<(), String> {
    if request.signed_tx.trim().is_empty() {
        return Err("Signed transaction cannot be empty.".to_string());
    }

    let supported_chains = ["bitcoin", "ethereum", "solana"];
    if !supported_chains.contains(&request.chain.to_lowercase().as_str()) {
        return Err(format!("Unsupported chain: {}", request.chain));
    }

    Ok(())
}
```

**Chain to Symbol Conversion:**
```rust
fn chain_to_symbol(chain: &str) -> String {
    match chain.to_lowercase().as_str() {
        "ethereum" => "ETH".to_string(),
        "bitcoin" => "BTC".to_string(),
        "solana" => "SOL".to_string(),
        _ => chain.to_uppercase(),
    }
}
```

## Files Created/Modified

### Created
- `/backend/src/api/types.rs` - Shared API types for blockchain endpoints

### Modified
- `/backend/src/api/wallet.rs` - Added 3 handlers + 3 helper functions
- `/backend/src/api/server.rs` - Added 3 new routes
- `/backend/src/api/mod.rs` - Added `pub mod types;` export

## Dependencies Used

No new dependencies. Used existing crates:
- `axum` - Web framework (State, Path, Json extractors)
- `serde` - Serialization (Serialize for responses, Deserialize for requests)
- `uuid` - Mock transaction hash generation
- `chrono` - Timestamp generation
- `tracing` - Logging

## Key Rust Concepts Explained

### 1. `?` Operator in Async Helpers
```rust
verify_wallet_exists(&pool, &wallet_id).await?;
```
The `?` in the helper returns from the helper function. The caller must also use `?` to propagate the error to Axum.

### 2. Iterator Chain: `.into_iter().map().collect()`
```rust
addresses.into_iter()    // Take ownership of vec elements
    .map(|addr| {...})   // Transform each element
    .collect()           // Collect into new Vec
```

### 3. String Type Conversions
```rust
"hello".to_string()              // &str -> String
my_string.as_str()               // String -> &str
request.chain.to_lowercase()     // Returns new String
```

### 4. `&&str` in `.contains()`
```rust
let chains = ["bitcoin", "ethereum"];  // [&str; 2]
// contains() expects reference to element type: &(&str) = &&str
chains.contains(&request.chain.to_lowercase().as_str())
```

### 5. Derive Macros for Serde
```rust
#[derive(Deserialize)]  // For request bodies (incoming JSON)
#[derive(Serialize)]    // For response bodies (outgoing JSON)
```

### 6. Helper Function Parameter Types
```rust
// Handler uses extractor syntax:
State(pool): State<DbPool>

// Helper uses plain reference:
pool: &DbPool
```

## Testing & Verification

### Build
```bash
cd backend
DATABASE_URL="sqlite:./data/wallet.db" cargo build
```

### Run Server
```bash
DATABASE_URL="sqlite:./data/wallet.db" cargo run
```

### Test Commands

**1. Get Balance (empty wallet)**
```bash
curl http://localhost:8080/wallet/{wallet_id}/balance
# Response: {"wallet_id": "...", "balances": []}
```

**2. Get Balance (with registered address)**
```bash
# First register an address
curl -X POST "http://localhost:8080/wallet/{wallet_id}/addresses" \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f9a12D", "chain": "ethereum", "derivation_path": "m/44/60/0/0/0"}'

# Then check balance
curl http://localhost:8080/wallet/{wallet_id}/balance
# Response: {"wallet_id": "...", "balances": [{"address": "0x...", "chain": "ethereum", "balance": "0.0", "symbol": "ETH", ...}]}
```

**3. Get Transactions**
```bash
curl http://localhost:8080/wallet/{wallet_id}/transactions
# Response: {"wallet_id": "...", "transactions": []}
```

**4. Broadcast Transaction (valid)**
```bash
curl -X POST "http://localhost:8080/wallet/{wallet_id}/broadcast" \
  -H "Content-Type: application/json" \
  -d '{"signed_tx": "0xf86c0a8502540be400...", "chain": "ethereum"}'
# Response: {"tx_hash": "0x...", "chain": "ethereum", "status": "pending", ...}
```

**5. Broadcast Transaction (invalid chain)**
```bash
curl -X POST "http://localhost:8080/wallet/{wallet_id}/broadcast" \
  -H "Content-Type: application/json" \
  -d '{"signed_tx": "0xabc", "chain": "dogecoin"}'
# Response: 400 Bad Request
```

**6. Non-existent Wallet**
```bash
curl http://localhost:8080/wallet/fake-id/balance
# Response: 404 Not Found
```

### Test Results
| Test | Expected | Result |
|------|----------|--------|
| Balance (empty) | 200 + empty array | Pass |
| Balance (with address) | 200 + balance data | Pass |
| Transactions | 200 + empty array | Pass |
| Valid broadcast | 200 + tx_hash | Pass |
| Invalid chain | 400 | Pass |
| Empty signed_tx | 400 | Pass |
| Non-existent wallet | 404 | Pass |

## Architecture Notes

### Non-Custodial Flow
1. **Frontend** generates mnemonic, derives addresses locally
2. **Frontend** registers addresses with backend via `/wallet/{id}/addresses`
3. **Backend** provides balance/transaction data for registered addresses
4. **Frontend** creates and signs transactions locally
5. **Frontend** sends signed transactions to backend for broadcast
6. **Backend** broadcasts to blockchain network (mock for now)

### Mock Data Strategy
Current implementation returns mock data to allow frontend development while blockchain RPC integration is built:
- Balances: Always "0.0"
- Transactions: Empty array
- Broadcast: Random UUID as tx_hash with "pending" status

## Future Development

### Blockchain RPC Integration (Future Tasks)
```rust
// TODO: Replace mock with real RPC calls
// Ethereum: eth_getBalance, eth_getTransactionsByAddress
// Bitcoin: getaddressbalance, listtransactions
// Solana: getBalance, getSignaturesForAddress
```

### Potential Enhancements
1. **Pagination** - Add limit/offset for transaction history
2. **Filtering** - Filter transactions by date, amount, status
3. **Caching** - Cache balance data with TTL
4. **WebSocket** - Real-time balance updates
5. **Multi-address Query** - Batch balance queries for efficiency

## Errors Encountered & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `use sqlx::types::chrono` failed | Wrong import | Use `use chrono;` directly |
| `Result<Ok, StatusCode>` | `Ok` is not a type | Use `Result<(), String>` |
| `State(pool): State<DbPool>` in helper | Extractor syntax in non-handler | Use `pool: &DbPool` |
| `not in` syntax | Python syntax | Use `!contains()` |
| Missing `.await?` on verify call | Forgot async handling | Add `.await?` |

## Commit Messages Used

```
feat: T5 - Add balance checking endpoint with mock data
feat: T5 - Add GET /wallet/{id}/transactions endpoint
feat: T5 - Add POST /wallet/{id}/broadcast endpoint with validation
```
