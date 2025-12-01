//! Wallet-related functionality
//!
//! Contains HD wallet implementation, mnemonic handling, and key management.

// Public modules
pub mod hd_wallet;
pub mod mnemonic;

// Re-export commonly used types for convenience
pub use mnemonic::{
    generate_entropy, generate_test_mnemonic, EntropyLevel, MnemonicError, MnemonicManager,
    WalletMnemonic,
};

pub use hd_wallet::{derivation, Account, Chain, HDWallet, HDWalletError};
