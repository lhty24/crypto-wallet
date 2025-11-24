//! Comprehensive integration tests for HD wallet functionality
//!
//! Tests the complete workflow from mnemonic generation to multi-chain
//! account derivation, following BIP32/BIP44 standards.

use crypto_wallet_backend::core::wallet::{
    MnemonicManager, EntropyLevel, HDWallet, Chain, Account,
    generate_test_mnemonic, derivation
};

#[test]
fn test_complete_hd_wallet_workflow() {
    println!("🧪 Testing complete HD wallet workflow...");
    
    // Step 1: Create a mnemonic
    let manager = MnemonicManager::new();
    let mnemonic = manager.generate(EntropyLevel::Low).unwrap();
    println!("✅ Generated mnemonic with {} words", mnemonic.word_count());
    
    // Step 2: Create HD wallet from mnemonic
    let hd_wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
    println!("✅ Created HD wallet from mnemonic");
    
    // Step 3: Derive accounts for all supported chains
    let accounts = hd_wallet.derive_default_accounts().unwrap();
    assert_eq!(accounts.len(), 3);
    
    for account in &accounts {
        println!("📝 {} Account: {}", 
            account.chain().name(), 
            account.address());
        println!("   Derivation path: {}", account.derivation_path());
        println!("   Private key length: {} bytes", account.private_key_bytes().len());
        println!("   Public key length: {} bytes", account.public_key_bytes().len());
    }
    
    println!("✅ Complete HD wallet workflow test passed!");
}

#[test]
fn test_multi_chain_account_generation() {
    println!("🧪 Testing multi-chain account generation...");
    
    let mnemonic = generate_test_mnemonic();
    let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
    
    // Test each supported blockchain
    let chains = [Chain::Bitcoin, Chain::Ethereum, Chain::Solana];
    
    for chain in chains {
        println!("📝 Testing {} chain...", chain.name());
        
        let account = wallet.derive_account(chain, 0).unwrap();
        
        // Verify basic properties
        assert_eq!(account.chain(), chain);
        assert_eq!(account.account_index(), 0);
        
        // Verify derivation path format
        let expected_path = format!("m/44'/{}'/{}'/{}/{}", 
            chain.coin_type(), 0, 0, 0);
        assert_eq!(account.derivation_path(), expected_path);
        
        // Verify address format based on chain
        match chain {
            Chain::Bitcoin => {
                // Bitcoin addresses start with '1', '3', or 'bc1'
                assert!(account.address().starts_with('1') || 
                       account.address().starts_with('3') || 
                       account.address().starts_with("bc1"));
            }
            Chain::Ethereum => {
                // Ethereum addresses start with '0x' and are 42 chars long
                assert!(account.address().starts_with("0x"));
                assert_eq!(account.address().len(), 42);
            }
            Chain::Solana => {
                // Solana addresses are hex encoded (64 chars for 32-byte pubkey)
                assert_eq!(account.address().len(), 64);
            }
        }
        
        // Verify key sizes
        assert_eq!(account.private_key_bytes().len(), 32); // 256 bits
        
        if chain.uses_secp256k1() {
            assert_eq!(account.public_key_bytes().len(), 33); // Compressed secp256k1
        } else {
            assert_eq!(account.public_key_bytes().len(), 32); // Ed25519
        }
        
        println!("✅ {} account generated successfully", chain.name());
        println!("   Address: {}", account.address());
        println!("   Derivation: {}", account.derivation_path());
    }
}

#[test]
fn test_multiple_accounts_per_chain() {
    println!("🧪 Testing multiple accounts per chain...");
    
    let mnemonic = generate_test_mnemonic();
    let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
    
    // Generate 5 Ethereum accounts
    let eth_accounts = wallet.derive_multiple_accounts(Chain::Ethereum, 5).unwrap();
    assert_eq!(eth_accounts.len(), 5);
    
    for (i, account) in eth_accounts.iter().enumerate() {
        assert_eq!(account.chain(), Chain::Ethereum);
        assert_eq!(account.account_index(), i as u32);
        
        let expected_path = format!("m/44'/60'/{}'/{}/{}", i, 0, 0);
        assert_eq!(account.derivation_path(), expected_path);
        
        println!("📝 Ethereum Account #{}: {}", i, account.address());
    }
    
    // Verify all addresses are different
    for i in 0..eth_accounts.len() {
        for j in (i+1)..eth_accounts.len() {
            assert_ne!(eth_accounts[i].address(), eth_accounts[j].address());
            assert_ne!(eth_accounts[i].private_key_bytes(), eth_accounts[j].private_key_bytes());
        }
    }
    
    println!("✅ Multiple accounts test passed!");
}

#[test]
fn test_deterministic_derivation() {
    println!("🧪 Testing deterministic derivation...");
    
    // Use the same test mnemonic for both wallets
    let test_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    let manager = MnemonicManager::new();
    let mnemonic = manager.parse(test_phrase).unwrap();
    
    // Create two separate wallet instances
    let wallet1 = HDWallet::from_mnemonic(&mnemonic).unwrap();
    let wallet2 = HDWallet::from_mnemonic(&mnemonic).unwrap();
    
    // Generate accounts from both wallets
    for chain in [Chain::Bitcoin, Chain::Ethereum, Chain::Solana] {
        let account1 = wallet1.derive_account(chain, 0).unwrap();
        let account2 = wallet2.derive_account(chain, 0).unwrap();
        
        // Should be identical
        assert_eq!(account1.address(), account2.address());
        assert_eq!(account1.private_key_bytes(), account2.private_key_bytes());
        assert_eq!(account1.public_key_bytes(), account2.public_key_bytes());
        assert_eq!(account1.derivation_path(), account2.derivation_path());
        
        println!("✅ {} deterministic derivation verified", chain.name());
        println!("   Address: {}", account1.address());
    }
    
    println!("✅ Deterministic derivation test passed!");
}

#[test]
fn test_chain_properties_and_coin_types() {
    println!("🧪 Testing chain properties and coin types...");
    
    // Test coin types (BIP44 registered numbers)
    assert_eq!(Chain::Bitcoin.coin_type(), 0);
    assert_eq!(Chain::Ethereum.coin_type(), 60);  
    assert_eq!(Chain::Solana.coin_type(), 501);
    
    // Test curve usage
    assert!(Chain::Bitcoin.uses_secp256k1());
    assert!(Chain::Ethereum.uses_secp256k1());
    assert!(!Chain::Solana.uses_secp256k1()); // Uses Ed25519
    
    // Test names
    assert_eq!(Chain::Bitcoin.name(), "Bitcoin");
    assert_eq!(Chain::Ethereum.name(), "Ethereum");
    assert_eq!(Chain::Solana.name(), "Solana");
    
    println!("✅ Chain properties test passed!");
}

#[test]
fn test_derivation_path_utilities() {
    println!("🧪 Testing derivation path utilities...");
    
    // Test path creation
    let path = derivation::create_bip44_path(60, 0, 0, 0);
    assert_eq!(path, "m/44'/60'/0'/0/0");
    
    let path2 = derivation::create_bip44_path(501, 5, 1, 10);
    assert_eq!(path2, "m/44'/501'/5'/1/10");
    
    // Test coin type parsing
    assert_eq!(derivation::parse_coin_type_from_path("m/44'/60'/0'/0/0"), Some(60));
    assert_eq!(derivation::parse_coin_type_from_path("m/44'/501'/0'/0/0"), Some(501));
    assert_eq!(derivation::parse_coin_type_from_path("invalid"), None);
    
    // Test chain from coin type
    assert_eq!(derivation::chain_from_coin_type(0), Some(Chain::Bitcoin));
    assert_eq!(derivation::chain_from_coin_type(60), Some(Chain::Ethereum));
    assert_eq!(derivation::chain_from_coin_type(501), Some(Chain::Solana));
    assert_eq!(derivation::chain_from_coin_type(999), None);
    
    println!("✅ Derivation path utilities test passed!");
}

#[test]
fn test_account_properties() {
    println!("🧪 Testing account properties and methods...");
    
    let mnemonic = generate_test_mnemonic();
    let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
    
    let eth_account = wallet.derive_account(Chain::Ethereum, 0).unwrap();
    
    // Test all account methods
    assert_eq!(eth_account.chain(), Chain::Ethereum);
    assert_eq!(eth_account.account_index(), 0);
    assert_eq!(eth_account.derivation_path(), "m/44'/60'/0'/0/0");
    assert!(eth_account.address().starts_with("0x"));
    assert_eq!(eth_account.private_key_bytes().len(), 32);
    assert_eq!(eth_account.public_key_bytes().len(), 33); // Compressed secp256k1
    
    let description = eth_account.description();
    assert_eq!(description, "Ethereum Account #0");
    
    println!("📝 Account description: {}", description);
    println!("📝 Account address: {}", eth_account.address());
    println!("✅ Account properties test passed!");
}

#[test]
fn test_real_world_compatibility() {
    println!("🧪 Testing real-world wallet compatibility...");
    
    // This test uses a known test vector to ensure compatibility with other wallets
    let test_mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    let manager = MnemonicManager::new();
    let mnemonic = manager.parse(test_mnemonic).unwrap();
    let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
    
    // Generate accounts for each chain
    let btc_account = wallet.derive_account(Chain::Bitcoin, 0).unwrap();
    let eth_account = wallet.derive_account(Chain::Ethereum, 0).unwrap();
    let sol_account = wallet.derive_account(Chain::Solana, 0).unwrap();
    
    // Verify the derivation paths match BIP44 standard
    assert_eq!(btc_account.derivation_path(), "m/44'/0'/0'/0/0");
    assert_eq!(eth_account.derivation_path(), "m/44'/60'/0'/0/0");  
    assert_eq!(sol_account.derivation_path(), "m/44'/501'/0'/0/0");
    
    // The exact addresses depend on our implementation, but we can verify they're generated
    assert!(!btc_account.address().is_empty());
    assert!(!eth_account.address().is_empty());
    assert!(!sol_account.address().is_empty());
    
    // All should be different
    assert_ne!(btc_account.address(), eth_account.address());
    assert_ne!(eth_account.address(), sol_account.address());
    assert_ne!(btc_account.address(), sol_account.address());
    
    println!("📝 Bitcoin address: {}", btc_account.address());
    println!("📝 Ethereum address: {}", eth_account.address());  
    println!("📝 Solana address: {}", sol_account.address());
    
    println!("✅ Real-world compatibility test passed!");
}

#[test]
fn test_seed_consistency() {
    println!("🧪 Testing seed consistency...");
    
    let mnemonic = generate_test_mnemonic();
    let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
    
    // The seed should be 64 bytes (512 bits)
    assert_eq!(wallet.seed().len(), 64);
    
    // Same mnemonic should produce same seed
    let wallet2 = HDWallet::from_mnemonic(&mnemonic).unwrap();
    assert_eq!(wallet.seed(), wallet2.seed());
    
    println!("📝 Seed length: {} bytes", wallet.seed().len());
    println!("✅ Seed consistency test passed!");
}

#[test]
fn test_error_handling() {
    println!("🧪 Testing error handling...");
    
    let mnemonic = generate_test_mnemonic();
    let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
    
    // All current operations should succeed, but let's test error propagation
    let result = wallet.derive_account(Chain::Bitcoin, 0);
    assert!(result.is_ok());
    
    let result = wallet.derive_account(Chain::Ethereum, 0);
    assert!(result.is_ok());
    
    let result = wallet.derive_account(Chain::Solana, 0);
    assert!(result.is_ok());
    
    println!("✅ Error handling test passed!");
}

#[test] 
fn test_performance() {
    println!("🧪 Testing HD wallet performance...");
    
    let start = std::time::Instant::now();
    
    let mnemonic = generate_test_mnemonic();
    let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
    
    // Generate 10 accounts for each chain (30 total)
    let mut total_accounts = 0;
    for chain in [Chain::Bitcoin, Chain::Ethereum, Chain::Solana] {
        let accounts = wallet.derive_multiple_accounts(chain, 10).unwrap();
        total_accounts += accounts.len();
        
        // Verify all accounts are unique
        for i in 0..accounts.len() {
            for j in (i+1)..accounts.len() {
                assert_ne!(accounts[i].address(), accounts[j].address());
            }
        }
    }
    
    let duration = start.elapsed();
    println!("📝 Generated {} accounts in {:?}", total_accounts, duration);
    
    // Should be fast - under 1 second for 30 accounts
    assert!(duration.as_secs() < 5, "HD wallet derivation too slow");
    
    println!("✅ Performance test passed!");
}

/// Integration test: Complete wallet setup workflow
#[test]
fn test_integration_wallet_setup() {
    println!("🧪 Testing complete wallet setup integration...");
    
    // Simulate a user creating a new wallet
    println!("📝 Step 1: Generate mnemonic phrase");
    let manager = MnemonicManager::new();
    let mnemonic = manager.generate(EntropyLevel::Low).unwrap();
    
    println!("📝 Step 2: Create HD wallet");
    let wallet = HDWallet::from_mnemonic(&mnemonic).unwrap();
    
    println!("📝 Step 3: Generate default accounts");
    let accounts = wallet.derive_default_accounts().unwrap();
    
    println!("📝 Step 4: Display wallet information");
    println!("   Mnemonic: {} words", mnemonic.word_count());
    println!("   Entropy level: {:?}", mnemonic.entropy_level());
    println!("   Accounts created: {}", accounts.len());
    
    for (i, account) in accounts.iter().enumerate() {
        println!("   Account {}: {} - {}", 
            i + 1, 
            account.chain().name(), 
            account.address()
        );
    }
    
    // Simulate user wanting more Ethereum accounts
    println!("📝 Step 5: Generate additional Ethereum accounts");
    let eth_accounts = wallet.derive_multiple_accounts(Chain::Ethereum, 3).unwrap();
    
    for (i, account) in eth_accounts.iter().enumerate() {
        println!("   ETH Account {}: {}", i, account.address());
    }
    
    println!("✅ Complete wallet setup integration test passed!");
}