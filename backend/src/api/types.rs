//! Shared API types for blockchain service endpoints.
//!
//! This module contains request/response structures for:
//! - Balance checking (GET /wallet/{id}/balance)
//! - Transaction history (GET /wallet/{id}/transactions)
//! - Transaction broadcast (POST /wallet/{id}/broadcast)

use serde::{Deserialize, Serialize};

// ============================================================================
// Balance Types
// ============================================================================

/// Balance information for a single blockchain address.
/// Used as part of WalletBalanceResponse.
#[derive(Debug, Clone, Serialize)]
pub struct AddressBalance {
    pub address: String,   // The blockchain address (e.g., "0x..." or "bc1...")
    pub chain: String,     // Blockchain name: "ethereum", "bitcoin", "solana"
    pub balance: String,   // Balance as string to preserve precision (e.g., "1.234567890123456789")
    pub symbol: String,    // Token symbol: "ETH", "BTC", "SOL"
    pub timestamp: String, // ISO 8601 timestamp when balance was fetched
}

/// Response for GET /wallet/{id}/balance endpoint.
/// Contains balances for all registered addresses in a wallet.
#[derive(Debug, Clone, Serialize)]
pub struct WalletBalanceResponse {
    pub wallet_id: String,
    pub balances: Vec<AddressBalance>, // One entry per registered address
}

// ============================================================================
// Transaction History Types
// ============================================================================

/// A single blockchain transaction record.
/// Used as part of WalletTransactionResponse.
#[derive(Debug, Clone, Serialize)]
pub struct Transaction {
    pub hash: String,                  // Transaction hash (e.g., "0xabc123...")
    pub from: String,                  // Sender address
    pub to: String,                    // Recipient address
    pub amount: String,                // Amount transferred (string for precision)
    pub chain: String,                 // Blockchain name
    pub symbol: String,                // Token symbol
    pub status: String,                // "confirmed", "pending", "failed"
    pub timestamp: String,             // ISO 8601 timestamp
    pub block_number: Option<String>,  // None if pending, Some("12345") if confirmed
}

/// Response for GET /wallet/{id}/transactions endpoint.
/// Contains transaction history for all addresses in a wallet.
#[derive(Debug, Clone, Serialize)]
pub struct WalletTransactionResponse {
    pub wallet_id: String,
    pub transactions: Vec<Transaction>, // Ordered by timestamp, newest first
}

// ============================================================================
// Broadcast Types
// ============================================================================

/// Request body for POST /wallet/{id}/broadcast endpoint.
/// Frontend sends signed transaction for backend to broadcast.
#[derive(Debug, Clone, Deserialize)]
pub struct BroadcastTransactionRequest {
    pub signed_tx: String, // Hex-encoded signed transaction from frontend
    pub chain: String,     // Target chain: "bitcoin", "ethereum", "solana"
}

/// Response for POST /wallet/{id}/broadcast endpoint.
/// Returns transaction hash after successful broadcast.
#[derive(Debug, Clone, Serialize)]
pub struct BroadcastTransactionResponse {
    pub tx_hash: String, // Transaction hash assigned by the network
    pub chain: String,   // Chain the transaction was broadcast to
    pub status: String,  // "pending" (just broadcast), "submitted", "failed"
    pub message: String, // Human-readable status message
}
