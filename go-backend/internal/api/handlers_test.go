package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/lhty24/crypto-wallet/go-backend/internal/database"
	_ "modernc.org/sqlite"
)

// setupTestRouter creates an in-memory DB and a chi router with all routes
// wired up (no middleware) so chi.URLParam works in tests.
func setupTestRouter(t *testing.T) (*chi.Mux, *Server) {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		t.Fatalf("enable foreign keys: %v", err)
	}
	if err := database.RunMigrations(db); err != nil {
		t.Fatalf("run migrations: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	s := &Server{db: db}
	r := chi.NewRouter()
	r.Get("/health", s.healthCheck)
	r.Get("/wallets", s.getWallets)
	r.Post("/wallet/create", s.createWallet)
	r.Post("/wallet/import", s.importWallet)
	r.Put("/wallet/{id}", s.updateWallet)
	r.Delete("/wallet/{id}", s.deleteWallet)
	r.Post("/wallet/{id}/addresses", s.registerAddress)

	return r, s
}

// helper to create a wallet and return its ID.
func createTestWallet(t *testing.T, r *chi.Mux, name string) WalletResponse {
	t.Helper()
	body, _ := json.Marshal(CreateWalletRequest{Name: name})
	req := httptest.NewRequest(http.MethodPost, "/wallet/create", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("createTestWallet: expected 200, got %d", w.Code)
	}
	var resp WalletResponse
	json.NewDecoder(w.Body).Decode(&resp)
	return resp
}

// --- Health Check ---

func TestHealthCheck(t *testing.T) {
	r, _ := setupTestRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp HealthResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Status != "ok" || resp.Database != "connected" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

// --- Create Wallet ---

func TestCreateWalletHandler(t *testing.T) {
	r, _ := setupTestRouter(t)
	body := `{"name":"Test Wallet"}`
	req := httptest.NewRequest(http.MethodPost, "/wallet/create", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp WalletResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Name != "Test Wallet" {
		t.Fatalf("expected name 'Test Wallet', got '%s'", resp.Name)
	}
	if resp.WalletID == "" {
		t.Fatal("expected non-empty wallet_id")
	}
}

func TestCreateWalletEmptyName(t *testing.T) {
	r, _ := setupTestRouter(t)
	body := `{"name":""}`
	req := httptest.NewRequest(http.MethodPost, "/wallet/create", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	var resp ErrorResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Error != "Wallet name cannot be empty" {
		t.Fatalf("unexpected error: %s", resp.Error)
	}
}

func TestCreateWalletNameTooLong(t *testing.T) {
	r, _ := setupTestRouter(t)
	longName := make([]byte, 51)
	for i := range longName {
		longName[i] = 'a'
	}
	body, _ := json.Marshal(CreateWalletRequest{Name: string(longName)})
	req := httptest.NewRequest(http.MethodPost, "/wallet/create", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// --- Import Wallet ---

func TestImportWalletHandler(t *testing.T) {
	r, _ := setupTestRouter(t)
	body := `{"name":"Imported"}`
	req := httptest.NewRequest(http.MethodPost, "/wallet/import", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp WalletResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Name != "Imported" {
		t.Fatalf("expected name 'Imported', got '%s'", resp.Name)
	}
}

// --- Get Wallets ---

func TestGetWalletsEmpty(t *testing.T) {
	r, _ := setupTestRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/wallets", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp []WalletResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if len(resp) != 0 {
		t.Fatalf("expected empty list, got %d", len(resp))
	}
}

func TestGetWalletsAfterCreate(t *testing.T) {
	r, _ := setupTestRouter(t)

	createTestWallet(t, r, "W1")
	createTestWallet(t, r, "W2")

	req := httptest.NewRequest(http.MethodGet, "/wallets", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var resp []WalletResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if len(resp) != 2 {
		t.Fatalf("expected 2 wallets, got %d", len(resp))
	}
}

// --- Update Wallet ---

func TestUpdateWalletHandler(t *testing.T) {
	r, _ := setupTestRouter(t)
	created := createTestWallet(t, r, "Original")

	updateBody := `{"name":"Renamed"}`
	updateReq := httptest.NewRequest(http.MethodPut, "/wallet/"+created.WalletID, bytes.NewBufferString(updateBody))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, updateReq)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp WalletResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Name != "Renamed" {
		t.Fatalf("expected 'Renamed', got '%s'", resp.Name)
	}
}

func TestUpdateWalletNotFound(t *testing.T) {
	r, _ := setupTestRouter(t)
	body := `{"name":"Nope"}`
	req := httptest.NewRequest(http.MethodPut, "/wallet/nonexistent", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// --- Delete Wallet ---

func TestDeleteWalletHandler(t *testing.T) {
	r, _ := setupTestRouter(t)
	created := createTestWallet(t, r, "ToDelete")

	deleteReq := httptest.NewRequest(http.MethodDelete, "/wallet/"+created.WalletID, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, deleteReq)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp DeleteWalletResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if !resp.Deleted {
		t.Fatal("expected deleted=true")
	}
}

func TestDeleteWalletNotFound(t *testing.T) {
	r, _ := setupTestRouter(t)
	req := httptest.NewRequest(http.MethodDelete, "/wallet/nonexistent", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// --- Register Address ---

func TestRegisterAddressHandler(t *testing.T) {
	r, _ := setupTestRouter(t)
	created := createTestWallet(t, r, "AddrWallet")

	addrBody := `{"address":"0x1234567890abcdef1234567890abcdef12345678","chain":"ethereum","derivation_path":"m/44'/60'/0'/0/0"}`
	addrReq := httptest.NewRequest(http.MethodPost, "/wallet/"+created.WalletID+"/addresses", bytes.NewBufferString(addrBody))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, addrReq)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp AddressResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Chain != "ethereum" {
		t.Fatalf("expected chain 'ethereum', got '%s'", resp.Chain)
	}
	if resp.WalletID != created.WalletID {
		t.Fatalf("expected wallet_id '%s', got '%s'", created.WalletID, resp.WalletID)
	}
}

func TestRegisterAddressEmptyAddress(t *testing.T) {
	r, _ := setupTestRouter(t)
	created := createTestWallet(t, r, "W")

	body := `{"address":"","chain":"bitcoin","derivation_path":"m/44'/0'/0'/0/0"}`
	req := httptest.NewRequest(http.MethodPost, "/wallet/"+created.WalletID+"/addresses", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRegisterAddressInvalidChain(t *testing.T) {
	r, _ := setupTestRouter(t)
	created := createTestWallet(t, r, "W")

	body := `{"address":"1A1z7agoat4qNLSZjBCnWnLn949eemSpRK","chain":"dogecoin","derivation_path":"m/44'/0'/0'/0/0"}`
	req := httptest.NewRequest(http.MethodPost, "/wallet/"+created.WalletID+"/addresses", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRegisterAddressInvalidDerivationPath(t *testing.T) {
	r, _ := setupTestRouter(t)
	created := createTestWallet(t, r, "W")

	body := `{"address":"1A1z7agoat4qNLSZjBCnWnLn949eemSpRK","chain":"bitcoin","derivation_path":"bad/path"}`
	req := httptest.NewRequest(http.MethodPost, "/wallet/"+created.WalletID+"/addresses", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRegisterAddressWalletNotFound(t *testing.T) {
	r, _ := setupTestRouter(t)

	body := `{"address":"1A1z7agoat4qNLSZjBCnWnLn949eemSpRK","chain":"bitcoin","derivation_path":"m/44'/0'/0'/0/0"}`
	req := httptest.NewRequest(http.MethodPost, "/wallet/nonexistent/addresses", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}
