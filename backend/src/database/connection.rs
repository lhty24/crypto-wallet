use anyhow::{Context, Result};
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

pub type DbPool = SqlitePool;

// Main initialization function
pub async fn init_database() -> Result<DbPool> {
    // Load .env file if it exists
    dotenv::dotenv().ok(); // .ok() means "ignore if .env doesn't exist"

    // 1. Database URL (file path)
    let db_url = get_database_url();
    // 2. Create connection pool
    let pool = SqlitePoolOptions::new()
        .max_connections(2)
        .min_connections(1)
        .connect(&db_url)
        .await
        .context("Failed to create database connection pool")?;

    // 3. Run migrations
    run_migrations(&pool).await?;

    // 4. Return pool
    Ok(pool)
}

// Helper for getting database file path
fn get_database_url() -> String {
    std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:wallet.db".to_string())
}

// Apply your schema
async fn run_migrations(pool: &DbPool) -> Result<()> {
    // Execute schema.sql content
    let schema = include_str!("schema.sql");

    for statement in schema.split(';') {
        let statement = statement.trim();

        if statement.is_empty() {
            continue;
        }

        sqlx::query(statement)
            .execute(pool)
            .await
            .context("Failed to execute migration statement")?;
    }
    Ok(())
}
