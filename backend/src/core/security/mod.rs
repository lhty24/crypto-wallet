//! Security-related functionality
//!
//! Contains encryption, key derivation, and other security utilities.

pub mod encryption;

// Re-export commonly used types for convenience
pub use encryption::{
    utils, EncryptedWallet, EncryptionError, EncryptionManager, PasswordStrength,
    PasswordStrengthLevel, SecureString, SecurityConfig, WalletInfo, WalletMetadata,
};
