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

type ErrorResponse struct {
	Error string `json:"error"`
}

type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
}
