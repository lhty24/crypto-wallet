//! # BIP39 Mnemonic Phrase Implementation
//!
//! This module implements BIP39 (Bitcoin Improvement Proposal 39) mnemonic phrase generation
//! and validation. BIP39 is the industry standard for creating human-readable backup phrases
//! that can restore cryptocurrency wallets.
//!
//! ## Key Concepts
//!
//! - **Entropy**: Cryptographically secure random data (128-256 bits)
//! - **Mnemonic**: Human-readable words derived from entropy (12-24 words)
//! - **Seed**: Cryptographic seed derived from mnemonic + optional passphrase
//! - **Checksum**: Built-in error detection in the mnemonic phrase
//!
//! ## Security Features
//!
//! - Cryptographically secure random number generation
//! - Built-in checksum validation prevents typos
//! - Standard BIP39 wordlist (2048 words) in multiple languages
//! - Configurable entropy levels (128, 160, 192, 224, 256 bits)

use bip39::{Language, Mnemonic};
use rand::{rngs::OsRng, RngCore};
use thiserror::Error;

/// Custom error types for mnemonic operations
#[derive(Error, Debug)]
pub enum MnemonicError {
    #[error("Invalid entropy length: {0} bits. Must be 128, 160, 192, 224, or 256 bits")]
    InvalidEntropyLength(usize),
    
    #[error("Invalid mnemonic phrase: {0}")]
    InvalidMnemonic(String),
    
    #[error("Entropy generation failed")]
    EntropyGenerationFailed,
    
    #[error("Mnemonic validation failed: {0}")]
    ValidationFailed(String),
}

/// Supported entropy levels for mnemonic generation
/// 
/// Higher entropy = more words = more security, but harder to write down
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntropyLevel {
    /// 128 bits entropy = 12 words (minimum recommended)
    /// Security: ~2^128 combinations (very secure)
    /// Use case: Standard personal wallets
    Low = 128,
    
    /// 160 bits entropy = 15 words
    /// Security: ~2^160 combinations (extremely secure)
    /// Use case: High-value personal wallets
    Medium = 160,
    
    /// 192 bits entropy = 18 words
    /// Security: ~2^192 combinations (overkill for most users)
    /// Use case: Institutional or paranoid users
    High = 192,
    
    /// 224 bits entropy = 21 words
    /// Security: ~2^224 combinations (military-grade)
    /// Use case: Ultra-high-value or long-term storage
    VeryHigh = 224,
    
    /// 256 bits entropy = 24 words (maximum)
    /// Security: ~2^256 combinations (NSA-level)
    /// Use case: Nation-state level security requirements
    Maximum = 256,
}

impl EntropyLevel {
    /// Get the entropy size in bytes
    pub fn bytes(&self) -> usize {
        (*self as usize) / 8
    }
    
    /// Get the expected word count for this entropy level
    pub fn word_count(&self) -> usize {
        match self {
            EntropyLevel::Low => 12,
            EntropyLevel::Medium => 15,
            EntropyLevel::High => 18,
            EntropyLevel::VeryHigh => 21,
            EntropyLevel::Maximum => 24,
        }
    }
}

/// Main structure for handling BIP39 mnemonic operations
/// 
/// This is your interface for all mnemonic-related functionality:
/// - Generate new mnemonics with configurable security levels
/// - Validate existing mnemonics (checking for typos/corruption)
/// - Convert mnemonics to cryptographic seeds for key derivation
/// - Support multiple languages (English default, others available)
pub struct MnemonicManager {
    /// Language for the mnemonic wordlist
    /// English is universal standard, but others supported for localization
    language: Language,
}

impl MnemonicManager {
    /// Create a new mnemonic manager with English wordlist (standard)
    /// 
    /// English is the most widely supported language across all wallets
    /// and should be used unless you specifically need localization.
    pub fn new() -> Self {
        Self {
            language: Language::English,
        }
    }
    
    /// Create a mnemonic manager with a specific language
    /// 
    /// Supported languages: English, Japanese, Korean, Spanish, Chinese (Simplified/Traditional), French, Italian, Czech
    /// 
    /// **Warning**: Non-English mnemonics may not be compatible with all wallets!
    pub fn with_language(language: Language) -> Self {
        Self { language }
    }
    
    /// Generate a new cryptographically secure mnemonic phrase
    /// 
    /// This is the main function you'll use to create new wallets.
    /// 
    /// ## Process:
    /// 1. Generate cryptographically secure random entropy
    /// 2. Add checksum bits (built into BIP39 spec)
    /// 3. Convert to mnemonic words using BIP39 wordlist
    /// 4. Return human-readable phrase
    /// 
    /// ## Example:
    /// ```rust
    /// let manager = MnemonicManager::new();
    /// let mnemonic = manager.generate(EntropyLevel::Low)?;  // 12 words
    /// println!("Your backup phrase: {}", mnemonic.phrase());
    /// ```
    pub fn generate(&self, entropy_level: EntropyLevel) -> Result<WalletMnemonic, MnemonicError> {
        // Step 1: Generate cryptographically secure entropy
        let entropy_bytes = entropy_level.bytes();
        let mut entropy = vec![0u8; entropy_bytes];
        
        // Use OS random number generator (cryptographically secure)
        // This pulls from /dev/urandom on Unix, CryptGenRandom on Windows
        OsRng.fill_bytes(&mut entropy);
        
        // Validate we got the entropy we expected
        if entropy.len() != entropy_bytes {
            return Err(MnemonicError::EntropyGenerationFailed);
        }
        
        // Step 2: Create BIP39 mnemonic from entropy
        // The bip39 crate handles checksum calculation and word conversion
        let mnemonic = Mnemonic::from_entropy_in(self.language, &entropy)
            .map_err(|e| MnemonicError::InvalidMnemonic(e.to_string()))?;
        
        // Step 3: Wrap in our custom structure for additional functionality
        Ok(WalletMnemonic::new(mnemonic, entropy_level))
    }
    
    /// Parse and validate an existing mnemonic phrase
    /// 
    /// Use this when a user wants to import an existing wallet.
    /// This function will:
    /// - Check that all words are in the BIP39 wordlist
    /// - Validate the built-in checksum
    /// - Detect common typos or corruption
    /// 
    /// ## Example:
    /// ```rust
    /// let manager = MnemonicManager::new();
    /// let phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    /// let mnemonic = manager.parse(phrase)?;
    /// ```
    pub fn parse(&self, phrase: &str) -> Result<WalletMnemonic, MnemonicError> {
        // Reject mnemonics with double spaces
        if phrase.contains("  ") {
            return Err(MnemonicError::InvalidMnemonic("Invalid whitespace formatting".to_string()));
        }
        
        // Trim whitespace and normalize the input
        let normalized_phrase = phrase.trim();
        
        // Parse and validate the mnemonic
        let mnemonic = Mnemonic::parse_in(self.language, normalized_phrase)
            .map_err(|e| MnemonicError::InvalidMnemonic(format!("Parse error: {}", e)))?;
        
        // Determine entropy level from word count
        let word_count = mnemonic.word_count();
        let entropy_level = match word_count {
            12 => EntropyLevel::Low,
            15 => EntropyLevel::Medium,
            18 => EntropyLevel::High,
            21 => EntropyLevel::VeryHigh,
            24 => EntropyLevel::Maximum,
            _ => return Err(MnemonicError::InvalidMnemonic(
                format!("Unsupported word count: {}. Must be 12, 15, 18, 21, or 24 words", word_count)
            )),
        };
        
        Ok(WalletMnemonic::new(mnemonic, entropy_level))
    }
    
    /// Validate a mnemonic phrase without creating a WalletMnemonic object
    /// 
    /// Quick validation function for checking user input without creating objects.
    /// Returns true if the mnemonic is valid, false otherwise.
    pub fn validate(&self, phrase: &str) -> bool {
        self.parse(phrase).is_ok()
    }
    
    /// Check if a word is in the BIP39 wordlist
    /// 
    /// Useful for auto-completion or real-time validation in UIs
    pub fn is_valid_word(&self, word: &str) -> bool {
        bip39::Language::English.word_list().contains(&word)
    }
    
    /// Get all possible words starting with a prefix (for auto-completion)
    /// 
    /// Returns up to `limit` words that start with the given prefix.
    /// Useful for implementing auto-complete in user interfaces.
    pub fn words_starting_with(&self, prefix: &str, limit: usize) -> Vec<String> {
        if prefix.is_empty() {
            return Vec::new();
        }
        
        let wordlist = self.language.word_list();
        let mut matches = Vec::new();
        
        // BIP39 wordlist has 2048 words, we'll search through them
        for word in wordlist.iter() {
            if matches.len() >= limit {
                break;
            }
            
            if word.starts_with(&prefix.to_lowercase()) {
                matches.push(word.to_string());
            }
        }
        
        matches
    }
}

/// A wrapper around the BIP39 mnemonic with additional wallet-specific functionality
/// 
/// This structure provides a safe, convenient interface for working with mnemonic phrases
/// in the context of cryptocurrency wallets.
#[derive(Debug, Clone)]
pub struct WalletMnemonic {
    /// The underlying BIP39 mnemonic
    mnemonic: Mnemonic,
    
    /// The entropy level used to generate this mnemonic
    entropy_level: EntropyLevel,
}

impl WalletMnemonic {
    /// Create a new WalletMnemonic from a BIP39 mnemonic
    fn new(mnemonic: Mnemonic, entropy_level: EntropyLevel) -> Self {
        Self {
            mnemonic,
            entropy_level,
        }
    }
    
    /// Get the mnemonic phrase as a string
    /// 
    /// This is what users will write down for backup.
    /// 
    /// **Security Note**: Be careful when logging or displaying this!
    /// Consider masking it in production UIs.
    pub fn phrase(&self) -> String {
        self.mnemonic.to_string()
    }
    
    /// Get the entropy level of this mnemonic
    pub fn entropy_level(&self) -> EntropyLevel {
        self.entropy_level
    }
    
    /// Get the number of words in this mnemonic
    pub fn word_count(&self) -> usize {
        self.mnemonic.word_count()
    }
    
    /// Get the language of this mnemonic
    pub fn language(&self) -> Language {
        self.mnemonic.language()
    }
    
    /// Convert the mnemonic to a cryptographic seed for key derivation
    /// 
    /// This is the bridge between your human-readable backup phrase and
    /// the cryptographic material used to generate private keys.
    /// 
    /// ## Parameters:
    /// - `passphrase`: Optional additional security. Most users leave this empty.
    ///   Adding a passphrase creates a "25th word" that isn't part of the mnemonic.
    ///   
    /// ## Security Notes:
    /// - If you add a passphrase, you MUST remember it or your funds are lost
    /// - The same mnemonic + different passphrases = completely different wallets
    /// - Most users should use an empty passphrase ("")
    /// 
    /// ## Returns:
    /// A 64-byte (512-bit) seed that can be used for HD key derivation
    pub fn to_seed(&self, passphrase: &str) -> [u8; 64] {
        self.mnemonic.to_seed(passphrase)
    }
    
    /// Get the original entropy bytes that were used to create this mnemonic
    /// 
    /// This is mainly useful for testing and debugging. In normal operation,
    /// you should use `to_seed()` instead.
    pub fn entropy(&self) -> Vec<u8> {
        self.mnemonic.to_entropy()
    }
    
    /// Validate that this mnemonic is correctly formed
    /// 
    /// Checks:
    /// - All words are in the BIP39 wordlist
    /// - Checksum is valid
    /// - Word count matches entropy level
    pub fn validate(&self) -> Result<(), MnemonicError> {
        // The bip39 crate automatically validates when parsing,
        // but we'll add our own checks here for completeness
        
        let expected_word_count = self.entropy_level.word_count();
        let actual_word_count = self.word_count();
        
        if expected_word_count != actual_word_count {
            return Err(MnemonicError::ValidationFailed(
                format!(
                    "Word count mismatch: expected {} words for {:?} entropy, got {}",
                    expected_word_count, self.entropy_level, actual_word_count
                )
            ));
        }
        
        // If we got here, the mnemonic is valid
        Ok(())
    }
    
    /// Generate a secure display version of the mnemonic for UIs
    /// 
    /// Returns the mnemonic with word numbers for easy verification:
    /// "1. abandon 2. abandon 3. abandon ..."
    /// 
    /// This format helps users verify they've written down words correctly.
    pub fn numbered_display(&self) -> String {
        let phrase = self.phrase();
        let words: Vec<&str> = phrase.split(' ').collect();
        words
            .iter()
            .enumerate()
            .map(|(i, word)| format!("{}. {}", i + 1, word))
            .collect::<Vec<_>>()
            .join(" ")
    }
    
    /// Check if two mnemonics are equivalent (same seed)
    /// 
    /// Two mnemonics are equivalent if they generate the same seed,
    /// even if they have different languages or entropy levels.
    pub fn is_equivalent(&self, other: &WalletMnemonic, passphrase: &str) -> bool {
        self.to_seed(passphrase) == other.to_seed(passphrase)
    }
}

impl Default for MnemonicManager {
    /// Create a default MnemonicManager with English language
    fn default() -> Self {
        Self::new()
    }
}

// Implement common traits for convenience

impl std::fmt::Display for WalletMnemonic {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.phrase())
    }
}

impl std::str::FromStr for WalletMnemonic {
    type Err = MnemonicError;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        MnemonicManager::new().parse(s)
    }
}

/// Utility functions for working with mnemonics

/// Generate a test mnemonic for development and testing
/// 
/// **WARNING**: Never use this for production! This generates a deterministic
/// mnemonic that is NOT cryptographically secure.
/// 
/// This is the famous "abandon abandon abandon..." mnemonic used in many
/// cryptocurrency tutorials and tests.
pub fn generate_test_mnemonic() -> WalletMnemonic {
    let manager = MnemonicManager::new();
    // This is the standard test mnemonic - well-known and should never be used for real funds
    let test_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    manager.parse(test_phrase).expect("Test mnemonic should always be valid")
}

/// Generate entropy for a given entropy level
/// 
/// This is a lower-level function for when you need the raw entropy bytes
/// rather than a mnemonic phrase.
pub fn generate_entropy(entropy_level: EntropyLevel) -> Result<Vec<u8>, MnemonicError> {
    let mut entropy = vec![0u8; entropy_level.bytes()];
    OsRng.fill_bytes(&mut entropy);
    Ok(entropy)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entropy_levels() {
        assert_eq!(EntropyLevel::Low.bytes(), 16);
        assert_eq!(EntropyLevel::Low.word_count(), 12);
        
        assert_eq!(EntropyLevel::Maximum.bytes(), 32);
        assert_eq!(EntropyLevel::Maximum.word_count(), 24);
    }

    #[test]
    fn test_mnemonic_generation() {
        let manager = MnemonicManager::new();
        
        // Test each entropy level
        for level in [EntropyLevel::Low, EntropyLevel::Medium, EntropyLevel::High, 
                     EntropyLevel::VeryHigh, EntropyLevel::Maximum] {
            let mnemonic = manager.generate(level).unwrap();
            assert_eq!(mnemonic.word_count(), level.word_count());
            assert_eq!(mnemonic.entropy_level(), level);
        }
    }

    #[test]
    fn test_test_mnemonic() {
        let mnemonic = generate_test_mnemonic();
        assert_eq!(mnemonic.word_count(), 12);
        assert!(mnemonic.phrase().starts_with("abandon abandon"));
    }

    #[test]
    fn test_mnemonic_validation() {
        let manager = MnemonicManager::new();
        
        // Valid test mnemonic
        let valid = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        assert!(manager.validate(valid));
        
        // Invalid mnemonic (wrong checksum)
        let invalid = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
        assert!(!manager.validate(invalid));
    }

    #[test]
    fn test_seed_generation() {
        let mnemonic = generate_test_mnemonic();
        let seed1 = mnemonic.to_seed("");
        let seed2 = mnemonic.to_seed("passphrase");
        
        // Same mnemonic, different passphrases = different seeds
        assert_ne!(seed1, seed2);
        assert_eq!(seed1.len(), 64);
        assert_eq!(seed2.len(), 64);
    }
}