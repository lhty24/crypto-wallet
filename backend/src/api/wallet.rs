use super::types::*;
use crate::database::{self, DbPool};
use axum::extract::State;
use axum::{
    extract::{Json, Path},
    http::StatusCode,
    response::Json as ResponseJson,
};
use chrono;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// For POST /wallet/create
#[derive(Deserialize)]
pub struct CreateWalletRequest {
    name: String, // User-friendly wallet name
}

// For POST /wallet/import
#[derive(Deserialize)]
pub struct ImportWalletRequest {
    name: String, // User-friendly wallet name
}

// Request structure for updating wallet name
#[derive(Deserialize)]
pub struct UpdateWalletRequest {
    name: String, // New wallet name
}

// Response structure for delete operation
#[derive(Serialize)]
pub struct DeleteWalletResponse {
    wallet_id: String,
    message: String,
    deleted: bool,
}

// Success response for both endpoints
#[derive(Serialize)]
pub struct WalletResponse {
    wallet_id: String,  // Unique wallet identifier
    name: String,       // Wallet name
    created_at: String, // ISO timestamp
    message: String,
}

// Request structure for address registration
#[derive(Deserialize)]
pub struct RegisterAddressRequest {
    address: String,         // The actual crypto address
    chain: String,           // "bitcoin", "ethereum", etc.
    derivation_path: String, // "m/44'/0'/0'/0/0" format
}

// Response for successful address registration
#[derive(Serialize)]
pub struct AddressResponse {
    id: i64,                 // Database ID
    wallet_id: String,       // Wallet this address belongs to
    address: String,         // The registered address
    chain: String,           // Blockchain name
    derivation_path: String, // BIP44 path
    created_at: String,      // When registered
    message: String,         // Success message
}

// Error response structure, could be used later for detailed error responses
// #[derive(Serialize)]
// pub struct ErrorResponse {
//     error: String, // Error message
//     code: String,  // Error code (e.g., "INVALID_MNEMONIC")
// }

// POST /wallet/create handler
pub async fn create_wallet(
    State(pool): State<DbPool>,
    Json(request): Json<CreateWalletRequest>,
) -> Result<ResponseJson<WalletResponse>, StatusCode> {
    if let Err(error_msg) = validate_create_request(&request) {
        tracing::warn!("Wallet creation validation failed: {error_msg}");
        return Err(StatusCode::BAD_REQUEST);
    }

    // Generate wallet ID and call database
    let wallet_id = Uuid::new_v4().to_string();
    let wallet = database::create_wallet(&pool, &request.name, &wallet_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create wallet in database: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    tracing::info!(
        "Created new wallet with ID: {} at: {}",
        wallet.wallet_id,
        wallet.created_at
    );

    Ok(ResponseJson(WalletResponse {
        wallet_id: wallet.wallet_id,
        name: wallet.name,
        created_at: wallet.created_at,
        message: "Wallet metadata created. Generate mnemonic on frontend.".to_string(),
    }))
}

// POST /wallet/import handler
pub async fn import_wallet(
    State(pool): State<DbPool>,
    Json(request): Json<ImportWalletRequest>,
) -> Result<ResponseJson<WalletResponse>, StatusCode> {
    if let Err(error_msg) = validate_import_request(&request) {
        tracing::warn!("Wallet import validation failed: {error_msg}");
        return Err(StatusCode::BAD_REQUEST);
    }

    // Generate wallet ID for metadata record
    let wallet_id = Uuid::new_v4().to_string();

    let wallet = database::create_wallet(&pool, &request.name, &wallet_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to import wallet in database: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tracing::info!(
        "Imported wallet with ID: {} at: {}",
        wallet.wallet_id,
        wallet.created_at,
    );

    // Return WalletResponse with wallet info
    Ok(ResponseJson(WalletResponse {
        wallet_id: wallet.wallet_id,
        name: wallet.name,
        created_at: wallet.created_at,
        message: "Wallet metadata created. Import and encrypt mnemonic on frontend.".to_string(),
    }))
}

// PUT /wallet/{id} handler
pub async fn update_wallet(
    State(pool): State<DbPool>,
    Path(wallet_id): Path<String>,
    Json(request): Json<UpdateWalletRequest>,
) -> Result<ResponseJson<WalletResponse>, StatusCode> {
    // Validate the request
    if let Err(error_msg) = validate_update_request(&request) {
        tracing::warn!("Wallet update validation failed: {error_msg}");
        return Err(StatusCode::BAD_REQUEST);
    }

    // Update the wallet name
    let wallet = database::update_wallet_name(&pool, &request.name, &wallet_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update wallet: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or_else(|| {
            tracing::warn!("Attempt to update non-existent wallet: {}", wallet_id);
            StatusCode::NOT_FOUND
        })?;

    tracing::info!("Updated wallet {} name to: {}", wallet_id, request.name);

    Ok(ResponseJson(WalletResponse {
        wallet_id: wallet.wallet_id,
        name: wallet.name,
        created_at: wallet.created_at,
        message: "Wallet name updated successfully".to_string(),
    }))
}

// DELETE /wallet/{id} handler
pub async fn delete_wallet(
    State(pool): State<DbPool>,
    Path(wallet_id): Path<String>,
) -> Result<ResponseJson<DeleteWalletResponse>, StatusCode> {
    // Delete the wallet
    let deleted = database::delete_wallet(&pool, &wallet_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete wallet: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !deleted {
        tracing::warn!("Attempt to delete non-existent wallet: {}", wallet_id);
        return Err(StatusCode::NOT_FOUND);
    }

    tracing::info!("Successfully deleted wallet: {}", wallet_id);

    Ok(ResponseJson(DeleteWalletResponse {
        wallet_id: wallet_id.clone(),
        message: "Wallet deleted successfully".to_string(),
        deleted: true,
    }))
}

// POST /wallet/{id}/addresses handler
pub async fn register_address(
    State(pool): State<DbPool>,
    Path(wallet_id): Path<String>, // Extract {id} from URL
    Json(request): Json<RegisterAddressRequest>,
) -> Result<ResponseJson<AddressResponse>, StatusCode> {
    // Validate the request
    if let Err(error_msg) = validate_address_request(&request) {
        tracing::warn!("Address registration validation failed: {error_msg}");
        return Err(StatusCode::BAD_REQUEST);
    }

    // Verify wallet exists before adding address
    let _wallet = database::get_wallet_by_id(&pool, &wallet_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check wallet existence: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or_else(|| {
            tracing::warn!(
                "Attempt to register address for non-existent wallet: {}",
                wallet_id
            );
            StatusCode::NOT_FOUND
        })?;

    // Register the address
    let wallet_address = database::create_wallet_address(
        &pool,
        &wallet_id,
        &request.address,
        &request.chain,
        &request.derivation_path,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to register address: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(
        "Registered address {} for wallet {} on chain {}",
        wallet_address.address,
        wallet_address.wallet_id,
        wallet_address.chain
    );

    Ok(ResponseJson(AddressResponse {
        id: wallet_address.id.unwrap_or(0),
        wallet_id: wallet_address.wallet_id,
        address: wallet_address.address,
        chain: wallet_address.chain,
        derivation_path: wallet_address.derivation_path,
        created_at: wallet_address.created_at.unwrap_or_default(),
        message: "Address registered successfully".to_string(),
    }))
}

// get all wallets
// input: db pool
// output: array of wallet metadata
pub async fn get_wallets(
    State(pool): State<DbPool>,
) -> Result<ResponseJson<Vec<WalletResponse>>, StatusCode> {
    // get array of wallets from db
    let wallets = database::list_wallets(&pool).await.map_err(|e| {
        tracing::error!("Failed to list wallets from database: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // re-format wallet array into proper response
    let wallet_responses: Vec<WalletResponse> = wallets
        .into_iter()
        .map(|wallet| WalletResponse {
            wallet_id: wallet.wallet_id,
            name: wallet.name,
            created_at: wallet.created_at,
            message: "Wallet metadata retrieved.".to_string(),
        })
        .collect();

    Ok(ResponseJson(wallet_responses))
}

// register wallet
// input: pool, name, id
// output: Ok?
pub async fn register_wallet(
    State(pool): State<DbPool>,
    wallet_name: &str,
    wallet_id: &str,
) -> Result<ResponseJson<WalletResponse>, StatusCode> {
    let wallet = database::create_wallet(&pool, &wallet_name, &wallet_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to register the wallet: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let wallet_response: WalletResponse = WalletResponse {
        wallet_id: wallet.wallet_id,
        name: wallet.name,
        created_at: wallet.created_at,
        message: "Wallet metadata retrieved.".to_string(),
    };

    Ok(ResponseJson(wallet_response))
}

// ============================================================================
// Blockchain Service Endpoints (Task 5)
// ============================================================================

/// GET /wallet/{id}/balance - Retrieve balances for all registered addresses
///
/// Returns mock balance data (0.0) for now. Real blockchain RPC integration
/// will be added in a future task to fetch actual balances from networks.
///
/// # Response
/// - 200: WalletBalanceResponse with balances array
/// - 404: Wallet not found
/// - 500: Database error
pub async fn get_wallet_balance(
    State(pool): State<DbPool>,       // Database connection pool from app state
    Path(wallet_id): Path<String>,    // Extract {id} from URL path
) -> Result<ResponseJson<WalletBalanceResponse>, StatusCode> {
    // 1. Verify wallet exists (returns 404 if not found)
    verify_wallet_exists(&pool, &wallet_id).await?;

    // 2. Fetch all addresses registered to this wallet from database
    let addresses = database::get_wallet_addresses(&pool, &wallet_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch wallet addresses: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // 3. Transform database records into API response format
    // TODO: Replace mock balance with real RPC calls to blockchain nodes
    let timestamp = chrono::Utc::now().to_rfc3339();
    let balances: Vec<AddressBalance> = addresses
        .into_iter()                          // Take ownership of vec elements
        .map(|addr| AddressBalance {          // Transform each WalletAddress -> AddressBalance
            address: addr.address,
            chain: addr.chain.clone(),        // Clone needed: chain used twice
            balance: "0.0".to_string(),       // Mock: real RPC integration later
            symbol: chain_to_symbol(&addr.chain), // Convert "ethereum" -> "ETH"
            timestamp: timestamp.clone(),     // Same timestamp for all in batch
        })
        .collect();                           // Collect iterator into Vec

    tracing::info!(
        "Retrieved {} balances for wallet {}",
        balances.len(),
        wallet_id
    );

    Ok(ResponseJson(WalletBalanceResponse {
        wallet_id,
        balances,
    }))
}

/// GET /wallet/{id}/transactions - Retrieve transaction history for a wallet
///
/// Returns empty transaction list for now. Real blockchain RPC integration
/// will query transaction history for all registered addresses.
///
/// # Response
/// - 200: WalletTransactionResponse with transactions array
/// - 404: Wallet not found
/// - 500: Database error
pub async fn get_transaction_history(
    State(pool): State<DbPool>,
    Path(wallet_id): Path<String>,
) -> Result<ResponseJson<WalletTransactionResponse>, StatusCode> {
    // 1. Verify wallet exists (returns 404 if not found)
    verify_wallet_exists(&pool, &wallet_id).await?;

    // 2. TODO: Fetch transactions from blockchain for all registered addresses
    // Will need to query each chain's RPC/API for transaction history
    // For now, return empty list as placeholder
    let transactions: Vec<Transaction> = vec![];

    tracing::info!(
        "Retrieved {} transactions for wallet {}",
        transactions.len(),
        wallet_id
    );

    Ok(ResponseJson(WalletTransactionResponse {
        wallet_id,
        transactions,
    }))
}

/// POST /wallet/{id}/broadcast - Broadcast a signed transaction to the blockchain
///
/// Accepts a hex-encoded signed transaction from the frontend and broadcasts it
/// to the appropriate blockchain network. Currently returns mock response.
///
/// # Request Body
/// ```json
/// { "signed_tx": "0xf86c...", "chain": "ethereum" }
/// ```
///
/// # Response
/// - 200: BroadcastTransactionResponse with tx_hash
/// - 400: Invalid chain or empty signed_tx
/// - 404: Wallet not found
/// - 500: Database or broadcast error
pub async fn broadcast_transaction(
    State(pool): State<DbPool>,
    Path(wallet_id): Path<String>,
    Json(request): Json<BroadcastTransactionRequest>, // Axum auto-parses JSON body
) -> Result<ResponseJson<BroadcastTransactionResponse>, StatusCode> {
    // 1. Verify wallet exists (returns 404 if not found)
    verify_wallet_exists(&pool, &wallet_id).await?;

    // 2. Validate request: chain must be supported, signed_tx must not be empty
    if let Err(error_msg) = validate_broadcast_request(&request) {
        tracing::warn!("Broadcast validation failed: {}", error_msg);
        return Err(StatusCode::BAD_REQUEST);
    }

    // 3. Generate mock transaction hash (real RPC broadcast comes later)
    // TODO: Replace with actual blockchain RPC calls:
    //   - Ethereum: eth_sendRawTransaction
    //   - Bitcoin: sendrawtransaction
    //   - Solana: sendTransaction
    let mock_tx_hash = format!("0x{}", Uuid::new_v4().to_string().replace("-", ""));

    tracing::info!(
        "Broadcast transaction for wallet {} on chain {}: {}",
        wallet_id,
        request.chain,
        mock_tx_hash
    );

    Ok(ResponseJson(BroadcastTransactionResponse {
        tx_hash: mock_tx_hash,
        chain: request.chain,
        status: "pending".to_string(),
        message: "Transaction broadcast queued (mock)".to_string(),
    }))
}

// Helper functions below

fn validate_create_request(request: &CreateWalletRequest) -> Result<(), String> {
    if request.name.trim().is_empty() {
        return Err("Wallet name cannot be empty".to_string());
    }
    if request.name.len() > 50 {
        return Err("Wallet name must be 50 characters or less".to_string());
    }
    // if request.password.len() < 8 {
    //     return Err("Password must be at least 8 characters".to_string());
    // }

    Ok(())
}

fn validate_import_request(request: &ImportWalletRequest) -> Result<(), String> {
    if request.name.trim().is_empty() {
        return Err("Wallet name cannot be empty".to_string());
    }
    if request.name.len() > 50 {
        return Err("Wallet name must be 50 characters or less".to_string());
    }

    Ok(())
}

fn validate_update_request(request: &UpdateWalletRequest) -> Result<(), String> {
    if request.name.trim().is_empty() {
        return Err("Wallet name cannot be empty".to_string());
    }
    if request.name.len() > 50 {
        return Err("Wallet name must be 50 characters or less".to_string());
    }
    Ok(())
}

fn validate_address_request(request: &RegisterAddressRequest) -> Result<(), String> {
    // Validate address is not empty
    if request.address.trim().is_empty() {
        return Err("Address cannot be empty".to_string());
    }

    // Validate chain is supported
    let supported_chains = ["bitcoin", "ethereum", "solana"];
    if !supported_chains.contains(&request.chain.to_lowercase().as_str()) {
        return Err(format!("Unsupported chain: {}", request.chain));
    }

    // Validate derivation path format (basic check)
    if !request.derivation_path.starts_with("m/") {
        return Err("Invalid derivation path format".to_string());
    }

    // Basic address length validation (crypto addresses are typically 25-62 characters)
    if request.address.len() < 25 || request.address.len() > 62 {
        return Err("Invalid address length".to_string());
    }

    Ok(())
}

/// Verify that a wallet exists in the database.
///
/// This is an async helper function that checks wallet existence and returns
/// appropriate HTTP status codes. Used by multiple handlers to avoid code duplication.
///
/// # Arguments
/// * `pool` - Database connection pool (borrowed, not extracted)
/// * `wallet_id` - The wallet UUID to check
///
/// # Returns
/// * `Ok(())` - Wallet exists
/// * `Err(404)` - Wallet not found
/// * `Err(500)` - Database error
///
/// # Note on the `?` operator
/// The `?` returns from THIS function, not the caller. The caller must also
/// use `?` or handle the Result to propagate errors to Axum.
async fn verify_wallet_exists(pool: &DbPool, wallet_id: &str) -> Result<(), StatusCode> {
    database::get_wallet_by_id(pool, wallet_id)
        .await
        .map_err(|e| {                              // Convert anyhow::Error -> StatusCode
            tracing::error!("Failed to check wallet existence: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?                                          // Early return if database error
        .ok_or_else(|| {                            // Convert Option<Wallet> -> Result
            tracing::warn!("Wallet not found: {}", wallet_id);
            StatusCode::NOT_FOUND
        })?;                                         // Early return if wallet not found

    Ok(())
}

/// Validate broadcast transaction request.
///
/// Checks that:
/// - signed_tx is not empty (would fail on blockchain)
/// - chain is one of our supported chains
///
/// # Returns
/// * `Ok(())` - Request is valid
/// * `Err(String)` - Validation error message
fn validate_broadcast_request(request: &BroadcastTransactionRequest) -> Result<(), String> {
    // Reject empty transactions
    if request.signed_tx.trim().is_empty() {
        return Err("Signed transaction cannot be empty.".to_string());
    }

    // Check chain is supported (case-insensitive)
    let supported_chains = ["bitcoin", "ethereum", "solana"];
    // .to_lowercase() returns String, .as_str() borrows as &str
    // & prefix creates &&str which .contains() expects
    if !supported_chains.contains(&request.chain.to_lowercase().as_str()) {
        return Err(format!("Unsupported chain: {}", request.chain));
    }

    Ok(())
}

/// Convert blockchain name to its native token symbol.
///
/// # Examples
/// - "ethereum" -> "ETH"
/// - "bitcoin" -> "BTC"
/// - "solana" -> "SOL"
/// - "unknown" -> "UNKNOWN" (uppercase fallback)
fn chain_to_symbol(chain: &str) -> String {
    match chain.to_lowercase().as_str() {  // Normalize to lowercase for matching
        "ethereum" => "ETH".to_string(),
        "bitcoin" => "BTC".to_string(),
        "solana" => "SOL".to_string(),
        _ => chain.to_uppercase(),          // Default: just uppercase the chain name
    }
}
