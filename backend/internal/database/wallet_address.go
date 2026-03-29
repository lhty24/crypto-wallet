package database

import (
	"database/sql"
	"fmt"
	"time"
)

// CreateWalletAddress registers a new address for a wallet.
func CreateWalletAddress(db *sql.DB, walletID, address, chain, derivationPath string) (WalletAddress, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	row := db.QueryRow(
		`INSERT INTO wallet_addresses (wallet_id, address, chain, derivation_path, created_at)
		 VALUES (?, ?, ?, ?, ?)
		 RETURNING id, wallet_id, address, chain, derivation_path, created_at`,
		walletID, address, chain, derivationPath, now,
	)

	return scanWalletAddress(row)
}

// GetWalletAddresses returns all addresses for a wallet, ordered by created_at ASC.
func GetWalletAddresses(db *sql.DB, walletID string) ([]WalletAddress, error) {
	rows, err := db.Query(
		`SELECT id, wallet_id, address, chain, derivation_path, created_at
		 FROM wallet_addresses
		 WHERE wallet_id = ?
		 ORDER BY created_at ASC`,
		walletID,
	)
	if err != nil {
		return nil, fmt.Errorf("query wallet addresses: %w", err)
	}
	defer rows.Close()

	var addresses []WalletAddress
	for rows.Next() {
		a, err := scanWalletAddressRows(rows)
		if err != nil {
			return nil, err
		}
		addresses = append(addresses, a)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate wallet addresses: %w", err)
	}

	if addresses == nil {
		addresses = []WalletAddress{}
	}
	return addresses, nil
}

// scanWalletAddress scans a single row into a WalletAddress.
func scanWalletAddress(row *sql.Row) (WalletAddress, error) {
	var a WalletAddress
	var id sql.NullInt64
	var createdAt sql.NullString

	err := row.Scan(&id, &a.WalletID, &a.Address, &a.Chain, &a.DerivationPath, &createdAt)
	if err != nil {
		return WalletAddress{}, err
	}

	if id.Valid {
		a.ID = &id.Int64
	}
	if createdAt.Valid {
		a.CreatedAt = &createdAt.String
	}
	return a, nil
}

// scanWalletAddressRows scans from sql.Rows into a WalletAddress.
func scanWalletAddressRows(rows *sql.Rows) (WalletAddress, error) {
	var a WalletAddress
	var id sql.NullInt64
	var createdAt sql.NullString

	err := rows.Scan(&id, &a.WalletID, &a.Address, &a.Chain, &a.DerivationPath, &createdAt)
	if err != nil {
		return WalletAddress{}, fmt.Errorf("scan wallet address: %w", err)
	}

	if id.Valid {
		a.ID = &id.Int64
	}
	if createdAt.Valid {
		a.CreatedAt = &createdAt.String
	}
	return a, nil
}
