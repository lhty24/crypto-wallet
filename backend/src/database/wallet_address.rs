use super::{DbPool, WalletAddress};
use anyhow::{Context, Result};
use chrono::Utc;

// Register a new address for a wallet
pub async fn create_wallet_address(
    pool: &DbPool,
    wallet_id: &str,
    address: &str,
    chain: &str,
    derivation_path: &str,
) -> Result<WalletAddress> {
    let now = Utc::now().to_rfc3339();

    let wallet_address = sqlx::query_as!(
        WalletAddress,
        r#"
        INSERT INTO wallet_addresses (wallet_id, address, chain, derivation_path, created_at)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id, wallet_id, address, chain, derivation_path, created_at
        "#,
        wallet_id,
        address,
        chain,
        derivation_path,
        now,
    )
    .fetch_one(pool)
    .await
    .context("Failed to create wallet address in database")?;

    Ok(wallet_address)
}

// Get all addresses for a specific wallet
pub async fn get_wallet_addresses(pool: &DbPool, wallet_id: &str) -> Result<Vec<WalletAddress>> {
    let addresses = sqlx::query_as!(
        WalletAddress,
        r#"
        SELECT id, wallet_id, address, chain, derivation_path, created_at
        FROM wallet_addresses
        WHERE wallet_id = ?
        ORDER BY created_at ASC
        "#,
        wallet_id,
    )
    .fetch_all(pool)
    .await
    .context("Failed to fetch wallet addresses")?;

    Ok(addresses)
}
