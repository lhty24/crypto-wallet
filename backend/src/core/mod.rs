//! Core wallet functionality
//! 
//! This module contains the essential cryptographic and wallet management components.

pub mod wallet;
pub mod security;

// Re-export commonly used types for convenience
// These will be uncommented as we implement each module in Tasks 3-5:
// pub use wallet::mnemonic::MnemonicGenerator;
// pub use wallet::hd_wallet::{HDWallet, SupportedChain};
// pub use security::encryption::KeyEncryption;