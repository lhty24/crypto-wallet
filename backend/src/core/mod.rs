//! Core wallet functionality
//! 
//! This module contains the essential cryptographic and wallet management components.

pub mod wallet;
pub mod security;

// Re-export commonly used types for convenience
// Task 3: ✅ BIP39 Mnemonic functionality - COMPLETED
pub use wallet::{
    MnemonicManager, 
    WalletMnemonic, 
    EntropyLevel, 
    MnemonicError,
    generate_test_mnemonic,
};

// These will be uncommented as we implement each module in Tasks 4-5:
// pub use wallet::hd_wallet::{HDWallet, SupportedChain};
// pub use security::encryption::KeyEncryption;