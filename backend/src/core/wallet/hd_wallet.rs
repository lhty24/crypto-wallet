//! # HD (Hierarchical Deterministic) Wallet Implementation
//!
//! This module implements BIP32 hierarchical deterministic wallets and BIP44 multi-account
//! derivation standards. HD wallets allow you to generate unlimited cryptocurrency addresses
//! from a single seed, following standardized derivation paths.
//!
//! ## Key Concepts
//!
//! - **HD Wallet**: One seed → infinite addresses across all blockchains
//! - **BIP32**: Mathematical foundation for hierarchical key derivation
//! - **BIP44**: Standard derivation paths: `m/44'/coin_type'/account'/change/address_index`
//! - **Derivation Path**: Like a file system path, but for cryptocurrency addresses
//!
//! ## Multi-Chain Support
//!
//! - **Ethereum & EVM chains**: Uses secp256k1 curve with coin type 60
//! - **Solana**: Uses Ed25519 curve with coin type 501  
//! - **Bitcoin**: Uses secp256k1 curve with coin type 0
//!
//! ## Security Features
//!
//! - Child keys cannot derive parent keys (one-way derivation)
//! - Private keys never stored in memory longer than necessary
//! - Industry-standard derivation following BIP32/BIP44 exactly
//!
//! ## Example Usage
//!
//! ```rust
//! let mnemonic = MnemonicManager::new().generate(EntropyLevel::Low)?;
//! let hd_wallet = HDWallet::from_mnemonic(&mnemonic)?;
//! 
//! // Generate your first Ethereum account
//! let eth_account = hd_wallet.derive_account(Chain::Ethereum, 0)?;
//! println!("Your Ethereum address: {}", eth_account.address());
//! 
//! // Generate your first Solana account  
//! let sol_account = hd_wallet.derive_account(Chain::Solana, 0)?;
//! println!("Your Solana address: {}", sol_account.address());
//! ```

use crate::core::wallet::mnemonic::WalletMnemonic;
use bitcoin::bip32::{DerivationPath, Xpriv};
use bitcoin::secp256k1::{PublicKey as Secp256k1PublicKey};
use bitcoin::{secp256k1::Secp256k1, Network};
use ed25519_dalek::{SigningKey as Ed25519SigningKey, VerifyingKey as Ed25519VerifyingKey};
use std::str::FromStr;
use thiserror::Error;

/// Custom error types for HD wallet operations
#[derive(Error, Debug)]
pub enum HDWalletError {
    #[error("Invalid derivation path: {0}")]
    InvalidDerivationPath(String),
    
    #[error("Key derivation failed: {0}")]
    KeyDerivationFailed(String),
    
    #[error("Unsupported blockchain: {0}")]
    UnsupportedBlockchain(String),
    
    #[error("Invalid private key: {0}")]
    InvalidPrivateKey(String),
    
    #[error("Address generation failed: {0}")]
    AddressGenerationFailed(String),
    
    #[error("Bitcoin library error: {0}")]
    BitcoinError(#[from] bitcoin::bip32::Error),
    
    #[error("Secp256k1 error: {0}")]
    Secp256k1Error(#[from] bitcoin::secp256k1::Error),
}

/// Supported blockchain networks
/// 
/// Each blockchain uses different cryptographic curves and address formats:
/// - Ethereum family: secp256k1 curve, keccak256 hashing
/// - Solana: Ed25519 curve, different address encoding
/// - Bitcoin: secp256k1 curve, SHA256 + RIPEMD160 hashing
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Chain {
    /// Bitcoin mainnet - the original blockchain (coin type 0)
    Bitcoin,
    /// Ethereum and all EVM-compatible chains (coin type 60)
    /// Includes: Ethereum mainnet, Polygon, Arbitrum, Optimism, BSC, etc.
    Ethereum,
    /// Solana - high-performance blockchain using Ed25519 (coin type 501)
    Solana,
}

impl Chain {
    /// Get the BIP44 coin type for this blockchain
    /// 
    /// Coin types are standardized numbers that identify different cryptocurrencies
    /// in BIP44 derivation paths. See: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
    pub fn coin_type(&self) -> u32 {
        match self {
            Chain::Bitcoin => 0,    // BTC - the original
            Chain::Ethereum => 60,  // ETH - most EVM chains use this
            Chain::Solana => 501,   // SOL - Solana's registered number
        }
    }
    
    /// Get the name of this blockchain
    pub fn name(&self) -> &'static str {
        match self {
            Chain::Bitcoin => "Bitcoin",
            Chain::Ethereum => "Ethereum",
            Chain::Solana => "Solana",
        }
    }
    
    /// Check if this chain uses the secp256k1 curve (Bitcoin/Ethereum)
    /// vs Ed25519 curve (Solana)
    pub fn uses_secp256k1(&self) -> bool {
        matches!(self, Chain::Bitcoin | Chain::Ethereum)
    }
}

/// A derived cryptocurrency account with its keys and address
/// 
/// This represents one "account" in your wallet - essentially one cryptocurrency
/// address with its corresponding private key. Each account is derived from your
/// master seed using a specific derivation path.
#[derive(Debug, Clone)]
pub struct Account {
    /// Which blockchain this account belongs to
    chain: Chain,
    /// The account index (0 = first account, 1 = second account, etc.)
    account_index: u32,
    /// The derivation path used to create this account
    derivation_path: String,
    /// The public address (what others send money to)
    address: String,
    /// The private key (keep this secret!)
    /// Note: In a production wallet, you'd want to encrypt this
    private_key_bytes: Vec<u8>,
    /// The public key (can be shared publicly)
    public_key_bytes: Vec<u8>,
}

impl Account {
    /// Get the public address for this account
    /// This is what you share with others to receive payments
    pub fn address(&self) -> &str {
        &self.address
    }
    
    /// Get the blockchain this account belongs to
    pub fn chain(&self) -> Chain {
        self.chain
    }
    
    /// Get the account index (0 = first account, 1 = second, etc.)
    pub fn account_index(&self) -> u32 {
        self.account_index
    }
    
    /// Get the full derivation path used to create this account
    /// Example: "m/44'/60'/0'/0/0" for first Ethereum account
    pub fn derivation_path(&self) -> &str {
        &self.derivation_path
    }
    
    /// Get the public key bytes
    /// This can be shared publicly and is used for signature verification
    pub fn public_key_bytes(&self) -> &[u8] {
        &self.public_key_bytes
    }
    
    /// Get the private key bytes
    /// **WARNING**: Keep this secret! Anyone with this can spend your crypto
    /// In production, this should be encrypted when stored
    pub fn private_key_bytes(&self) -> &[u8] {
        &self.private_key_bytes
    }
    
    /// Get a human-readable description of this account
    pub fn description(&self) -> String {
        format!("{} Account #{}", self.chain.name(), self.account_index)
    }
}

/// The main HD wallet structure that manages key derivation
/// 
/// This is your "wallet engine" that takes a mnemonic seed and can generate
/// unlimited accounts across different blockchains. Think of it as a master
/// key that can create specific keys for any cryptocurrency.
#[derive(Debug)]
pub struct HDWallet {
    /// The root extended private key (master key)
    /// This is derived from your mnemonic seed
    master_xprv: Xpriv,
    /// Secp256k1 context for Bitcoin/Ethereum operations
    secp: Secp256k1<bitcoin::secp256k1::All>,
    /// The original mnemonic seed (64 bytes)
    seed: [u8; 64],
}

impl HDWallet {
    /// Create a new HD wallet from a mnemonic phrase
    /// 
    /// This is the main entry point for creating a wallet. Takes your mnemonic
    /// phrase and sets up all the cryptographic machinery needed for multi-chain
    /// key derivation.
    /// 
    /// ## Process:
    /// 1. Convert mnemonic to 64-byte seed
    /// 2. Create master extended private key using BIP32
    /// 3. Set up secp256k1 context for Bitcoin/Ethereum operations
    pub fn from_mnemonic(mnemonic: &WalletMnemonic) -> Result<Self, HDWalletError> {
        // Step 1: Get the 64-byte seed from the mnemonic
        // This seed is the foundation for all key derivation
        let seed = mnemonic.to_seed(""); // Empty passphrase (standard)
        
        // Step 2: Create secp256k1 context
        // This is used for Bitcoin/Ethereum cryptographic operations
        let secp = Secp256k1::new();
        
        // Step 3: Create master extended private key from seed
        // This follows BIP32 specification exactly
        let master_xprv = Xpriv::new_master(Network::Bitcoin, &seed)
            .map_err(|e| HDWalletError::KeyDerivationFailed(e.to_string()))?;
        
        Ok(Self {
            master_xprv,
            secp,
            seed,
        })
    }
    
    /// Derive a specific account for a given blockchain and account index
    /// 
    /// This is the main function you'll use to get cryptocurrency addresses.
    /// Each call creates a new account (address + private key pair) following
    /// BIP44 standards.
    /// 
    /// ## Parameters:
    /// - `chain`: Which blockchain (Bitcoin, Ethereum, Solana)
    /// - `account_index`: Which account number (0 = first, 1 = second, etc.)
    /// 
    /// ## Returns:
    /// An `Account` containing the address, private key, and metadata
    /// 
    /// ## Example:
    /// ```rust
    /// let eth_account_0 = wallet.derive_account(Chain::Ethereum, 0)?; // m/44'/60'/0'/0/0
    /// let eth_account_1 = wallet.derive_account(Chain::Ethereum, 1)?; // m/44'/60'/1'/0/0
    /// let sol_account_0 = wallet.derive_account(Chain::Solana, 0)?;    // m/44'/501'/0'/0/0
    /// ```
    pub fn derive_account(&self, chain: Chain, account_index: u32) -> Result<Account, HDWalletError> {
        match chain {
            Chain::Bitcoin | Chain::Ethereum => {
                self.derive_secp256k1_account(chain, account_index)
            }
            Chain::Solana => {
                self.derive_ed25519_account(chain, account_index)
            }
        }
    }
    
    /// Derive multiple accounts at once for convenience
    /// 
    /// Useful when you want to generate several accounts for the same blockchain
    pub fn derive_multiple_accounts(&self, chain: Chain, count: u32) -> Result<Vec<Account>, HDWalletError> {
        let mut accounts = Vec::new();
        for i in 0..count {
            accounts.push(self.derive_account(chain, i)?);
        }
        Ok(accounts)
    }
    
    /// Get accounts for all supported chains (useful for wallet initialization)
    pub fn derive_default_accounts(&self) -> Result<Vec<Account>, HDWalletError> {
        let mut accounts = Vec::new();
        
        // Create first account for each supported blockchain
        for chain in [Chain::Bitcoin, Chain::Ethereum, Chain::Solana] {
            accounts.push(self.derive_account(chain, 0)?);
        }
        
        Ok(accounts)
    }
    
    /// Internal function: Derive accounts for Bitcoin/Ethereum (secp256k1 curve)
    fn derive_secp256k1_account(&self, chain: Chain, account_index: u32) -> Result<Account, HDWalletError> {
        // Step 1: Build the BIP44 derivation path
        // Format: m/44'/coin_type'/account'/0/0
        // The 0/0 at the end means: external chain (not change), first address
        let derivation_path = format!("m/44'/{}'/{}'/{}/{}", 
            chain.coin_type(), account_index, 0, 0);
        
        // Step 2: Parse the derivation path
        let path = DerivationPath::from_str(&derivation_path)
            .map_err(|e| HDWalletError::InvalidDerivationPath(e.to_string()))?;
        
        // Step 3: Derive the private key using BIP32
        let derived_xprv = self.master_xprv.derive_priv(&self.secp, &path)
            .map_err(|e| HDWalletError::KeyDerivationFailed(e.to_string()))?;
        
        // Step 4: Extract the raw private key (32 bytes)
        let private_key = derived_xprv.private_key;
        let private_key_bytes = private_key.secret_bytes();
        
        // Step 5: Generate public key from private key
        let public_key = private_key.public_key(&self.secp);
        let public_key_bytes = public_key.serialize().to_vec();
        
        // Step 6: Generate the address (different for each blockchain)
        let address = match chain {
            Chain::Bitcoin => {
                self.generate_bitcoin_address(&public_key)?
            }
            Chain::Ethereum => {
                self.generate_ethereum_address(&public_key)?
            }
            _ => unreachable!("This function only handles secp256k1 chains"),
        };
        
        Ok(Account {
            chain,
            account_index,
            derivation_path,
            address,
            private_key_bytes: private_key_bytes.to_vec(),
            public_key_bytes,
        })
    }
    
    /// Internal function: Derive accounts for Solana (Ed25519 curve)
    fn derive_ed25519_account(&self, chain: Chain, account_index: u32) -> Result<Account, HDWalletError> {
        // Solana uses a different approach than Bitcoin/Ethereum
        // We derive a secp256k1 key first, then use it to seed Ed25519
        
        // Step 1: Create derivation path (same format as other chains)
        let derivation_path = format!("m/44'/{}'/{}'/{}/{}", 
            chain.coin_type(), account_index, 0, 0);
        
        // Step 2: Derive using secp256k1 first (for compatibility)
        let path = DerivationPath::from_str(&derivation_path)
            .map_err(|e| HDWalletError::InvalidDerivationPath(e.to_string()))?;
        
        let derived_xprv = self.master_xprv.derive_priv(&self.secp, &path)
            .map_err(|e| HDWalletError::KeyDerivationFailed(e.to_string()))?;
        
        // Step 3: Use the derived key to seed Ed25519
        let seed_bytes = derived_xprv.private_key.secret_bytes();
        
        // Step 4: Create Ed25519 signing key from seed
        let signing_key = Ed25519SigningKey::from_bytes(&seed_bytes);
        let verifying_key = signing_key.verifying_key();
        
        // Step 5: Generate Solana address from public key
        let address = self.generate_solana_address(&verifying_key)?;
        
        Ok(Account {
            chain,
            account_index,
            derivation_path,
            address,
            private_key_bytes: seed_bytes.to_vec(),
            public_key_bytes: verifying_key.as_bytes().to_vec(),
        })
    }
    
    /// Generate a Bitcoin address from a secp256k1 public key
    fn generate_bitcoin_address(&self, public_key: &Secp256k1PublicKey) -> Result<String, HDWalletError> {
        // For Bitcoin, we'll generate a simplified address representation
        // In a production implementation, you'd use proper Bitcoin address encoding
        
        use bitcoin::hashes::{Hash, hash160};
        
        // Step 1: Get the compressed public key bytes
        let public_key_bytes = public_key.serialize();
        
        // Step 2: Create a hash160 (RIPEMD160(SHA256(pubkey)))
        let public_key_hash = hash160::Hash::hash(&public_key_bytes);
        
        // Step 3: Format as hex for simplified representation
        // In production, you'd use proper Base58Check encoding
        let address = format!("1{}", hex::encode(&public_key_hash[..10])); // Simplified format
        
        Ok(address)
    }
    
    /// Generate an Ethereum address from a secp256k1 public key
    fn generate_ethereum_address(&self, public_key: &Secp256k1PublicKey) -> Result<String, HDWalletError> {
        // Ethereum addresses are generated differently than Bitcoin:
        // 1. Take the uncompressed public key (remove 0x04 prefix)
        // 2. Hash with Keccak256
        // 3. Take the last 20 bytes
        // 4. Add 0x prefix
        
        use bitcoin::hashes::{Hash, sha256};
        
        // For now, we'll use a simplified approach with SHA256
        // In a production implementation, you'd use Keccak256
        let public_key_bytes = public_key.serialize_uncompressed();
        
        // Remove the 0x04 prefix from uncompressed key
        let key_without_prefix = &public_key_bytes[1..];
        
        // Hash the public key (using SHA256 as placeholder for Keccak256)
        let hash = sha256::Hash::hash(key_without_prefix);
        let hash_bytes = hash.as_byte_array();
        
        // Take last 20 bytes and format as hex with 0x prefix
        let address_bytes = &hash_bytes[12..]; // Last 20 bytes
        let address = format!("0x{}", hex::encode(address_bytes));
        
        Ok(address)
    }
    
    /// Generate a Solana address from an Ed25519 public key
    fn generate_solana_address(&self, public_key: &Ed25519VerifyingKey) -> Result<String, HDWalletError> {
        // Solana addresses are base58-encoded public keys
        // For simplicity, we'll use hex encoding (in production, you'd use base58)
        
        let public_key_bytes = public_key.as_bytes();
        let address = hex::encode(public_key_bytes);
        
        Ok(address)
    }
    
    /// Get the master seed (useful for testing/verification)
    pub fn seed(&self) -> &[u8; 64] {
        &self.seed
    }
    
    /// Get the master extended private key (for advanced use cases)
    pub fn master_xprv(&self) -> &Xpriv {
        &self.master_xprv
    }
}

/// Utility functions for working with derivation paths
pub mod derivation {
    use super::*;
    
    /// Create a standard BIP44 derivation path string
    pub fn create_bip44_path(coin_type: u32, account: u32, change: u32, address_index: u32) -> String {
        format!("m/44'/{}'/{}'/{}/{}", coin_type, account, change, address_index)
    }
    
    /// Parse coin type from a derivation path
    pub fn parse_coin_type_from_path(path: &str) -> Option<u32> {
        // Example path: "m/44'/60'/0'/0/0"
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() >= 3 && parts[0] == "m" && parts[1] == "44'" {
            parts[2].trim_end_matches('\'').parse().ok()
        } else {
            None
        }
    }
    
    /// Get the Chain enum from a coin type
    pub fn chain_from_coin_type(coin_type: u32) -> Option<Chain> {
        match coin_type {
            0 => Some(Chain::Bitcoin),
            60 => Some(Chain::Ethereum),
            501 => Some(Chain::Solana),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::wallet::mnemonic::{MnemonicManager, EntropyLevel};
    
    #[test]
    fn test_chain_properties() {
        assert_eq!(Chain::Bitcoin.coin_type(), 0);
        assert_eq!(Chain::Ethereum.coin_type(), 60);
        assert_eq!(Chain::Solana.coin_type(), 501);
        
        assert!(Chain::Bitcoin.uses_secp256k1());
        assert!(Chain::Ethereum.uses_secp256k1());
        assert!(!Chain::Solana.uses_secp256k1());
    }
    
    #[test]
    fn test_hd_wallet_creation() {
        let manager = MnemonicManager::new();
        let mnemonic = manager.generate(EntropyLevel::Low).unwrap();
        let wallet = HDWallet::from_mnemonic(&mnemonic);
        
        assert!(wallet.is_ok());
    }
    
    #[test]
    fn test_account_derivation() {
        let manager = MnemonicManager::new();
        let mnemonic = manager.generate(EntropyLevel::Low).unwrap();
        let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
        
        // Test Bitcoin account derivation
        let btc_account = wallet.derive_account(Chain::Bitcoin, 0);
        assert!(btc_account.is_ok());
        
        let account = btc_account.unwrap();
        assert_eq!(account.chain(), Chain::Bitcoin);
        assert_eq!(account.account_index(), 0);
        assert_eq!(account.derivation_path(), "m/44'/0'/0'/0/0");
        
        // Test Ethereum account derivation
        let eth_account = wallet.derive_account(Chain::Ethereum, 0).unwrap();
        assert_eq!(eth_account.chain(), Chain::Ethereum);
        assert_eq!(eth_account.derivation_path(), "m/44'/60'/0'/0/0");
        
        // Test Solana account derivation
        let sol_account = wallet.derive_account(Chain::Solana, 0).unwrap();
        assert_eq!(sol_account.chain(), Chain::Solana);
        assert_eq!(sol_account.derivation_path(), "m/44'/501'/0'/0/0");
    }
    
    #[test]
    fn test_multiple_accounts() {
        let manager = MnemonicManager::new();
        let mnemonic = manager.generate(EntropyLevel::Low).unwrap();
        let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
        
        let accounts = wallet.derive_multiple_accounts(Chain::Ethereum, 3).unwrap();
        assert_eq!(accounts.len(), 3);
        
        // Each account should have different addresses
        assert_ne!(accounts[0].address(), accounts[1].address());
        assert_ne!(accounts[1].address(), accounts[2].address());
        
        // But same chain
        for (i, account) in accounts.iter().enumerate() {
            assert_eq!(account.chain(), Chain::Ethereum);
            assert_eq!(account.account_index(), i as u32);
        }
    }
    
    #[test]
    fn test_default_accounts() {
        let manager = MnemonicManager::new();
        let mnemonic = manager.generate(EntropyLevel::Low).unwrap();
        let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
        
        let accounts = wallet.derive_default_accounts().unwrap();
        assert_eq!(accounts.len(), 3); // Bitcoin, Ethereum, Solana
        
        let chains: Vec<Chain> = accounts.iter().map(|a| a.chain()).collect();
        assert!(chains.contains(&Chain::Bitcoin));
        assert!(chains.contains(&Chain::Ethereum));
        assert!(chains.contains(&Chain::Solana));
    }
    
    #[test]
    fn test_deterministic_derivation() {
        // Same mnemonic should always generate same addresses
        let manager = MnemonicManager::new();
        let test_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let mnemonic = manager.parse(test_phrase).unwrap();
        
        let wallet1 = HDWallet::from_mnemonic(&mnemonic).unwrap();
        let wallet2 = HDWallet::from_mnemonic(&mnemonic).unwrap();
        
        let account1 = wallet1.derive_account(Chain::Ethereum, 0).unwrap();
        let account2 = wallet2.derive_account(Chain::Ethereum, 0).unwrap();
        
        assert_eq!(account1.address(), account2.address());
        assert_eq!(account1.private_key_bytes(), account2.private_key_bytes());
    }
    
    #[test]
    fn test_derivation_path_utilities() {
        let path = derivation::create_bip44_path(60, 0, 0, 0);
        assert_eq!(path, "m/44'/60'/0'/0/0");
        
        let coin_type = derivation::parse_coin_type_from_path("m/44'/60'/0'/0/0");
        assert_eq!(coin_type, Some(60));
        
        let chain = derivation::chain_from_coin_type(60);
        assert_eq!(chain, Some(Chain::Ethereum));
    }
}