//! Wallet-related functionality
//! 
//! Contains HD wallet implementation, mnemonic handling, and key management.

// Public modules
pub mod mnemonic;
pub mod hd_wallet;

// Re-export commonly used types for convenience
pub use mnemonic::{
    MnemonicManager, 
    WalletMnemonic, 
    EntropyLevel, 
    MnemonicError,
    generate_test_mnemonic,
    generate_entropy,
};