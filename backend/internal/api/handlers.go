package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/lhty24/crypto-wallet/backend/internal/database"
)

// --- Helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, ErrorResponse{Error: msg})
}

func validateWalletName(name string) (string, string) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "", "Wallet name cannot be empty"
	}
	if len(trimmed) > 50 {
		return "", "Wallet name must be 50 characters or less"
	}
	return trimmed, ""
}

func validateChain(chain string) (string, string) {
	lower := strings.ToLower(strings.TrimSpace(chain))
	switch lower {
	case "bitcoin", "ethereum", "solana":
		return lower, ""
	default:
		return "", "Unsupported chain: " + chain
	}
}

// --- Wallet Handlers ---

func (s *Server) createWallet(w http.ResponseWriter, r *http.Request) {
	var req CreateWalletRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	name, errMsg := validateWalletName(req.Name)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}

	walletID := uuid.New().String()
	wallet, err := database.CreateWallet(s.db, name, walletID)
	if err != nil {
		slog.Error("failed to create wallet", "error", err)
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	writeJSON(w, http.StatusOK, WalletResponse{
		WalletID:  wallet.WalletID,
		Name:      wallet.Name,
		CreatedAt: wallet.CreatedAt,
		Message:   "Wallet metadata created. Generate mnemonic on frontend.",
	})
}

func (s *Server) importWallet(w http.ResponseWriter, r *http.Request) {
	var req ImportWalletRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	name, errMsg := validateWalletName(req.Name)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}

	walletID := uuid.New().String()
	wallet, err := database.CreateWallet(s.db, name, walletID)
	if err != nil {
		slog.Error("failed to import wallet", "error", err)
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	writeJSON(w, http.StatusOK, WalletResponse{
		WalletID:  wallet.WalletID,
		Name:      wallet.Name,
		CreatedAt: wallet.CreatedAt,
		Message:   "Wallet metadata created. Import and encrypt mnemonic on frontend.",
	})
}

func (s *Server) getWallets(w http.ResponseWriter, _ *http.Request) {
	wallets, err := database.ListWallets(s.db)
	if err != nil {
		slog.Error("failed to list wallets", "error", err)
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	resp := make([]WalletResponse, len(wallets))
	for i, wal := range wallets {
		resp[i] = WalletResponse{
			WalletID:  wal.WalletID,
			Name:      wal.Name,
			CreatedAt: wal.CreatedAt,
			Message:   "Wallet metadata retrieved.",
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) updateWallet(w http.ResponseWriter, r *http.Request) {
	walletID := chi.URLParam(r, "id")

	var req UpdateWalletRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	name, errMsg := validateWalletName(req.Name)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}

	wallet, err := database.UpdateWalletName(s.db, walletID, name)
	if err != nil {
		slog.Error("failed to update wallet", "error", err)
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	if wallet == nil {
		writeError(w, http.StatusNotFound, "Wallet not found")
		return
	}

	writeJSON(w, http.StatusOK, WalletResponse{
		WalletID:  wallet.WalletID,
		Name:      wallet.Name,
		CreatedAt: wallet.CreatedAt,
		Message:   "Wallet name updated successfully",
	})
}

func (s *Server) deleteWallet(w http.ResponseWriter, r *http.Request) {
	walletID := chi.URLParam(r, "id")

	deleted, err := database.DeleteWallet(s.db, walletID)
	if err != nil {
		slog.Error("failed to delete wallet", "error", err)
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	if !deleted {
		writeError(w, http.StatusNotFound, "Wallet not found")
		return
	}

	writeJSON(w, http.StatusOK, DeleteWalletResponse{
		WalletID: walletID,
		Message:  "Wallet deleted successfully",
		Deleted:  true,
	})
}

// --- Address Handler ---

func (s *Server) registerAddress(w http.ResponseWriter, r *http.Request) {
	walletID := chi.URLParam(r, "id")

	var req RegisterAddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate address
	addr := strings.TrimSpace(req.Address)
	if addr == "" {
		writeError(w, http.StatusBadRequest, "Address cannot be empty")
		return
	}
	if len(addr) < 25 || len(addr) > 62 {
		writeError(w, http.StatusBadRequest, "Invalid address length")
		return
	}

	// Validate chain
	chain, errMsg := validateChain(req.Chain)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}

	// Validate derivation path
	dp := strings.TrimSpace(req.DerivationPath)
	if !strings.HasPrefix(dp, "m/") {
		writeError(w, http.StatusBadRequest, "Invalid derivation path format")
		return
	}

	// Check wallet exists
	wallet, err := database.GetWalletByID(s.db, walletID)
	if err != nil {
		slog.Error("failed to look up wallet", "error", err)
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	if wallet == nil {
		writeError(w, http.StatusNotFound, "Wallet not found")
		return
	}

	// Create address
	wa, err := database.CreateWalletAddress(s.db, walletID, addr, chain, dp)
	if err != nil {
		slog.Error("failed to register address", "error", err)
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	var id int64
	if wa.ID != nil {
		id = *wa.ID
	}
	var createdAt string
	if wa.CreatedAt != nil {
		createdAt = *wa.CreatedAt
	}

	writeJSON(w, http.StatusOK, AddressResponse{
		ID:             id,
		WalletID:       wa.WalletID,
		Address:        wa.Address,
		Chain:          wa.Chain,
		DerivationPath: wa.DerivationPath,
		CreatedAt:      createdAt,
		Message:        "Address registered successfully",
	})
}

// --- Blockchain Handlers ---

func chainToSymbol(chain string) string {
	switch strings.ToLower(chain) {
	case "ethereum":
		return "ETH"
	case "bitcoin":
		return "BTC"
	case "solana":
		return "SOL"
	default:
		return strings.ToUpper(chain)
	}
}

func (s *Server) getWalletBalance(w http.ResponseWriter, r *http.Request) {
	walletID := chi.URLParam(r, "id")

	wallet, err := database.GetWalletByID(s.db, walletID)
	if err != nil {
		slog.Error("failed to look up wallet", "error", err)
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	if wallet == nil {
		writeError(w, http.StatusNotFound, "Wallet not found")
		return
	}

	addresses, err := database.GetWalletAddresses(s.db, walletID)
	if err != nil {
		slog.Error("failed to fetch wallet addresses", "error", err)
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	balances := make([]AddressBalance, len(addresses))
	for i, addr := range addresses {
		balances[i] = AddressBalance{
			Address:   addr.Address,
			Chain:     addr.Chain,
			Balance:   "0.0",
			Symbol:    chainToSymbol(addr.Chain),
			Timestamp: now,
		}
	}

	writeJSON(w, http.StatusOK, WalletBalanceResponse{
		WalletID: walletID,
		Balances: balances,
	})
}

func (s *Server) getTransactionHistory(w http.ResponseWriter, r *http.Request) {
	walletID := chi.URLParam(r, "id")

	wallet, err := database.GetWalletByID(s.db, walletID)
	if err != nil {
		slog.Error("failed to look up wallet", "error", err)
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	if wallet == nil {
		writeError(w, http.StatusNotFound, "Wallet not found")
		return
	}

	writeJSON(w, http.StatusOK, WalletTransactionResponse{
		WalletID:     walletID,
		Transactions: []Transaction{},
	})
}
