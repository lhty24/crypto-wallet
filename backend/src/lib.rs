//! # Crypto Wallet Backend
//! 
//! A secure, multi-chain cryptocurrency wallet backend implementation.
//! 
//! ## Features
//! - HD (Hierarchical Deterministic) wallet support following BIP32/BIP44 standards
//! - BIP39 mnemonic phrase generation and validation
//! - Multi-chain support (Ethereum, Solana, and more)
//! - Secure key storage with AES-256-GCM encryption
//! - Industry-standard cryptographic implementations
//! 
//! ## Security
//! - Private keys never exposed in plaintext
//! - Cryptographically secure random number generation
//! - Memory-safe Rust implementation
//! - Comprehensive testing of all cryptographic functions

// Public modules for the wallet core functionality
pub mod core;

// API modules for external communication (will be added later)
pub mod api;
