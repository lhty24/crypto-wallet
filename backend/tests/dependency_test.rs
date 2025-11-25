//! Dependency verification tests
//! 
//! These tests verify that all our cryptographic dependencies are properly installed
//! and can perform basic operations. This is crucial for ensuring our foundation is solid.

use bip39::{Mnemonic, Language};
use bitcoin::secp256k1::{Secp256k1, SecretKey, PublicKey};
use bitcoin::hashes::{Hash, sha256};
use ed25519_dalek::{SigningKey, Signature, Signer, Verifier};
use aes_gcm::{Aes256Gcm, Nonce, KeyInit};
use aes_gcm::aead::Aead; // This trait provides encrypt/decrypt methods
use argon2::{Argon2, PasswordHasher, PasswordVerifier, PasswordHash};
use argon2::password_hash::SaltString;
use rand::{rngs::OsRng, RngCore};

#[test]
fn test_bip39_basic_functionality() {
    println!("🧪 Testing BIP39 mnemonic generation...");
    
    // Generate entropy (randomness) for a 12-word mnemonic
    let mut entropy = [0u8; 16]; // 16 bytes = 128 bits = 12 words
    rand::thread_rng().fill_bytes(&mut entropy);
    
    // Create mnemonic from entropy
    let mnemonic = Mnemonic::from_entropy(&entropy).expect("Failed to create mnemonic");
    
    // Verify it's exactly 12 words
    assert_eq!(mnemonic.word_count(), 12);
    
    // Test that we can parse it back
    let phrase = mnemonic.to_string();
    let parsed_mnemonic = Mnemonic::parse_in(Language::English, &phrase)
        .expect("Failed to parse mnemonic phrase");
    
    assert_eq!(mnemonic.to_string(), parsed_mnemonic.to_string());
    
    println!("✅ BIP39 test passed! Generated 12-word mnemonic successfully.");
}

#[test]
fn test_secp256k1_signatures() {
    println!("🧪 Testing secp256k1 cryptography (used by Ethereum/Bitcoin)...");
    
    let secp = Secp256k1::new();
    
    // Generate a random private key (this is what controls your crypto!)
    let secret_key = SecretKey::new(&mut OsRng);
    
    // Derive public key from private key (this becomes your address)
    let public_key = PublicKey::from_secret_key(&secp, &secret_key);
    
    // Test message signing (like signing a transaction)
    let message = b"Hello, blockchain!";
    let message_hash = sha256::Hash::hash(message);
    
    // Sign the message
    let signature = secp.sign_ecdsa(&message_hash.into(), &secret_key);
    
    // Verify the signature
    let verification_result = secp.verify_ecdsa(&message_hash.into(), &signature, &public_key);
    assert!(verification_result.is_ok());
    
    println!("✅ secp256k1 test passed! Successfully created keys and signed message.");
}

#[test]
fn test_ed25519_signatures() {
    println!("🧪 Testing Ed25519 cryptography (used by Solana)...");
    
    // Generate Solana-compatible signing key
    let mut csprng = OsRng{};
    let signing_key: SigningKey = SigningKey::generate(&mut csprng);
    
    // Test message to sign
    let message: &[u8] = b"Solana transaction data";
    
    // Sign the message
    let signature: Signature = signing_key.sign(message);
    
    // Get the verifying key (public key)
    let verifying_key = signing_key.verifying_key();
    
    // Verify the signature
    let verification_result = verifying_key.verify(message, &signature);
    assert!(verification_result.is_ok());
    
    println!("✅ Ed25519 test passed! Successfully created Solana-compatible signatures.");
}

#[test]
fn test_aes_encryption() {
    println!("🧪 Testing AES-256-GCM encryption (for storing private keys)...");
    
    // This is how we'll encrypt private keys before storing them
    let key = Aes256Gcm::generate_key(OsRng);
    let cipher = Aes256Gcm::new(&key);
    let nonce = Nonce::from_slice(b"unique nonce"); // 12 bytes
    
    // Sensitive data to encrypt (like a private key)
    let sensitive_data = b"super secret private key data";
    
    // Encrypt the data
    let ciphertext = cipher.encrypt(nonce, sensitive_data.as_ref())
        .expect("encryption failure!");
    
    // Decrypt the data
    let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
        .expect("decryption failure!");
    
    assert_eq!(&plaintext, sensitive_data);
    
    println!("✅ AES encryption test passed! Successfully encrypted and decrypted data.");
}

#[test]
fn test_argon2_password_hashing() {
    println!("🧪 Testing Argon2 password hashing (for deriving encryption keys)...");
    
    let password = b"user_password_123";
    
    // Generate a random salt for this password
    let salt = SaltString::generate(&mut OsRng);
    
    // Configure Argon2 for security (these settings balance security vs performance)
    let argon2 = Argon2::default();
    
    // Hash the password - this is what we'll use to derive encryption keys
    let password_hash = argon2.hash_password(password, &salt)
        .expect("Failed to hash password");
    
    // Verify the password matches by parsing the hash and verifying
    let hash_string = password_hash.to_string();
    let parsed_hash = PasswordHash::new(&hash_string)
        .expect("Failed to parse hash");
    let verification_result = argon2.verify_password(password, &parsed_hash);
    assert!(verification_result.is_ok());
    
    println!("✅ Argon2 test passed! Successfully hashed and verified password.");
}

#[test]
fn test_integration_crypto_workflow() {
    println!("🧪 Testing integrated crypto workflow...");
    
    // This simulates the complete workflow of creating a wallet:
    
    // 1. Generate mnemonic phrase
    let mut entropy = [0u8; 32]; // 32 bytes = 256 bits = 24 words (more secure)
    rand::thread_rng().fill_bytes(&mut entropy);
    let mnemonic = Mnemonic::from_entropy(&entropy).expect("Failed to create mnemonic");
    
    // 2. Derive seed from mnemonic (this becomes our master secret)
    let seed = mnemonic.to_seed("");
    
    // 3. Use seed for key generation (Bitcoin/Ethereum style)
    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&seed[0..32]).expect("Invalid seed");
    let _public_key = PublicKey::from_secret_key(&secp, &secret_key);
    
    // 4. Simulate encrypting the mnemonic for storage
    let key = Aes256Gcm::generate_key(OsRng);
    let cipher = Aes256Gcm::new(&key);
    let nonce = Nonce::from_slice(b"unique nonce");
    let encrypted_mnemonic = cipher.encrypt(nonce, mnemonic.to_string().as_bytes())
        .expect("encryption failure!");
    
    // 5. Verify we can decrypt it back
    let decrypted_bytes = cipher.decrypt(nonce, encrypted_mnemonic.as_ref())
        .expect("decryption failure!");
    let decrypted_mnemonic = String::from_utf8(decrypted_bytes)
        .expect("Invalid UTF-8");
    
    assert_eq!(mnemonic.to_string(), decrypted_mnemonic);
    
    println!("✅ Integration test passed! Complete crypto workflow working.");
    println!("   📝 Generated {}-word mnemonic", mnemonic.word_count());
    println!("   🔐 Created public/private key pair");
    println!("   🛡️ Successfully encrypted and decrypted sensitive data");
}

/// Helper test to show what our dependency tree looks like
#[test]
fn test_dependency_info() {
    println!("\n📦 Crypto Wallet Dependencies Overview:");
    println!("   🔤 BIP39: Mnemonic phrase generation and validation");
    println!("   🗝️  Bitcoin: HD wallet and key derivation (BIP32/BIP44)");  
    println!("   🔒 secp256k1: Elliptic curve crypto for Ethereum/Bitcoin");
    println!("   🔑 ed25519-dalek: Digital signatures for Solana");
    println!("   🛡️ aes-gcm: AES-256-GCM encryption for secure storage");
    println!("   🔐 argon2: Password hashing and key derivation");
    println!("   🎲 rand: Cryptographically secure random number generation");
    println!("   🔧 Supporting utilities: hex, uuid, serde, tokio, error handling");
    println!("\n   ✅ All dependencies ready for wallet implementation!\n");
}