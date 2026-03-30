package database

// Wallet represents a wallet's metadata stored in the database.
// No sensitive data (mnemonics, private keys) is ever stored here.
type Wallet struct {
	ID        *int64  `json:"id"`
	Name      string  `json:"name"`
	WalletID  string  `json:"wallet_id"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt *string `json:"updated_at"`
}

// WalletAddress represents a derived address registered with the backend.
type WalletAddress struct {
	ID             *int64  `json:"id"`
	WalletID       string  `json:"wallet_id"`
	Address        string  `json:"address"`
	Chain          string  `json:"chain"`
	DerivationPath string  `json:"derivation_path"`
	CreatedAt      *string `json:"created_at"`
}

// TransactionRecord represents a cached blockchain transaction from a block explorer.
type TransactionRecord struct {
	ID          *int64  `json:"id"`
	WalletID    string  `json:"wallet_id"`
	Address     string  `json:"address"`
	Hash        string  `json:"hash"`
	From        string  `json:"from_address"`
	To          string  `json:"to_address"`
	Amount      string  `json:"amount"`
	Chain       string  `json:"chain"`
	Symbol      string  `json:"symbol"`
	Status      string  `json:"status"`
	Timestamp   string  `json:"timestamp"`
	BlockNumber *string `json:"block_number"`
	CreatedAt   string  `json:"created_at"`
	CachedAt    string  `json:"cached_at"`
}
