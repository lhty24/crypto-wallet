package database

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

// setupTestDB creates an in-memory SQLite database with migrations applied.
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}

	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		t.Fatalf("enable foreign keys: %v", err)
	}

	if err := RunMigrations(db); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	t.Cleanup(func() { db.Close() })
	return db
}

// --- Wallet tests ---

func TestCreateWallet(t *testing.T) {
	db := setupTestDB(t)

	w, err := CreateWallet(db, "My Wallet", "wallet-uuid-1")
	if err != nil {
		t.Fatalf("create wallet: %v", err)
	}

	if w.Name != "My Wallet" {
		t.Errorf("name = %q, want %q", w.Name, "My Wallet")
	}
	if w.WalletID != "wallet-uuid-1" {
		t.Errorf("wallet_id = %q, want %q", w.WalletID, "wallet-uuid-1")
	}
	if w.ID == nil {
		t.Error("id should not be nil")
	}
	if w.CreatedAt == "" {
		t.Error("created_at should not be empty")
	}
	if w.UpdatedAt == nil {
		t.Error("updated_at should not be nil")
	}
}

func TestCreateWalletDuplicateID(t *testing.T) {
	db := setupTestDB(t)

	_, err := CreateWallet(db, "Wallet 1", "dup-id")
	if err != nil {
		t.Fatalf("first create: %v", err)
	}

	_, err = CreateWallet(db, "Wallet 2", "dup-id")
	if err == nil {
		t.Fatal("expected error for duplicate wallet_id, got nil")
	}
}

func TestGetWalletByID(t *testing.T) {
	db := setupTestDB(t)

	// Not found case.
	w, err := GetWalletByID(db, "nonexistent")
	if err != nil {
		t.Fatalf("get wallet: %v", err)
	}
	if w != nil {
		t.Fatal("expected nil for nonexistent wallet")
	}

	// Found case.
	_, err = CreateWallet(db, "Found Me", "find-me")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	w, err = GetWalletByID(db, "find-me")
	if err != nil {
		t.Fatalf("get wallet: %v", err)
	}
	if w == nil {
		t.Fatal("expected wallet, got nil")
	}
	if w.Name != "Found Me" {
		t.Errorf("name = %q, want %q", w.Name, "Found Me")
	}
}

func TestListWallets(t *testing.T) {
	db := setupTestDB(t)

	// Empty list.
	wallets, err := ListWallets(db)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(wallets) != 0 {
		t.Errorf("expected 0 wallets, got %d", len(wallets))
	}

	// After inserts.
	CreateWallet(db, "W1", "id-1")
	CreateWallet(db, "W2", "id-2")

	wallets, err = ListWallets(db)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(wallets) != 2 {
		t.Errorf("expected 2 wallets, got %d", len(wallets))
	}
}

func TestUpdateWalletName(t *testing.T) {
	db := setupTestDB(t)

	// Not found case.
	w, err := UpdateWalletName(db, "nonexistent", "New Name")
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if w != nil {
		t.Fatal("expected nil for nonexistent wallet")
	}

	// Found case.
	_, _ = CreateWallet(db, "Old Name", "upd-id")

	w, err = UpdateWalletName(db, "upd-id", "New Name")
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if w == nil {
		t.Fatal("expected updated wallet, got nil")
	}
	if w.Name != "New Name" {
		t.Errorf("name = %q, want %q", w.Name, "New Name")
	}
	if w.UpdatedAt == nil {
		t.Error("updated_at should not be nil after update")
	}
}

func TestDeleteWallet(t *testing.T) {
	db := setupTestDB(t)

	// Not found case.
	deleted, err := DeleteWallet(db, "nonexistent")
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	if deleted {
		t.Error("expected false for nonexistent wallet")
	}

	// Found case.
	CreateWallet(db, "Delete Me", "del-id")

	deleted, err = DeleteWallet(db, "del-id")
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	if !deleted {
		t.Error("expected true for deleted wallet")
	}

	// Verify gone.
	w, _ := GetWalletByID(db, "del-id")
	if w != nil {
		t.Error("wallet should be gone after delete")
	}
}

// --- WalletAddress tests ---

func TestCreateWalletAddress(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "wa-wallet")

	a, err := CreateWalletAddress(db, "wa-wallet", "0xABC", "ethereum", "m/44'/60'/0'/0/0")
	if err != nil {
		t.Fatalf("create address: %v", err)
	}

	if a.Address != "0xABC" {
		t.Errorf("address = %q, want %q", a.Address, "0xABC")
	}
	if a.Chain != "ethereum" {
		t.Errorf("chain = %q, want %q", a.Chain, "ethereum")
	}
	if a.DerivationPath != "m/44'/60'/0'/0/0" {
		t.Errorf("derivation_path = %q, want %q", a.DerivationPath, "m/44'/60'/0'/0/0")
	}
	if a.ID == nil {
		t.Error("id should not be nil")
	}
}

func TestCreateWalletAddressDuplicate(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "dup-addr-wallet")

	_, err := CreateWalletAddress(db, "dup-addr-wallet", "0xABC", "ethereum", "m/44'/60'/0'/0/0")
	if err != nil {
		t.Fatalf("first create: %v", err)
	}

	_, err = CreateWalletAddress(db, "dup-addr-wallet", "0xABC", "ethereum", "m/44'/60'/0'/0/0")
	if err == nil {
		t.Fatal("expected error for duplicate address, got nil")
	}
}

func TestGetWalletAddresses(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "addr-list-wallet")

	// Empty.
	addrs, err := GetWalletAddresses(db, "addr-list-wallet")
	if err != nil {
		t.Fatalf("get addresses: %v", err)
	}
	if len(addrs) != 0 {
		t.Errorf("expected 0 addresses, got %d", len(addrs))
	}

	// After inserts.
	CreateWalletAddress(db, "addr-list-wallet", "0x1", "ethereum", "m/44'/60'/0'/0/0")
	CreateWalletAddress(db, "addr-list-wallet", "sol1", "solana", "m/44'/501'/0'/0'")

	addrs, err = GetWalletAddresses(db, "addr-list-wallet")
	if err != nil {
		t.Fatalf("get addresses: %v", err)
	}
	if len(addrs) != 2 {
		t.Errorf("expected 2 addresses, got %d", len(addrs))
	}
}

func TestCascadeDelete(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "Cascade", "cascade-wallet")
	CreateWalletAddress(db, "cascade-wallet", "0xA", "ethereum", "m/44'/60'/0'/0/0")
	CreateWalletAddress(db, "cascade-wallet", "0xB", "bitcoin", "m/44'/0'/0'/0/0")

	// Verify addresses exist.
	addrs, _ := GetWalletAddresses(db, "cascade-wallet")
	if len(addrs) != 2 {
		t.Fatalf("expected 2 addresses before delete, got %d", len(addrs))
	}

	// Delete wallet — addresses should cascade.
	deleted, err := DeleteWallet(db, "cascade-wallet")
	if err != nil {
		t.Fatalf("delete wallet: %v", err)
	}
	if !deleted {
		t.Fatal("expected wallet to be deleted")
	}

	// Verify addresses are gone.
	addrs, err = GetWalletAddresses(db, "cascade-wallet")
	if err != nil {
		t.Fatalf("get addresses after delete: %v", err)
	}
	if len(addrs) != 0 {
		t.Errorf("expected 0 addresses after cascade delete, got %d", len(addrs))
	}
}
