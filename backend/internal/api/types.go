package api

// --- Request types ---

type CreateWalletRequest struct {
	Name string `json:"name"`
}

type ImportWalletRequest struct {
	Name string `json:"name"`
}

type UpdateWalletRequest struct {
	Name string `json:"name"`
}

type RegisterAddressRequest struct {
	Address        string `json:"address"`
	Chain          string `json:"chain"`
	DerivationPath string `json:"derivation_path"`
}

// --- Response types ---

type WalletResponse struct {
	WalletID  string `json:"wallet_id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
	Message   string `json:"message"`
}

type DeleteWalletResponse struct {
	WalletID string `json:"wallet_id"`
	Message  string `json:"message"`
	Deleted  bool   `json:"deleted"`
}

type AddressResponse struct {
	ID             int64  `json:"id"`
	WalletID       string `json:"wallet_id"`
	Address        string `json:"address"`
	Chain          string `json:"chain"`
	DerivationPath string `json:"derivation_path"`
	CreatedAt      string `json:"created_at"`
	Message        string `json:"message"`
}

// --- Blockchain response types ---

type AddressBalance struct {
	Address   string `json:"address"`
	Chain     string `json:"chain"`
	Balance   string `json:"balance"`
	Symbol    string `json:"symbol"`
	Timestamp string `json:"timestamp"`
}

type WalletBalanceResponse struct {
	WalletID string           `json:"wallet_id"`
	Balances []AddressBalance `json:"balances"`
}

type Transaction struct {
	Hash        string  `json:"hash"`
	From        string  `json:"from"`
	To          string  `json:"to"`
	Amount      string  `json:"amount"`
	Chain       string  `json:"chain"`
	Symbol      string  `json:"symbol"`
	Status      string  `json:"status"`
	Timestamp   string  `json:"timestamp"`
	BlockNumber *string `json:"block_number"`
}

type WalletTransactionResponse struct {
	WalletID     string        `json:"wallet_id"`
	Transactions []Transaction `json:"transactions"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
}
