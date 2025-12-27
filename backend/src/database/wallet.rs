use anyhow::{Context, Ok, Result};
use chrono::Utc;
// use tracing_subscriber::fmt::time::FormatTime;

// use crate::api::wallet;

use super::{DbPool, Wallet};

// Insert new wallet into database
pub async fn create_wallet(pool: &DbPool, wallet_name: &str, wallet_id: &str) -> Result<Wallet> {
    let now = Utc::now().to_rfc3339();

    let wallet = sqlx::query_as!(
        Wallet,
        r#"
        INSERT INTO wallets (name, wallet_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        RETURNING id, name, wallet_id, created_at, updated_at
        "#,
        wallet_name,
        wallet_id,
        now,
        now,
    )
    .fetch_one(pool)
    .await
    .context("Failed to create wallet in database")?;

    Ok(wallet)
}

// Find wallet by UUID
pub async fn get_wallet_by_id(pool: &DbPool, wallet_id: &str) -> Result<Option<Wallet>> {
    let wallet = sqlx::query_as!(
        Wallet,
        r#"
        SELECT id, name, wallet_id, created_at, updated_at
        FROM wallets 
        WHERE wallet_id = ?
        "#,
        wallet_id,
    )
    .fetch_optional(pool)
    .await
    .context("Failed to query wallet in database")?;

    Ok(wallet)
}

// // Get all wallets (for future list endpoint)
pub async fn list_wallets(pool: &DbPool) -> Result<Vec<Wallet>> {
    let wallets = sqlx::query_as!(
        Wallet,
        r#"
        SELECT *
        FROM wallets
        "#,
    )
    .fetch_all(pool) // for multiple results
    .await
    .context("Failed to query list of wallets")?;

    Ok(wallets)
}

pub async fn update_wallet_name(
    pool: &DbPool,
    wallet_name: &str,
    wallet_id: &str,
) -> Result<Option<Wallet>> {
    let now = Utc::now().to_rfc3339();

    let wallet = sqlx::query_as!(
        Wallet,
        r#"
        UPDATE wallets
        SET name = ?, updated_at = ?
        WHERE wallet_id = ?
        RETURNING id, name, wallet_id, created_at, updated_at
        "#,
        wallet_name,
        now,
        wallet_id,
    )
    .fetch_optional(pool)
    .await
    .context("Failed to update wallet")?;

    Ok(wallet)
}

/// Delete wallet by UUID (DANGEROUS - use with caution)
///
/// This permanently removes wallet metadata from database.
/// In production, consider soft-delete or archive instead.
pub async fn delete_wallet(pool: &DbPool, wallet_id: &str) -> Result<bool> {
    let result = sqlx::query!("DELETE FROM wallets WHERE wallet_id = ?", wallet_id)
        .execute(pool)
        .await
        .context("Failed to delete wallet from database")?;

    // Returns true if wallet was actually deleted
    Ok(result.rows_affected() > 0)
}

// Implement later
// Archive wallet instead of permanent deletion
// pub async fn archive_wallet(pool: &DbPool, wallet_id: &str) -> Result<Option<Wallet>> {
//     let wallet = sqlx::query_as!(
//         Wallet,
//         r#"
//           UPDATE wallets
//           SET updated_at = ?, archived_at = ?
//           WHERE wallet_id = ? AND archived_at IS NULL
//           RETURNING id, name, wallet_id, created_at, updated_at
//         "#,
//         Utc::now().to_rfc3339(),
//         Utc::now().to_rfc3339(),
//         wallet_id,
//     )
//     .fetch_optional(pool)
//     .await
//     .context("Failed to archive wallet")?;

//     Ok(wallet)
// }
