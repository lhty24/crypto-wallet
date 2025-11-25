//! Security-related functionality
//! 
//! Contains encryption, key derivation, and other security utilities.

pub mod encryption;

// Re-export commonly used types for convenience
pub use encryption::{
    EncryptionManager,
    EncryptedWallet,
    SecurityConfig,
    WalletMetadata,
    SecureString,
    EncryptionError,
    WalletInfo,
    PasswordStrength,
    PasswordStrengthLevel,
    utils,
};