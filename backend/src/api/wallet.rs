use crate::core::{EntropyLevel, MnemonicManager};
use crate::database::{self, DbPool};
use axum::extract::State;
use axum::{extract::Json, http::StatusCode, response::Json as ResponseJson};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// For POST /wallet/create
#[derive(Deserialize)]
pub struct CreateWalletRequest {
    name: String,     // User-friendly wallet name
    password: String, // Password for encryption
}

// For POST /wallet/import
#[derive(Deserialize)]
pub struct ImportWalletRequest {
    name: String,     // User-friendly wallet name
    mnemonic: String, // BIP39 mnemonic phrase
    password: String, // Password for encryption
}

// Success response for both endpoints
#[derive(Serialize)]
pub struct WalletResponse {
    wallet_id: String,  // Unique wallet identifier
    name: String,       // Wallet name
    created_at: String, // ISO timestamp
    message: String,
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

    let mnemonic_manager = MnemonicManager::new();
    let _mnemonic = match mnemonic_manager.generate(EntropyLevel::High) {
        Ok(m) => m,
        Err(e) => {
            tracing::error!("Failed to generate mnemonic: {:?}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

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
        message: "Wallet successfully created.".to_string(),
    }))
}

// POST /wallet/import handler
pub async fn import_wallet(
    State(pool): State<DbPool>,
    Json(request): Json<ImportWalletRequest>,
) -> Result<ResponseJson<WalletResponse>, StatusCode> {
    // TODO: Add mnemonic validation logic
    // 1. Validate input (name not empty, password meets requirements)
    if let Err(error_msg) = validate_import_request(&request) {
        tracing::warn!("Wallet import validation failed: {error_msg}");
        return Err(StatusCode::BAD_REQUEST);
    }
    // 2. Parse and validate mnemonic using MnemonicManager::from_mnemonic()
    let mnemonic_manager = MnemonicManager::new();
    let _validated_mnemonic = match mnemonic_manager.parse(&request.mnemonic) {
        Ok(m) => m,
        Err(e) => {
            tracing::warn!("Invalid mnemonic provided: {:?}", e);
            return Err(StatusCode::UNPROCESSABLE_ENTITY);
        }
    };

    // 3. Generate wallet ID and call database
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

    // 4. Return WalletResponse with wallet info
    Ok(ResponseJson(WalletResponse {
        wallet_id: wallet.wallet_id,
        name: wallet.name,
        created_at: wallet.created_at,
        message: "Wallet successfully imported.".to_string(),
    }))
}

fn validate_create_request(request: &CreateWalletRequest) -> Result<(), String> {
    if request.name.trim().is_empty() {
        return Err("Wallet name cannot be empty".to_string());
    }
    if request.name.len() > 50 {
        return Err("Wallet name must be 50 characters or less".to_string());
    }
    if request.password.len() < 8 {
        return Err("Password must be at least 8 characters".to_string());
    }

    Ok(())
}

fn validate_import_request(request: &ImportWalletRequest) -> Result<(), String> {
    if request.name.trim().is_empty() {
        return Err("Wallet name cannot be empty".to_string());
    }
    if request.name.len() > 50 {
        return Err("Wallet name must be 50 characters or less".to_string());
    }
    if request.password.len() < 8 {
        return Err("Password must be at least 8 characters".to_string());
    }
    if request.mnemonic.trim().is_empty() {
        return Err("Mnemonic cannot be empty".to_string());
    }

    Ok(())
}
