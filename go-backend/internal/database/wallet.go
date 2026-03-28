package database

import (
	"database/sql"
	"fmt"
	"time"
)

// CreateWallet inserts a new wallet and returns it.
func CreateWallet(db *sql.DB, name, walletID string) (Wallet, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	row := db.QueryRow(
		`INSERT INTO wallets (name, wallet_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?)
		 RETURNING id, name, wallet_id, created_at, updated_at`,
		name, walletID, now, now,
	)

	return scanWallet(row)
}

// GetWalletByID finds a wallet by its UUID. Returns nil if not found.
func GetWalletByID(db *sql.DB, walletID string) (*Wallet, error) {
	row := db.QueryRow(
		`SELECT id, name, wallet_id, created_at, updated_at
		 FROM wallets
		 WHERE wallet_id = ?`,
		walletID,
	)

	w, err := scanWallet(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &w, nil
}

// ListWallets returns all wallets.
func ListWallets(db *sql.DB) ([]Wallet, error) {
	rows, err := db.Query("SELECT id, name, wallet_id, created_at, updated_at FROM wallets")
	if err != nil {
		return nil, fmt.Errorf("query wallets: %w", err)
	}
	defer rows.Close()

	var wallets []Wallet
	for rows.Next() {
		w, err := scanWalletRows(rows)
		if err != nil {
			return nil, err
		}
		wallets = append(wallets, w)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate wallets: %w", err)
	}

	if wallets == nil {
		wallets = []Wallet{}
	}
	return wallets, nil
}

// UpdateWalletName updates a wallet's name. Returns nil if not found.
func UpdateWalletName(db *sql.DB, walletID, name string) (*Wallet, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	row := db.QueryRow(
		`UPDATE wallets
		 SET name = ?, updated_at = ?
		 WHERE wallet_id = ?
		 RETURNING id, name, wallet_id, created_at, updated_at`,
		name, now, walletID,
	)

	w, err := scanWallet(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &w, nil
}

// DeleteWallet deletes a wallet by its UUID. Returns true if a row was deleted.
// Associated addresses are removed via ON DELETE CASCADE.
func DeleteWallet(db *sql.DB, walletID string) (bool, error) {
	result, err := db.Exec("DELETE FROM wallets WHERE wallet_id = ?", walletID)
	if err != nil {
		return false, fmt.Errorf("delete wallet: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("rows affected: %w", err)
	}
	return affected > 0, nil
}

// scanWallet scans a single row into a Wallet.
func scanWallet(row *sql.Row) (Wallet, error) {
	var w Wallet
	var id sql.NullInt64
	var updatedAt sql.NullString

	err := row.Scan(&id, &w.Name, &w.WalletID, &w.CreatedAt, &updatedAt)
	if err != nil {
		return Wallet{}, err
	}

	if id.Valid {
		w.ID = &id.Int64
	}
	if updatedAt.Valid {
		w.UpdatedAt = &updatedAt.String
	}
	return w, nil
}

// scanWalletRows scans from sql.Rows into a Wallet.
func scanWalletRows(rows *sql.Rows) (Wallet, error) {
	var w Wallet
	var id sql.NullInt64
	var updatedAt sql.NullString

	err := rows.Scan(&id, &w.Name, &w.WalletID, &w.CreatedAt, &updatedAt)
	if err != nil {
		return Wallet{}, fmt.Errorf("scan wallet: %w", err)
	}

	if id.Valid {
		w.ID = &id.Int64
	}
	if updatedAt.Valid {
		w.UpdatedAt = &updatedAt.String
	}
	return w, nil
}
