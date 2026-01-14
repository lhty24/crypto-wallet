use crate::database::{self, DbPool};
use axum::extract::State;
use axum::{
    extract::{Json, Path},
    http::StatusCode,
    response::Json as ResponseJson,
};
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
