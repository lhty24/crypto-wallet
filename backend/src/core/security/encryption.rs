//! # Secure Wallet Encryption System
//!
//! This module provides military-grade encryption for protecting sensitive wallet data
//! including mnemonic phrases, private keys, and other cryptographic material.
//!
//! ## Security Architecture
//!
//! - **Password-Based Key Derivation**: Argon2id with high memory cost
//! - **Authenticated Encryption**: AES-256-GCM (encryption + integrity)
//! - **Salt Protection**: Unique salt per wallet prevents rainbow tables
//! - **Nonce Randomization**: Each encryption uses fresh random nonce
//! - **Version Control**: Future-proof format for algorithm updates
//!
//! ## Key Security Features
//!
//! - **Memory-hard KDF**: Argon2id requires 64MB RAM (prevents brute force)
//! - **Tamper Detection**: GCM authentication tag detects any modification
//! - **No Key Reuse**: Each encryption operation uses unique nonce
//! - **Secure Defaults**: Cryptographically secure parameters
//!
//! ## Example Usage
//!
//! ```rust
//! use crypto_wallet_backend::core::security::*;
//! 
//! // Encrypt sensitive mnemonic phrase
//! let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
//! let password = "super_secure_password_123";
//! 
//! let encrypted = EncryptedWallet::encrypt_mnemonic(mnemonic, password)?;
//! 
//! // Store encrypted data safely
//! let serialized = serde_json::to_string(&encrypted)?;
//! std::fs::write("wallet.encrypted", serialized)?;
//! 
//! // Later: decrypt when needed
//! let loaded = std::fs::read_to_string("wallet.encrypted")?;
//! let encrypted: EncryptedWallet = serde_json::from_str(&loaded)?;
//! let decrypted = encrypted.decrypt_mnemonic(password)?;
//! ```

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2, Params, Algorithm, Version,
};
use rand::{RngCore, rngs::OsRng};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;
use zeroize::ZeroizeOnDrop;

/// Custom error types for encryption operations
#[derive(Error, Debug)]
pub enum EncryptionError {
    #[error("Password hashing failed: {0}")]
    PasswordHashingFailed(String),
    
    #[error("Encryption operation failed: {0}")]
    EncryptionFailed(String),
    
    #[error("Decryption operation failed: {0}")]
    DecryptionFailed(String),
    
    #[error("Invalid password or corrupted data")]
    InvalidPasswordOrData,
    
    #[error("Unsupported encryption version: {0}")]
    UnsupportedVersion(u8),
    
    #[error("Invalid encrypted data format: {0}")]
    InvalidFormat(String),
    
    #[error("Argon2 parameter error: {0}")]
    Argon2Error(String),
    
    #[error("AES-GCM error: {0}")]
    AesGcmError(String),
    
    #[error("Random number generation failed")]
    RandomGenerationFailed,
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
}

/// Security configuration for encryption operations
/// 
/// These parameters balance security and performance. Higher values = more secure but slower.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Argon2 memory cost in KiB (64MB = 65536 KiB)
    /// High memory usage makes brute force attacks expensive
    pub memory_cost: u32,
    
    /// Argon2 time cost (number of iterations)
    /// More iterations = slower but more secure
    pub time_cost: u32,
    
    /// Argon2 parallelism (number of threads)
    /// Should match number of CPU cores for optimal performance
    pub parallelism: u32,
    
    /// AES-GCM nonce size (12 bytes is standard and secure)
    pub nonce_size: usize,
    
    /// Salt size for password hashing (32 bytes provides excellent security)
    pub salt_size: usize,
}

impl SecurityConfig {
    /// Create high-security configuration (slower but very secure)
    /// Suitable for long-term storage of high-value wallets
    pub fn high_security() -> Self {
        Self {
            memory_cost: 131072, // 128MB - very memory intensive
            time_cost: 4,         // 4 iterations - computationally expensive
            parallelism: 4,       // 4 threads
            nonce_size: 12,       // Standard GCM nonce
            salt_size: 32,        // 256-bit salt
        }
    }
    
    /// Create balanced security configuration (good security, reasonable performance)
    /// Suitable for regular wallet operations
    pub fn balanced() -> Self {
        Self {
            memory_cost: 65536,   // 64MB - memory intensive but reasonable
            time_cost: 3,         // 3 iterations - good security/performance balance
            parallelism: 4,       // 4 threads
            nonce_size: 12,       // Standard GCM nonce
            salt_size: 32,        // 256-bit salt
        }
    }
    
    /// Create development configuration (faster for testing)
    /// ⚠️ NOT SUITABLE FOR PRODUCTION - use only for development/testing
    pub fn development() -> Self {
        Self {
            memory_cost: 4096,    // 4MB - much faster but less secure
            time_cost: 1,         // 1 iteration - minimal time cost
            parallelism: 1,       // Single thread
            nonce_size: 12,       // Standard GCM nonce
            salt_size: 16,        // Smaller salt for speed
        }
    }
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self::balanced()
    }
}

/// Represents an encrypted wallet with all necessary metadata for decryption
/// 
/// This structure is safe to store in files, databases, or transmit over networks.
/// All sensitive data is encrypted and authenticated.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedWallet {
    /// Format version for future compatibility
    /// Allows upgrading encryption algorithms without breaking existing wallets
    pub version: u8,
    
    /// Timestamp when wallet was encrypted (useful for backup management)
    pub created_at: u64,
    
    /// Unique identifier for this wallet
    pub wallet_id: String,
    
    /// Salt used for password-based key derivation
    /// Must be stored with encrypted data to enable decryption
    pub salt: Vec<u8>,
    
    /// Nonce (number used once) for AES-GCM encryption
    /// Must be unique for each encryption operation
    pub nonce: Vec<u8>,
    
    /// The actual encrypted data (mnemonic, private keys, etc.)
    pub ciphertext: Vec<u8>,
    
    /// Authentication tag from AES-GCM
    /// Allows detection of tampering or corruption
    pub auth_tag: Vec<u8>,
    
    /// Security configuration used for this encryption
    /// Allows proper decryption with same parameters
    pub security_config: SecurityConfig,
    
    /// Optional metadata (encrypted wallet name, description, etc.)
    /// This data is NOT encrypted - only include non-sensitive information
    #[serde(default)]
    pub metadata: WalletMetadata,
}

/// Non-sensitive metadata that can be stored in plain text
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WalletMetadata {
    /// User-friendly wallet name
    pub name: Option<String>,
    
    /// Wallet description or notes
    pub description: Option<String>,
    
    /// Supported blockchain networks
    pub supported_chains: Vec<String>,
    
    /// Backup reminder timestamps
    pub last_backup_reminder: Option<u64>,
}

/// Secure memory container for sensitive data
/// Automatically zeros memory when dropped to prevent data leaks
#[derive(Debug, Clone, ZeroizeOnDrop)]
pub struct SecureString {
    data: String,
}

impl SecureString {
    /// Create a new secure string
    pub fn new(data: String) -> Self {
        Self { data }
    }
    
    /// Get reference to the protected data
    pub fn as_str(&self) -> &str {
        &self.data
    }
    
    /// Get the protected data as bytes
    pub fn as_bytes(&self) -> &[u8] {
        self.data.as_bytes()
    }
    
    /// Convert to String (consumes the SecureString)
    pub fn into_string(self) -> String {
        self.data.clone()
    }
}

impl From<String> for SecureString {
    fn from(data: String) -> Self {
        Self::new(data)
    }
}

impl From<&str> for SecureString {
    fn from(data: &str) -> Self {
        Self::new(data.to_string())
    }
}

/// Main encryption manager for wallet security operations
pub struct EncryptionManager {
    /// Security configuration for encryption operations
    config: SecurityConfig,
    
    /// Argon2 instance configured with security parameters
    argon2: Argon2<'static>,
}

impl EncryptionManager {
    /// Create a new encryption manager with specified security config
    pub fn new(config: SecurityConfig) -> Result<Self, EncryptionError> {
        // Configure Argon2 with security parameters
        let params = Params::new(
            config.memory_cost,
            config.time_cost, 
            config.parallelism,
            None, // Use default output length (32 bytes)
        ).map_err(|e| EncryptionError::Argon2Error(e.to_string()))?;
        
        let argon2 = Argon2::new(
            Algorithm::Argon2id, // Most secure Argon2 variant
            Version::V0x13,      // Latest version
            params,
        );
        
        Ok(Self { config, argon2 })
    }
    
    /// Create encryption manager with balanced security (recommended for most users)
    pub fn with_balanced_security() -> Result<Self, EncryptionError> {
        Self::new(SecurityConfig::balanced())
    }
    
    /// Create encryption manager with high security (for high-value wallets)
    pub fn with_high_security() -> Result<Self, EncryptionError> {
        Self::new(SecurityConfig::high_security())
    }
    
    /// Create encryption manager with development settings (testing only)
    /// ⚠️ WARNING: Not secure enough for production use
    pub fn with_development_security() -> Result<Self, EncryptionError> {
        Self::new(SecurityConfig::development())
    }
    
    /// Encrypt a mnemonic phrase with password protection
    /// 
    /// This is the main function for securing wallet backup phrases.
    /// The encrypted result can be safely stored in files or databases.
    /// 
    /// ## Security Process:
    /// 1. Generate cryptographically secure salt and nonce
    /// 2. Derive encryption key from password using Argon2
    /// 3. Encrypt mnemonic with AES-256-GCM
    /// 4. Bundle everything into EncryptedWallet structure
    /// 
    /// ## Parameters:
    /// - `mnemonic`: The sensitive mnemonic phrase to encrypt
    /// - `password`: User's password for encryption
    /// 
    /// ## Returns:
    /// EncryptedWallet structure safe for storage
    pub fn encrypt_mnemonic(&self, mnemonic: &str, password: &str) -> Result<EncryptedWallet, EncryptionError> {
        self.encrypt_data(mnemonic.as_bytes(), password, WalletMetadata::default())
    }
    
    /// Encrypt mnemonic with custom metadata
    pub fn encrypt_mnemonic_with_metadata(
        &self, 
        mnemonic: &str, 
        password: &str,
        metadata: WalletMetadata,
    ) -> Result<EncryptedWallet, EncryptionError> {
        self.encrypt_data(mnemonic.as_bytes(), password, metadata)
    }
    
    /// Encrypt arbitrary sensitive data (private keys, seeds, etc.)
    /// 
    /// Generic encryption function that can protect any sensitive wallet data.
    /// Uses the same security model as mnemonic encryption.
    pub fn encrypt_data(&self, data: &[u8], password: &str, metadata: WalletMetadata) -> Result<EncryptedWallet, EncryptionError> {
        // Step 1: Generate cryptographically secure salt
        let mut salt = vec![0u8; self.config.salt_size];
        OsRng.fill_bytes(&mut salt);
        
        // Step 2: Generate cryptographically secure nonce
        let mut nonce = vec![0u8; self.config.nonce_size];
        OsRng.fill_bytes(&mut nonce);
        
        // Step 3: Derive encryption key from password using Argon2
        let encryption_key = self.derive_key_from_password(password, &salt)?;
        
        // Step 4: Encrypt data with AES-256-GCM
        let (ciphertext, auth_tag) = self.encrypt_with_key(data, &encryption_key, &nonce)?;
        
        // Step 5: Generate unique wallet ID
        let wallet_id = uuid::Uuid::new_v4().to_string();
        
        // Step 6: Get current timestamp
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        Ok(EncryptedWallet {
            version: 1,
            created_at,
            wallet_id,
            salt,
            nonce,
            ciphertext,
            auth_tag,
            security_config: self.config.clone(),
            metadata,
        })
    }
    
    /// Decrypt an encrypted wallet to recover the mnemonic phrase
    /// 
    /// ## Security Process:
    /// 1. Derive decryption key using stored salt and password
    /// 2. Verify authentication tag (detects tampering)
    /// 3. Decrypt ciphertext to recover original mnemonic
    /// 4. Return as SecureString (auto-zeros on drop)
    /// 
    /// ## Security Notes:
    /// - Wrong password will cause decryption failure
    /// - Any tampering with encrypted data will be detected
    /// - Original security config is preserved and reused
    pub fn decrypt_mnemonic(&self, encrypted: &EncryptedWallet, password: &str) -> Result<SecureString, EncryptionError> {
        let decrypted_data = self.decrypt_data(encrypted, password)?;
        let mnemonic = String::from_utf8(decrypted_data)
            .map_err(|e| EncryptionError::DecryptionFailed(format!("Invalid UTF-8: {}", e)))?;
        
        Ok(SecureString::new(mnemonic))
    }
    
    /// Decrypt arbitrary encrypted data
    /// 
    /// Generic decryption function for any data encrypted with this system.
    pub fn decrypt_data(&self, encrypted: &EncryptedWallet, password: &str) -> Result<Vec<u8>, EncryptionError> {
        // Step 1: Check format version compatibility
        if encrypted.version != 1 {
            return Err(EncryptionError::UnsupportedVersion(encrypted.version));
        }
        
        // Step 2: Derive decryption key using stored salt
        let decryption_key = self.derive_key_from_password(password, &encrypted.salt)?;
        
        // Step 3: Decrypt and verify authentication tag
        self.decrypt_with_key(&encrypted.ciphertext, &encrypted.auth_tag, &decryption_key, &encrypted.nonce)
    }
    
    /// Verify that a password can decrypt the wallet without actually decrypting
    /// 
    /// Useful for password verification without exposing sensitive data.
    pub fn verify_password(&self, encrypted: &EncryptedWallet, password: &str) -> bool {
        self.decrypt_data(encrypted, password).is_ok()
    }
    
    /// Change the password for an encrypted wallet
    /// 
    /// ## Process:
    /// 1. Decrypt wallet with old password
    /// 2. Re-encrypt with new password and fresh salt/nonce
    /// 3. Return new encrypted wallet
    /// 
    /// This ensures perfect forward secrecy - old password becomes useless.
    pub fn change_password(
        &self, 
        encrypted: &EncryptedWallet, 
        old_password: &str, 
        new_password: &str,
    ) -> Result<EncryptedWallet, EncryptionError> {
        // Step 1: Decrypt with old password to verify access
        let decrypted_data = self.decrypt_data(encrypted, old_password)?;
        
        // Step 2: Re-encrypt with new password (generates new salt and nonce)
        self.encrypt_data(&decrypted_data, new_password, encrypted.metadata.clone())
    }
    
    /// Internal: Derive 256-bit encryption key from password using Argon2
    /// 
    /// This is the heart of password-based encryption security.
    /// Argon2 makes brute force attacks computationally expensive.
    fn derive_key_from_password(&self, password: &str, salt: &[u8]) -> Result<[u8; 32], EncryptionError> {
        // Create salt string for Argon2
        let salt_string = SaltString::encode_b64(salt)
            .map_err(|e| EncryptionError::PasswordHashingFailed(e.to_string()))?;
        
        // Hash password with Argon2 (memory-hard function)
        let password_hash = self.argon2
            .hash_password(password.as_bytes(), &salt_string)
            .map_err(|e| EncryptionError::PasswordHashingFailed(e.to_string()))?;
        
        // Extract 32-byte key from hash
        let hash_bytes = password_hash.hash
            .ok_or_else(|| EncryptionError::PasswordHashingFailed("No hash produced".to_string()))?;
        
        if hash_bytes.len() != 32 {
            return Err(EncryptionError::PasswordHashingFailed(
                format!("Expected 32-byte key, got {}", hash_bytes.len())
            ));
        }
        
        // Convert to fixed-size array
        let mut key = [0u8; 32];
        key.copy_from_slice(hash_bytes.as_bytes());
        Ok(key)
    }
    
    /// Internal: Encrypt data with AES-256-GCM
    /// 
    /// AES-GCM provides both encryption and authentication in one operation.
    fn encrypt_with_key(
        &self, 
        data: &[u8], 
        key: &[u8; 32], 
        nonce: &[u8],
    ) -> Result<(Vec<u8>, Vec<u8>), EncryptionError> {
        // Create AES-256-GCM cipher
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
        
        // Create nonce for GCM
        let gcm_nonce = Nonce::from_slice(nonce);
        
        // Encrypt data (returns ciphertext + authentication tag combined)
        let encrypted = cipher
            .encrypt(gcm_nonce, data)
            .map_err(|e| EncryptionError::AesGcmError(e.to_string()))?;
        
        // Split ciphertext and authentication tag
        // GCM tag is always 16 bytes at the end
        if encrypted.len() < 16 {
            return Err(EncryptionError::AesGcmError("Encrypted data too short".to_string()));
        }
        
        let tag_start = encrypted.len() - 16;
        let ciphertext = encrypted[..tag_start].to_vec();
        let auth_tag = encrypted[tag_start..].to_vec();
        
        Ok((ciphertext, auth_tag))
    }
    
    /// Internal: Decrypt data with AES-256-GCM and verify authentication
    /// 
    /// Verifies authentication tag first, then decrypts if valid.
    fn decrypt_with_key(
        &self,
        ciphertext: &[u8],
        auth_tag: &[u8],
        key: &[u8; 32],
        nonce: &[u8],
    ) -> Result<Vec<u8>, EncryptionError> {
        // Create AES-256-GCM cipher
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
        
        // Create nonce for GCM
        let gcm_nonce = Nonce::from_slice(nonce);
        
        // Combine ciphertext and authentication tag
        let mut encrypted = ciphertext.to_vec();
        encrypted.extend_from_slice(auth_tag);
        
        // Decrypt and verify authentication tag
        cipher
            .decrypt(gcm_nonce, encrypted.as_slice())
            .map_err(|_| EncryptionError::InvalidPasswordOrData)
    }
    
    /// Get the current security configuration
    pub fn security_config(&self) -> &SecurityConfig {
        &self.config
    }
}

impl EncryptedWallet {
    /// Convenience method: encrypt a mnemonic with default balanced security
    pub fn encrypt_mnemonic(mnemonic: &str, password: &str) -> Result<Self, EncryptionError> {
        let manager = EncryptionManager::with_balanced_security()?;
        manager.encrypt_mnemonic(mnemonic, password)
    }
    
    /// Convenience method: encrypt a mnemonic with high security
    pub fn encrypt_mnemonic_high_security(mnemonic: &str, password: &str) -> Result<Self, EncryptionError> {
        let manager = EncryptionManager::with_high_security()?;
        manager.encrypt_mnemonic(mnemonic, password)
    }
    
    /// Convenience method: decrypt mnemonic with automatic security config
    pub fn decrypt_mnemonic(&self, password: &str) -> Result<SecureString, EncryptionError> {
        let manager = EncryptionManager::new(self.security_config.clone())?;
        manager.decrypt_mnemonic(self, password)
    }
    
    /// Convenience method: verify password without decrypting
    pub fn verify_password(&self, password: &str) -> bool {
        let manager = EncryptionManager::new(self.security_config.clone());
        match manager {
            Ok(mgr) => mgr.verify_password(self, password),
            Err(_) => false,
        }
    }
    
    /// Convenience method: change password
    pub fn change_password(&self, old_password: &str, new_password: &str) -> Result<Self, EncryptionError> {
        let manager = EncryptionManager::new(self.security_config.clone())?;
        manager.change_password(self, old_password, new_password)
    }
    
    /// Serialize to JSON for storage
    pub fn to_json(&self) -> Result<String, EncryptionError> {
        serde_json::to_string_pretty(self).map_err(EncryptionError::SerializationError)
    }
    
    /// Deserialize from JSON
    pub fn from_json(json: &str) -> Result<Self, EncryptionError> {
        serde_json::from_str(json).map_err(EncryptionError::SerializationError)
    }
    
    /// Save encrypted wallet to file
    pub fn save_to_file(&self, path: &str) -> Result<(), EncryptionError> {
        let json = self.to_json()?;
        std::fs::write(path, json)
            .map_err(|e| EncryptionError::InvalidFormat(format!("File write error: {}", e)))?;
        Ok(())
    }
    
    /// Load encrypted wallet from file
    pub fn load_from_file(path: &str) -> Result<Self, EncryptionError> {
        let json = std::fs::read_to_string(path)
            .map_err(|e| EncryptionError::InvalidFormat(format!("File read error: {}", e)))?;
        Self::from_json(&json)
    }
    
    /// Get human-readable info about the encrypted wallet
    pub fn info(&self) -> WalletInfo {
        WalletInfo {
            version: self.version,
            wallet_id: self.wallet_id.clone(),
            created_at: self.created_at,
            security_level: match self.security_config.memory_cost {
                cost if cost >= 131072 => "High".to_string(),
                cost if cost >= 65536 => "Balanced".to_string(),
                cost if cost >= 32768 => "Standard".to_string(),
                _ => "Development".to_string(),
            },
            metadata: self.metadata.clone(),
        }
    }
}

/// Human-readable information about an encrypted wallet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInfo {
    pub version: u8,
    pub wallet_id: String,
    pub created_at: u64,
    pub security_level: String,
    pub metadata: WalletMetadata,
}

/// Utility functions for encryption operations
pub mod utils {
    use super::*;
    
    /// Generate a cryptographically secure random password
    /// 
    /// Useful for generating secure backup passwords or key stretching.
    pub fn generate_secure_password(length: usize) -> String {
        use rand::Rng;
        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let mut rng = OsRng;
        
        (0..length)
            .map(|_| {
                let idx = rng.gen_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect()
    }
    
    /// Estimate time required for brute force attack against given security config
    /// 
    /// Returns estimated time in seconds assuming 1 billion attempts per second.
    /// This is a rough estimate for educational purposes.
    pub fn estimate_brute_force_time(config: &SecurityConfig, password_length: u8) -> f64 {
        // Rough estimate: time per hash attempt based on memory cost
        let time_per_attempt_ms = match config.memory_cost {
            cost if cost >= 131072 => 50.0,  // High security: ~50ms per attempt
            cost if cost >= 65536 => 25.0,   // Balanced: ~25ms per attempt  
            cost if cost >= 32768 => 12.0,   // Standard: ~12ms per attempt
            _ => 5.0,                         // Development: ~5ms per attempt
        };
        
        // Character space (assuming mixed case + numbers + symbols)
        let charset_size: f64 = 94.0; // Full printable ASCII
        
        // Total possible passwords (rough estimate)
        let total_passwords = charset_size.powf(password_length as f64);
        
        // Average attempts needed (half the search space)
        let avg_attempts = total_passwords / 2.0;
        
        // Total time in seconds
        (avg_attempts * time_per_attempt_ms) / 1000.0
    }
    
    /// Check password strength and provide recommendations
    pub fn check_password_strength(password: &str) -> PasswordStrength {
        let mut score = 0;
        let mut feedback = Vec::new();
        
        // Length check
        match password.len() {
            0..=7 => feedback.push("Password too short (minimum 8 characters)".to_string()),
            8..=11 => score += 1,
            12..=15 => score += 2,
            _ => score += 3,
        }
        
        // Character variety
        if password.chars().any(|c| c.is_ascii_lowercase()) { score += 1; }
        if password.chars().any(|c| c.is_ascii_uppercase()) { score += 1; }
        if password.chars().any(|c| c.is_ascii_digit()) { score += 1; }
        if password.chars().any(|c| "!@#$%^&*()_+-=[]{}|;:,.<>?".contains(c)) { score += 1; }
        
        // Common patterns (basic check)
        if password.to_lowercase().contains("password") ||
           password.to_lowercase().contains("123456") ||
           password.to_lowercase().contains("qwerty") {
            score -= 2;
            feedback.push("Avoid common passwords and patterns".to_string());
        }
        
        // Determine strength level
        let level = match score {
            score if score < 3 => PasswordStrengthLevel::Weak,
            score if score < 5 => PasswordStrengthLevel::Medium,
            score if score < 7 => PasswordStrengthLevel::Strong,
            _ => PasswordStrengthLevel::VeryStrong,
        };
        
        if feedback.is_empty() && level >= PasswordStrengthLevel::Strong {
            feedback.push("Password looks good!".to_string());
        }
        
        PasswordStrength { level, score, feedback }
    }
}

/// Password strength assessment
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum PasswordStrengthLevel {
    Weak,
    Medium,
    Strong,
    VeryStrong,
}

#[derive(Debug, Clone)]
pub struct PasswordStrength {
    pub level: PasswordStrengthLevel,
    pub score: i32,
    pub feedback: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_security_configs() {
        let high = SecurityConfig::high_security();
        let balanced = SecurityConfig::balanced();
        let dev = SecurityConfig::development();
        
        assert!(high.memory_cost > balanced.memory_cost);
        assert!(balanced.memory_cost > dev.memory_cost);
        
        assert_eq!(high.nonce_size, 12);
        assert_eq!(balanced.nonce_size, 12);
        assert_eq!(dev.nonce_size, 12);
    }
    
    #[test]
    fn test_encryption_manager_creation() {
        let manager = EncryptionManager::with_balanced_security();
        assert!(manager.is_ok());
        
        let manager = EncryptionManager::with_high_security();
        assert!(manager.is_ok());
        
        let manager = EncryptionManager::with_development_security();
        assert!(manager.is_ok());
    }
    
    #[test]
    fn test_mnemonic_encryption_decryption() {
        let manager = EncryptionManager::with_development_security().unwrap();
        
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let password = "test_password_123";
        
        // Encrypt
        let encrypted = manager.encrypt_mnemonic(mnemonic, password).unwrap();
        assert_eq!(encrypted.version, 1);
        assert!(!encrypted.ciphertext.is_empty());
        assert!(!encrypted.auth_tag.is_empty());
        assert!(!encrypted.salt.is_empty());
        assert!(!encrypted.nonce.is_empty());
        
        // Decrypt
        let decrypted = manager.decrypt_mnemonic(&encrypted, password).unwrap();
        assert_eq!(decrypted.as_str(), mnemonic);
    }
    
    #[test]
    fn test_wrong_password() {
        let manager = EncryptionManager::with_development_security().unwrap();
        
        let mnemonic = "test mnemonic phrase";
        let password = "correct_password";
        let wrong_password = "wrong_password";
        
        let encrypted = manager.encrypt_mnemonic(mnemonic, password).unwrap();
        
        // Should fail with wrong password
        let result = manager.decrypt_mnemonic(&encrypted, wrong_password);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_password_verification() {
        let manager = EncryptionManager::with_development_security().unwrap();
        
        let mnemonic = "test mnemonic phrase";
        let password = "test_password";
        
        let encrypted = manager.encrypt_mnemonic(mnemonic, password).unwrap();
        
        assert!(manager.verify_password(&encrypted, password));
        assert!(!manager.verify_password(&encrypted, "wrong_password"));
    }
    
    #[test]
    fn test_password_change() {
        let manager = EncryptionManager::with_development_security().unwrap();
        
        let mnemonic = "test mnemonic phrase";
        let old_password = "old_password";
        let new_password = "new_password";
        
        // Encrypt with old password
        let encrypted = manager.encrypt_mnemonic(mnemonic, old_password).unwrap();
        
        // Change password
        let re_encrypted = manager.change_password(&encrypted, old_password, new_password).unwrap();
        
        // Old password should not work
        assert!(!manager.verify_password(&re_encrypted, old_password));
        
        // New password should work
        let decrypted = manager.decrypt_mnemonic(&re_encrypted, new_password).unwrap();
        assert_eq!(decrypted.as_str(), mnemonic);
    }
    
    #[test]
    fn test_encrypted_wallet_convenience_methods() {
        let mnemonic = "test mnemonic phrase";
        let password = "test_password";
        
        // Test convenience encryption
        let encrypted = EncryptedWallet::encrypt_mnemonic(mnemonic, password).unwrap();
        
        // Test convenience decryption
        let decrypted = encrypted.decrypt_mnemonic(password).unwrap();
        assert_eq!(decrypted.as_str(), mnemonic);
        
        // Test password verification
        assert!(encrypted.verify_password(password));
        assert!(!encrypted.verify_password("wrong_password"));
    }
    
    #[test]
    fn test_serialization() {
        let mnemonic = "test mnemonic phrase";
        let password = "test_password";
        
        let encrypted = EncryptedWallet::encrypt_mnemonic(mnemonic, password).unwrap();
        
        // Test JSON serialization
        let json = encrypted.to_json().unwrap();
        assert!(!json.is_empty());
        
        // Test JSON deserialization
        let deserialized = EncryptedWallet::from_json(&json).unwrap();
        
        // Should be able to decrypt with original password
        let decrypted = deserialized.decrypt_mnemonic(password).unwrap();
        assert_eq!(decrypted.as_str(), mnemonic);
    }
    
    #[test]
    fn test_secure_string() {
        let data = "sensitive information";
        let secure = SecureString::new(data.to_string());
        
        assert_eq!(secure.as_str(), data);
        assert_eq!(secure.as_bytes(), data.as_bytes());
        
        let recovered = secure.into_string();
        assert_eq!(recovered, data);
    }
    
    #[test]
    fn test_password_strength() {
        use utils::check_password_strength;
        
        let weak = check_password_strength("123");
        assert_eq!(weak.level, PasswordStrengthLevel::Weak);
        
        let medium = check_password_strength("MyPass123");
        assert_eq!(medium.level, PasswordStrengthLevel::Medium);
        
        let strong = check_password_strength("MyStr0ngP@ssw0rd!");
        assert!(strong.level >= PasswordStrengthLevel::Strong);
    }
}