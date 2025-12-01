//! Core wallet functionality
//!
//! This module contains the essential cryptographic and wallet management components.

pub mod security;
pub mod wallet;

// Re-export commonly used types for convenience
// Task 3: ✅ BIP39 Mnemonic functionality - COMPLETED
pub use wallet::{
    generate_test_mnemonic, EntropyLevel, MnemonicError, MnemonicManager, WalletMnemonic,
};

// These will be uncommented as we implement each module in Tasks 4-5:
// pub use wallet::hd_wallet::{HDWallet, SupportedChain};
// pub use security::encryption::KeyEncryption;
