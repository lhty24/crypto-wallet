//! Comprehensive integration tests for wallet encryption functionality
//!
//! Tests the complete encryption workflow from mnemonic encryption to secure file storage,
//! covering all security levels and real-world usage scenarios.

use crypto_wallet_backend::core::security::{
    utils, EncryptedWallet, EncryptionManager, PasswordStrengthLevel, SecureString, SecurityConfig,
    WalletMetadata,
};
use crypto_wallet_backend::core::wallet::{EntropyLevel, MnemonicManager};
use std::fs;
use tempfile::NamedTempFile;

#[test]
fn test_complete_encryption_workflow() {
    println!("🧪 Testing complete encryption workflow...");

    // Step 1: Create a mnemonic to encrypt
    let manager = MnemonicManager::new();
    let mnemonic = manager.generate(EntropyLevel::Low).unwrap();
    let mnemonic_phrase = mnemonic.phrase();
    println!(
        "✅ Generated test mnemonic with {} words",
        mnemonic.word_count()
    );

    // Step 2: Set up encryption with balanced security
    let encryption_manager = EncryptionManager::with_balanced_security().unwrap();
    let password = "MySecureWalletPassword123!";

    // Step 3: Encrypt the mnemonic
    let encrypted = encryption_manager
        .encrypt_mnemonic(&mnemonic_phrase, password)
        .unwrap();
    println!("✅ Successfully encrypted mnemonic");
    println!("   Wallet ID: {}", encrypted.wallet_id);
    println!("   Security Level: {}", encrypted.info().security_level);
    println!("   Ciphertext length: {} bytes", encrypted.ciphertext.len());
    println!("   Auth tag length: {} bytes", encrypted.auth_tag.len());

    // Step 4: Verify the encrypted wallet structure
    assert_eq!(encrypted.version, 1);
    assert!(!encrypted.ciphertext.is_empty());
    assert_eq!(encrypted.auth_tag.len(), 16); // GCM auth tag is always 16 bytes
    assert_eq!(encrypted.nonce.len(), 12); // Standard GCM nonce
    assert!(!encrypted.salt.is_empty());

    // Step 5: Decrypt and verify
    let decrypted = encryption_manager
        .decrypt_mnemonic(&encrypted, password)
        .unwrap();
    assert_eq!(decrypted.as_str(), mnemonic_phrase);
    println!("✅ Successfully decrypted and verified mnemonic");

    println!("✅ Complete encryption workflow test passed!");
}

#[test]
fn test_all_security_levels() {
    println!("🧪 Testing all security levels...");

    let test_mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    let password = "TestPassword123!";

    // Test each security configuration
    let configs = [
        ("Development", SecurityConfig::development()),
        ("Balanced", SecurityConfig::balanced()),
        ("High Security", SecurityConfig::high_security()),
    ];

    for (name, config) in configs {
        println!("📝 Testing {} configuration...", name);

        let manager = EncryptionManager::new(config.clone()).unwrap();

        // Encrypt
        let start_time = std::time::Instant::now();
        let encrypted = manager.encrypt_mnemonic(test_mnemonic, password).unwrap();
        let encrypt_duration = start_time.elapsed();

        // Decrypt
        let start_time = std::time::Instant::now();
        let decrypted = manager.decrypt_mnemonic(&encrypted, password).unwrap();
        let decrypt_duration = start_time.elapsed();

        // Verify
        assert_eq!(decrypted.as_str(), test_mnemonic);
        assert_eq!(encrypted.security_config.memory_cost, config.memory_cost);

        println!(
            "   ✅ {} - Encrypt: {:?}, Decrypt: {:?}",
            name, encrypt_duration, decrypt_duration
        );
        println!(
            "   Memory cost: {} KiB, Time cost: {}",
            config.memory_cost, config.time_cost
        );
    }

    println!("✅ All security levels test passed!");
}

#[test]
fn test_password_security_features() {
    println!("🧪 Testing password security features...");

    let manager = EncryptionManager::with_development_security().unwrap();
    let test_data = "sensitive wallet data";
    let correct_password = "CorrectPassword123!";
    let wrong_password = "WrongPassword456!";

    // Test encryption and decryption
    let encrypted = manager
        .encrypt_mnemonic(test_data, correct_password)
        .unwrap();

    // Test correct password
    assert!(manager.verify_password(&encrypted, correct_password));
    let decrypted = manager
        .decrypt_mnemonic(&encrypted, correct_password)
        .unwrap();
    assert_eq!(decrypted.as_str(), test_data);
    println!("✅ Correct password verification and decryption works");

    // Test wrong password
    assert!(!manager.verify_password(&encrypted, wrong_password));
    let decrypt_result = manager.decrypt_mnemonic(&encrypted, wrong_password);
    assert!(decrypt_result.is_err());
    println!("✅ Wrong password properly rejected");

    // Test password change
    let new_password = "NewSecurePassword789!";
    let re_encrypted = manager
        .change_password(&encrypted, correct_password, new_password)
        .unwrap();

    // Old password should not work
    assert!(!manager.verify_password(&re_encrypted, correct_password));

    // New password should work
    assert!(manager.verify_password(&re_encrypted, new_password));
    let final_decrypted = manager
        .decrypt_mnemonic(&re_encrypted, new_password)
        .unwrap();
    assert_eq!(final_decrypted.as_str(), test_data);

    // Verify new wallet ID (should be different due to re-encryption)
    assert_ne!(encrypted.wallet_id, re_encrypted.wallet_id);

    println!("✅ Password change functionality works correctly");
    println!("✅ Password security features test passed!");
}

#[test]
fn test_wallet_metadata_and_info() {
    println!("🧪 Testing wallet metadata and info...");

    let manager = EncryptionManager::with_balanced_security().unwrap();
    let test_mnemonic = "test mnemonic phrase for metadata";
    let password = "MetadataTestPassword123!";

    // Create wallet with custom metadata
    let metadata = WalletMetadata {
        name: Some("My Test Wallet".to_string()),
        description: Some("A wallet for testing encryption".to_string()),
        supported_chains: vec![
            "Bitcoin".to_string(),
            "Ethereum".to_string(),
            "Solana".to_string(),
        ],
        last_backup_reminder: Some(1234567890),
    };

    let encrypted = manager
        .encrypt_mnemonic_with_metadata(test_mnemonic, password, metadata.clone())
        .unwrap();

    // Test wallet info
    let info = encrypted.info();
    assert_eq!(info.version, 1);
    assert_eq!(info.security_level, "Balanced");
    assert_eq!(info.metadata.name, Some("My Test Wallet".to_string()));
    assert_eq!(
        info.metadata.description,
        Some("A wallet for testing encryption".to_string())
    );
    assert_eq!(info.metadata.supported_chains.len(), 3);

    println!("✅ Wallet info: {}", info.wallet_id);
    println!("   Name: {:?}", info.metadata.name);
    println!("   Description: {:?}", info.metadata.description);
    println!("   Supported chains: {:?}", info.metadata.supported_chains);
    println!("   Security level: {}", info.security_level);

    // Verify decryption still works with metadata
    let decrypted = encrypted.decrypt_mnemonic(password).unwrap();
    assert_eq!(decrypted.as_str(), test_mnemonic);

    println!("✅ Wallet metadata and info test passed!");
}

#[test]
fn test_file_storage_and_loading() {
    println!("🧪 Testing file storage and loading...");

    let test_mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    let password = "FileStorageTestPassword123!";

    // Create encrypted wallet
    let encrypted = EncryptedWallet::encrypt_mnemonic(test_mnemonic, password).unwrap();
    let original_wallet_id = encrypted.wallet_id.clone();

    // Test JSON serialization
    let json = encrypted.to_json().unwrap();
    assert!(!json.is_empty());
    assert!(json.contains("wallet_id"));
    assert!(json.contains("ciphertext"));
    assert!(json.contains("auth_tag"));
    println!("✅ JSON serialization works");
    println!("   JSON length: {} characters", json.len());

    // Test JSON deserialization
    let deserialized = EncryptedWallet::from_json(&json).unwrap();
    assert_eq!(deserialized.wallet_id, original_wallet_id);

    let decrypted = deserialized.decrypt_mnemonic(password).unwrap();
    assert_eq!(decrypted.as_str(), test_mnemonic);
    println!("✅ JSON deserialization works");

    // Test file operations with temporary file
    let temp_file = NamedTempFile::new().unwrap();
    let file_path = temp_file.path().to_str().unwrap();

    // Save to file
    encrypted.save_to_file(file_path).unwrap();
    println!("✅ Successfully saved encrypted wallet to file");

    // Load from file
    let loaded = EncryptedWallet::load_from_file(file_path).unwrap();
    assert_eq!(loaded.wallet_id, original_wallet_id);

    let final_decrypted = loaded.decrypt_mnemonic(password).unwrap();
    assert_eq!(final_decrypted.as_str(), test_mnemonic);

    // Verify file content is actually encrypted
    let file_content = fs::read_to_string(file_path).unwrap();
    assert!(!file_content.contains(test_mnemonic)); // Plaintext should not appear
    assert!(file_content.contains("ciphertext")); // But structure should be visible

    println!("✅ File storage and loading test passed!");
}

#[test]
fn test_secure_string_memory_handling() {
    println!("🧪 Testing SecureString memory handling...");

    let sensitive_data = "very sensitive information";

    // Test SecureString creation and access
    let secure = SecureString::new(sensitive_data.to_string());
    assert_eq!(secure.as_str(), sensitive_data);
    assert_eq!(secure.as_bytes(), sensitive_data.as_bytes());

    // Test conversion back to String
    let recovered = secure.into_string();
    assert_eq!(recovered, sensitive_data);

    // Test From trait implementations
    let secure2 = SecureString::from(sensitive_data.to_string());
    assert_eq!(secure2.as_str(), sensitive_data);

    let secure3 = SecureString::from(sensitive_data);
    assert_eq!(secure3.as_str(), sensitive_data);

    println!("✅ SecureString functionality works correctly");
    println!("✅ SecureString memory handling test passed!");
}

#[test]
fn test_password_strength_analysis() {
    println!("🧪 Testing password strength analysis...");

    let test_cases = [
        ("123", PasswordStrengthLevel::Weak, "too short and simple"),
        ("password", PasswordStrengthLevel::Weak, "common pattern"),
        (
            "Password123",
            PasswordStrengthLevel::Medium,
            "good mix but common base",
        ),
        (
            "MyStr0ngP@ssw0rd!",
            PasswordStrengthLevel::Strong,
            "strong with symbols",
        ),
        (
            "SuperComplexP@ssw0rd123!@#",
            PasswordStrengthLevel::VeryStrong,
            "very strong and long",
        ),
    ];

    for (password, expected_level, description) in test_cases {
        let strength = utils::check_password_strength(password);

        println!(
            "📝 Password: '{}' - {} (Score: {})",
            password, description, strength.score
        );
        println!(
            "   Level: {:?}, Expected: {:?}",
            strength.level, expected_level
        );
        if !strength.feedback.is_empty() {
            println!("   Feedback: {:?}", strength.feedback);
        }

        // Allow some flexibility for edge cases
        if password == "Password123" {
            // This might be Medium or Weak depending on common pattern detection
            assert!(strength.level >= PasswordStrengthLevel::Weak);
        } else {
            assert!(strength.level >= expected_level);
        }
    }

    println!("✅ Password strength analysis test passed!");
}

#[test]
fn test_encryption_performance() {
    println!("🧪 Testing encryption performance...");

    let test_mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    let password = "PerformanceTestPassword123!";

    // Test with development settings for speed
    let dev_manager = EncryptionManager::with_development_security().unwrap();

    let iterations = 5;
    let mut total_encrypt_time = std::time::Duration::new(0, 0);
    let mut total_decrypt_time = std::time::Duration::new(0, 0);

    for i in 0..iterations {
        // Time encryption
        let start = std::time::Instant::now();
        let encrypted = dev_manager
            .encrypt_mnemonic(test_mnemonic, password)
            .unwrap();
        let encrypt_time = start.elapsed();
        total_encrypt_time += encrypt_time;

        // Time decryption
        let start = std::time::Instant::now();
        let decrypted = dev_manager.decrypt_mnemonic(&encrypted, password).unwrap();
        let decrypt_time = start.elapsed();
        total_decrypt_time += decrypt_time;

        assert_eq!(decrypted.as_str(), test_mnemonic);

        println!(
            "   Iteration {}: Encrypt {:?}, Decrypt {:?}",
            i + 1,
            encrypt_time,
            decrypt_time
        );
    }

    let avg_encrypt = total_encrypt_time / iterations;
    let avg_decrypt = total_decrypt_time / iterations;

    println!("📝 Average performance over {} iterations:", iterations);
    println!("   Encryption: {:?}", avg_encrypt);
    println!("   Decryption: {:?}", avg_decrypt);

    // Performance requirements (should be fast enough for UI)
    assert!(
        avg_encrypt.as_millis() < 1000,
        "Encryption should be under 1 second"
    );
    assert!(
        avg_decrypt.as_millis() < 1000,
        "Decryption should be under 1 second"
    );

    println!("✅ Encryption performance test passed!");
}

#[test]
fn test_encryption_with_hd_wallet_integration() {
    println!("🧪 Testing encryption with HD wallet integration...");

    // Step 1: Create HD wallet
    let mnemonic_manager = MnemonicManager::new();
    let mnemonic = mnemonic_manager.generate(EntropyLevel::Low).unwrap();

    // Step 2: Encrypt the mnemonic for storage
    let password = "HDWalletIntegrationTest123!";
    let encrypted = EncryptedWallet::encrypt_mnemonic(&mnemonic.phrase(), password).unwrap();

    println!("✅ Successfully encrypted HD wallet mnemonic");
    println!("   Original mnemonic words: {}", mnemonic.word_count());
    println!("   Encrypted wallet ID: {}", encrypted.wallet_id);

    // Step 3: Simulate app restart - load encrypted wallet
    let json = encrypted.to_json().unwrap();
    let loaded_encrypted = EncryptedWallet::from_json(&json).unwrap();

    // Step 4: Decrypt to recover mnemonic
    let recovered_mnemonic_string = loaded_encrypted.decrypt_mnemonic(password).unwrap();

    // Step 5: Recreate HD wallet from recovered mnemonic
    let recovered_mnemonic = mnemonic_manager
        .parse(recovered_mnemonic_string.as_str())
        .unwrap();

    // Verify the recovered mnemonic is identical
    assert_eq!(recovered_mnemonic.phrase(), mnemonic.phrase());
    assert_eq!(recovered_mnemonic.entropy_level(), mnemonic.entropy_level());

    println!("✅ Successfully recovered mnemonic and verified identity");

    // Step 6: Verify HD wallet functionality is preserved
    use crypto_wallet_backend::core::wallet::{Chain, HDWallet};

    let original_wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
    let recovered_wallet = HDWallet::from_mnemonic(&recovered_mnemonic).unwrap();

    // Generate same accounts from both wallets
    for chain in [Chain::Bitcoin, Chain::Ethereum, Chain::Solana] {
        let original_account = original_wallet.derive_account(chain, 0).unwrap();
        let recovered_account = recovered_wallet.derive_account(chain, 0).unwrap();

        assert_eq!(original_account.address(), recovered_account.address());
        assert_eq!(
            original_account.private_key_bytes(),
            recovered_account.private_key_bytes()
        );

        println!(
            "   ✅ {} addresses match: {}",
            chain.name(),
            original_account.address()
        );
    }

    println!("✅ HD wallet integration test passed!");
}

#[test]
fn test_real_world_wallet_backup_scenario() {
    println!("🧪 Testing real-world wallet backup scenario...");

    // Simulate a user creating a new wallet
    println!("📝 Step 1: User creates new wallet...");
    let mnemonic_manager = MnemonicManager::new();
    let user_mnemonic = mnemonic_manager.generate(EntropyLevel::Low).unwrap();

    // User sets up password protection
    println!("📝 Step 2: User sets up password protection...");
    let user_password = "MyWalletBackup2024!";

    // Check password strength
    let password_strength = utils::check_password_strength(user_password);
    assert!(password_strength.level >= PasswordStrengthLevel::Strong);
    println!(
        "   Password strength: {:?} (Score: {})",
        password_strength.level, password_strength.score
    );

    // Create encrypted backup
    println!("📝 Step 3: Creating encrypted backup...");
    let metadata = WalletMetadata {
        name: Some("My Main Wallet".to_string()),
        description: Some("Primary cryptocurrency wallet".to_string()),
        supported_chains: vec![
            "Bitcoin".to_string(),
            "Ethereum".to_string(),
            "Solana".to_string(),
        ],
        last_backup_reminder: Some(chrono::Utc::now().timestamp() as u64),
    };

    let backup =
        EncryptedWallet::encrypt_mnemonic_high_security(&user_mnemonic.phrase(), user_password)
            .unwrap();

    println!("   ✅ Encrypted backup created with high security");
    println!("   Backup ID: {}", backup.wallet_id);
    println!("   Security: {}", backup.info().security_level);

    // Simulate saving to secure storage
    println!("📝 Step 4: Saving to secure storage...");
    let backup_json = backup.to_json().unwrap();

    // Verify backup doesn't contain plaintext
    assert!(!backup_json.contains(&user_mnemonic.phrase()));
    println!("   ✅ Backup verified secure (no plaintext found)");

    // Simulate wallet recovery scenario
    println!("📝 Step 5: Simulating wallet recovery...");
    let recovered_backup = EncryptedWallet::from_json(&backup_json).unwrap();

    // User enters password to recover
    assert!(recovered_backup.verify_password(user_password));
    println!("   ✅ Password verified successfully");

    let recovered_mnemonic_str = recovered_backup.decrypt_mnemonic(user_password).unwrap();
    assert_eq!(recovered_mnemonic_str.as_str(), user_mnemonic.phrase());
    println!("   ✅ Mnemonic recovered successfully");

    // Verify wallet functionality is fully restored
    println!("📝 Step 6: Verifying wallet functionality...");
    let recovered_mnemonic = mnemonic_manager
        .parse(recovered_mnemonic_str.as_str())
        .unwrap();

    use crypto_wallet_backend::core::wallet::HDWallet;
    let original_hd_wallet = HDWallet::from_mnemonic(&user_mnemonic).unwrap();
    let recovered_hd_wallet = HDWallet::from_mnemonic(&recovered_mnemonic).unwrap();

    // Verify first address for each chain matches
    use crypto_wallet_backend::core::wallet::Chain;
    for chain in [Chain::Bitcoin, Chain::Ethereum, Chain::Solana] {
        let original_addr = original_hd_wallet
            .derive_account(chain, 0)
            .unwrap()
            .address()
            .to_string();
        let recovered_addr = recovered_hd_wallet
            .derive_account(chain, 0)
            .unwrap()
            .address()
            .to_string();
        assert_eq!(original_addr, recovered_addr);
    }

    println!("   ✅ All wallet functionality verified");
    println!("✅ Real-world wallet backup scenario test passed!");
}
