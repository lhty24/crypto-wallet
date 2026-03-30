package database

import (
	"database/sql"
	"fmt"
	"time"
)

// CreateTransaction inserts a single transaction. Returns the inserted record.
func CreateTransaction(db *sql.DB, tx TransactionRecord) (TransactionRecord, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	row := db.QueryRow(
		`INSERT INTO transactions (wallet_id, address, hash, from_address, to_address, amount, chain, symbol, status, timestamp, block_number, created_at, cached_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 RETURNING id, wallet_id, address, hash, from_address, to_address, amount, chain, symbol, status, timestamp, block_number, created_at, cached_at`,
		tx.WalletID, tx.Address, tx.Hash, tx.From, tx.To, tx.Amount, tx.Chain, tx.Symbol, tx.Status, tx.Timestamp, tx.BlockNumber, now, now,
	)

	return scanTransaction(row)
}

// UpsertTransactions inserts multiple transactions, skipping any with duplicate hashes.
// Returns the number of rows inserted.
func UpsertTransactions(db *sql.DB, txs []TransactionRecord) (int64, error) {
	if len(txs) == 0 {
		return 0, nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	var inserted int64

	sqlTx, err := db.Begin()
	if err != nil {
		return 0, fmt.Errorf("begin transaction: %w", err)
	}
	defer sqlTx.Rollback()

	stmt, err := sqlTx.Prepare(
		`INSERT OR IGNORE INTO transactions (wallet_id, address, hash, from_address, to_address, amount, chain, symbol, status, timestamp, block_number, created_at, cached_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		return 0, fmt.Errorf("prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, tx := range txs {
		result, err := stmt.Exec(tx.WalletID, tx.Address, tx.Hash, tx.From, tx.To, tx.Amount, tx.Chain, tx.Symbol, tx.Status, tx.Timestamp, tx.BlockNumber, now, now)
		if err != nil {
			return 0, fmt.Errorf("insert transaction %s: %w", tx.Hash, err)
		}
		affected, _ := result.RowsAffected()
		inserted += affected
	}

	if err := sqlTx.Commit(); err != nil {
		return 0, fmt.Errorf("commit transaction: %w", err)
	}
	return inserted, nil
}

// GetTransactionsByWalletID returns all transactions for a wallet, ordered by timestamp DESC.
func GetTransactionsByWalletID(db *sql.DB, walletID string) ([]TransactionRecord, error) {
	rows, err := db.Query(
		`SELECT id, wallet_id, address, hash, from_address, to_address, amount, chain, symbol, status, timestamp, block_number, created_at, cached_at
		 FROM transactions
		 WHERE wallet_id = ?
		 ORDER BY timestamp DESC`,
		walletID,
	)
	if err != nil {
		return nil, fmt.Errorf("query transactions: %w", err)
	}
	defer rows.Close()

	return scanTransactionRows(rows)
}

// GetTransactionsByAddress returns all transactions for a specific address and chain, ordered by timestamp DESC.
func GetTransactionsByAddress(db *sql.DB, address, chain string) ([]TransactionRecord, error) {
	rows, err := db.Query(
		`SELECT id, wallet_id, address, hash, from_address, to_address, amount, chain, symbol, status, timestamp, block_number, created_at, cached_at
		 FROM transactions
		 WHERE address = ? AND chain = ?
		 ORDER BY timestamp DESC`,
		address, chain,
	)
	if err != nil {
		return nil, fmt.Errorf("query transactions by address: %w", err)
	}
	defer rows.Close()

	return scanTransactionRows(rows)
}

// GetTransactionByHash finds a transaction by its hash. Returns nil if not found.
func GetTransactionByHash(db *sql.DB, hash string) (*TransactionRecord, error) {
	row := db.QueryRow(
		`SELECT id, wallet_id, address, hash, from_address, to_address, amount, chain, symbol, status, timestamp, block_number, created_at, cached_at
		 FROM transactions
		 WHERE hash = ?`,
		hash,
	)

	tx, err := scanTransaction(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

// GetCacheTimestamp returns the most recent cached_at timestamp for an address+chain pair.
// Returns nil if no cached transactions exist.
func GetCacheTimestamp(db *sql.DB, address, chain string) (*string, error) {
	var cachedAt sql.NullString
	err := db.QueryRow(
		`SELECT MAX(cached_at) FROM transactions WHERE address = ? AND chain = ?`,
		address, chain,
	).Scan(&cachedAt)
	if err != nil {
		return nil, fmt.Errorf("query cache timestamp: %w", err)
	}
	if !cachedAt.Valid {
		return nil, nil
	}
	return &cachedAt.String, nil
}

// UpdateCacheTimestamp updates the cached_at timestamp for all transactions of an address+chain pair.
func UpdateCacheTimestamp(db *sql.DB, address, chain string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec(
		`UPDATE transactions SET cached_at = ? WHERE address = ? AND chain = ?`,
		now, address, chain,
	)
	if err != nil {
		return fmt.Errorf("update cache timestamp: %w", err)
	}
	return nil
}

// scanTransaction scans a single row into a TransactionRecord.
func scanTransaction(row *sql.Row) (TransactionRecord, error) {
	var tx TransactionRecord
	var id sql.NullInt64
	var blockNumber sql.NullString

	err := row.Scan(&id, &tx.WalletID, &tx.Address, &tx.Hash, &tx.From, &tx.To, &tx.Amount, &tx.Chain, &tx.Symbol, &tx.Status, &tx.Timestamp, &blockNumber, &tx.CreatedAt, &tx.CachedAt)
	if err != nil {
		return TransactionRecord{}, err
	}

	if id.Valid {
		tx.ID = &id.Int64
	}
	if blockNumber.Valid {
		tx.BlockNumber = &blockNumber.String
	}
	return tx, nil
}

// scanTransactionRows scans multiple rows into a slice of TransactionRecord.
func scanTransactionRows(rows *sql.Rows) ([]TransactionRecord, error) {
	var txs []TransactionRecord
	for rows.Next() {
		var tx TransactionRecord
		var id sql.NullInt64
		var blockNumber sql.NullString

		err := rows.Scan(&id, &tx.WalletID, &tx.Address, &tx.Hash, &tx.From, &tx.To, &tx.Amount, &tx.Chain, &tx.Symbol, &tx.Status, &tx.Timestamp, &blockNumber, &tx.CreatedAt, &tx.CachedAt)
		if err != nil {
			return nil, fmt.Errorf("scan transaction: %w", err)
		}

		if id.Valid {
			tx.ID = &id.Int64
		}
		if blockNumber.Valid {
			tx.BlockNumber = &blockNumber.String
		}
		txs = append(txs, tx)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate transactions: %w", err)
	}

	if txs == nil {
		txs = []TransactionRecord{}
	}
	return txs, nil
}
