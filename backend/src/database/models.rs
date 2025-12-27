use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Wallet {
    pub id: Option<i64>,
    pub name: String,
    pub wallet_id: String,
    pub created_at: String,
    pub updated_at: Option<String>,
}
