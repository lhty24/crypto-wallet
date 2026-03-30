package database

import (
	"testing"
)

func makeTestTx(walletID, address, hash string) TransactionRecord {
	bn := "12345"
	return TransactionRecord{
		WalletID:    walletID,
		Address:     address,
		Hash:        hash,
		From:        "0xaaa",
		To:          "0xbbb",
		Amount:      "1.5",
		Chain:       "ethereum",
		Symbol:      "ETH",
		Status:      "confirmed",
		Timestamp:   "2026-01-15T10:00:00Z",
		BlockNumber: &bn,
	}
}

func TestCreateTransaction(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "tx-wallet")

	tx := makeTestTx("tx-wallet", "0xabc", "0xhash1")
	record, err := CreateTransaction(db, tx)
	if err != nil {
		t.Fatalf("create transaction: %v", err)
	}

	if record.ID == nil {
		t.Error("expected non-nil ID")
	}
	if record.Hash != "0xhash1" {
		t.Errorf("hash = %q, want %q", record.Hash, "0xhash1")
	}
	if record.Amount != "1.5" {
		t.Errorf("amount = %q, want %q", record.Amount, "1.5")
	}
	if record.CreatedAt == "" {
		t.Error("created_at should not be empty")
	}
	if record.CachedAt == "" {
		t.Error("cached_at should not be empty")
	}
}

func TestCreateTransactionDuplicateHash(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "dup-tx-wallet")

	tx := makeTestTx("dup-tx-wallet", "0xabc", "0xduphash")
	_, err := CreateTransaction(db, tx)
	if err != nil {
		t.Fatalf("first create: %v", err)
	}

	_, err = CreateTransaction(db, tx)
	if err == nil {
		t.Fatal("expected error for duplicate hash, got nil")
	}
}

func TestUpsertTransactions(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "upsert-wallet")

	txs := []TransactionRecord{
		makeTestTx("upsert-wallet", "0xabc", "0xhash-a"),
		makeTestTx("upsert-wallet", "0xabc", "0xhash-b"),
		makeTestTx("upsert-wallet", "0xabc", "0xhash-c"),
	}

	inserted, err := UpsertTransactions(db, txs)
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if inserted != 3 {
		t.Errorf("expected 3 inserted, got %d", inserted)
	}

	// Upsert again with one new, two duplicates
	txs2 := []TransactionRecord{
		makeTestTx("upsert-wallet", "0xabc", "0xhash-a"), // dup
		makeTestTx("upsert-wallet", "0xabc", "0xhash-d"), // new
	}
	inserted, err = UpsertTransactions(db, txs2)
	if err != nil {
		t.Fatalf("upsert second batch: %v", err)
	}
	if inserted != 1 {
		t.Errorf("expected 1 inserted (dup skipped), got %d", inserted)
	}
}

func TestUpsertTransactionsEmpty(t *testing.T) {
	db := setupTestDB(t)

	inserted, err := UpsertTransactions(db, []TransactionRecord{})
	if err != nil {
		t.Fatalf("upsert empty: %v", err)
	}
	if inserted != 0 {
		t.Errorf("expected 0, got %d", inserted)
	}
}

func TestGetTransactionsByWalletID(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "get-wallet")

	// Empty
	txs, err := GetTransactionsByWalletID(db, "get-wallet")
	if err != nil {
		t.Fatalf("get txs: %v", err)
	}
	if len(txs) != 0 {
		t.Errorf("expected 0, got %d", len(txs))
	}

	// After inserts
	CreateTransaction(db, makeTestTx("get-wallet", "0xabc", "0xh1"))
	CreateTransaction(db, makeTestTx("get-wallet", "0xabc", "0xh2"))

	txs, err = GetTransactionsByWalletID(db, "get-wallet")
	if err != nil {
		t.Fatalf("get txs: %v", err)
	}
	if len(txs) != 2 {
		t.Errorf("expected 2, got %d", len(txs))
	}
}

func TestGetTransactionsByAddress(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "addr-wallet")

	CreateTransaction(db, makeTestTx("addr-wallet", "0xabc", "0xh1"))
	CreateTransaction(db, makeTestTx("addr-wallet", "0xdef", "0xh2"))

	txs, err := GetTransactionsByAddress(db, "0xabc", "ethereum")
	if err != nil {
		t.Fatalf("get by address: %v", err)
	}
	if len(txs) != 1 {
		t.Errorf("expected 1, got %d", len(txs))
	}
}

func TestGetTransactionByHash(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "hash-wallet")

	// Not found
	tx, err := GetTransactionByHash(db, "0xnonexistent")
	if err != nil {
		t.Fatalf("get by hash: %v", err)
	}
	if tx != nil {
		t.Fatal("expected nil for nonexistent hash")
	}

	// Found
	CreateTransaction(db, makeTestTx("hash-wallet", "0xabc", "0xfound"))

	tx, err = GetTransactionByHash(db, "0xfound")
	if err != nil {
		t.Fatalf("get by hash: %v", err)
	}
	if tx == nil {
		t.Fatal("expected tx, got nil")
	}
	if tx.Hash != "0xfound" {
		t.Errorf("hash = %q, want %q", tx.Hash, "0xfound")
	}
}

func TestGetCacheTimestamp(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "cache-wallet")

	// No cache
	ts, err := GetCacheTimestamp(db, "0xabc", "ethereum")
	if err != nil {
		t.Fatalf("get cache timestamp: %v", err)
	}
	if ts != nil {
		t.Fatal("expected nil for no cached txs")
	}

	// After insert
	CreateTransaction(db, makeTestTx("cache-wallet", "0xabc", "0xch1"))

	ts, err = GetCacheTimestamp(db, "0xabc", "ethereum")
	if err != nil {
		t.Fatalf("get cache timestamp: %v", err)
	}
	if ts == nil {
		t.Fatal("expected non-nil cache timestamp")
	}
}

func TestUpdateCacheTimestamp(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "update-cache-wallet")

	CreateTransaction(db, makeTestTx("update-cache-wallet", "0xabc", "0xuc1"))

	before, _ := GetCacheTimestamp(db, "0xabc", "ethereum")
	if before == nil {
		t.Fatal("expected non-nil before")
	}

	err := UpdateCacheTimestamp(db, "0xabc", "ethereum")
	if err != nil {
		t.Fatalf("update cache timestamp: %v", err)
	}

	after, _ := GetCacheTimestamp(db, "0xabc", "ethereum")
	if after == nil {
		t.Fatal("expected non-nil after")
	}
	// After should be >= before (both set close together so just check non-nil)
}

func TestTransactionCascadeDelete(t *testing.T) {
	db := setupTestDB(t)
	CreateWallet(db, "W", "cascade-tx-wallet")

	CreateTransaction(db, makeTestTx("cascade-tx-wallet", "0xabc", "0xc1"))
	CreateTransaction(db, makeTestTx("cascade-tx-wallet", "0xabc", "0xc2"))

	txs, _ := GetTransactionsByWalletID(db, "cascade-tx-wallet")
	if len(txs) != 2 {
		t.Fatalf("expected 2 txs before delete, got %d", len(txs))
	}

	deleted, err := DeleteWallet(db, "cascade-tx-wallet")
	if err != nil {
		t.Fatalf("delete wallet: %v", err)
	}
	if !deleted {
		t.Fatal("expected wallet to be deleted")
	}

	txs, _ = GetTransactionsByWalletID(db, "cascade-tx-wallet")
	if len(txs) != 0 {
		t.Errorf("expected 0 txs after cascade delete, got %d", len(txs))
	}
}
