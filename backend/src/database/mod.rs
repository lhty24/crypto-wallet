pub mod connection;

pub mod models;

pub mod wallet;

// Re-exports for clean imports
pub use connection::{init_database, DbPool};
pub use models::*;
pub use wallet::*;
