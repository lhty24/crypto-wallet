package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/lhty24/crypto-wallet/go-backend/internal/database"
	_ "modernc.org/sqlite"
)

// setupFullServer creates an in-memory DB and a Server with all middleware
// applied, matching the production middleware stack.
func setupFullServer(t *testing.T) *Server {
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

	return NewServer(db)
}

// serve sends a request through the full middleware stack and returns the recorder.
func serve(s *Server, req *http.Request) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	return w
}

// ============================================================================
// Security Response Headers
// ============================================================================

func TestSecurityHeadersPresentOnGet(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := serve(s, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	assertHeader(t, w, "X-Content-Type-Options", "nosniff")
	assertHeader(t, w, "X-Frame-Options", "DENY")
	assertHeader(t, w, "Cache-Control", "no-store")
}

func TestSecurityHeadersPresentOnPost(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodPost, "/wallet/create", bytes.NewBufferString(`{"name":"Test"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Requested-With", "CryptoWallet")
	w := serve(s, req)

	// Security headers should be present regardless of response status
	assertHeader(t, w, "X-Content-Type-Options", "nosniff")
	assertHeader(t, w, "X-Frame-Options", "DENY")
	assertHeader(t, w, "Cache-Control", "no-store")
}

// ============================================================================
// X-Requested-With Validation
// ============================================================================

func TestPostWithoutCustomHeaderReturns403(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodPost, "/wallet/create", bytes.NewBufferString(`{"name":"Test"}`))
	req.Header.Set("Content-Type", "application/json")
	// No X-Requested-With header
	w := serve(s, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}

	body := w.Body.String()
	if body == "" || !bytes.Contains([]byte(body), []byte("X-Requested-With")) {
		t.Fatalf("expected error mentioning X-Requested-With, got: %s", body)
	}
}

func TestPostWithWrongCustomHeaderReturns403(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodPost, "/wallet/create", bytes.NewBufferString(`{"name":"Test"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Requested-With", "WrongValue")
	w := serve(s, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestPostWithCorrectCustomHeaderSucceeds(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodPost, "/wallet/create", bytes.NewBufferString(`{"name":"Test Wallet"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Requested-With", "CryptoWallet")
	w := serve(s, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestPutRequiresCustomHeader(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodPut, "/wallet/some-id", bytes.NewBufferString(`{"name":"Updated"}`))
	req.Header.Set("Content-Type", "application/json")
	// No X-Requested-With header
	w := serve(s, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestDeleteRequiresCustomHeader(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodDelete, "/wallet/some-id", nil)
	// No X-Requested-With header
	w := serve(s, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestGetDoesNotRequireCustomHeader(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	// No X-Requested-With header
	w := serve(s, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ============================================================================
// JSON Error Responses
// ============================================================================

func TestValidationErrorReturnsJSONWithErrorField(t *testing.T) {
	s := setupFullServer(t)

	// Send empty name to trigger validation error
	req := httptest.NewRequest(http.MethodPost, "/wallet/create", bytes.NewBufferString(`{"name":""}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Requested-With", "CryptoWallet")
	w := serve(s, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("response should be valid JSON: %v", err)
	}
	if _, ok := resp["error"]; !ok {
		t.Fatal("error response should have 'error' field")
	}
}

func TestNotFoundReturnsJSONWithErrorField(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodDelete, "/wallet/nonexistent-id", nil)
	req.Header.Set("X-Requested-With", "CryptoWallet")
	w := serve(s, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("response should be valid JSON: %v", err)
	}
	if _, ok := resp["error"]; !ok {
		t.Fatal("error response should have 'error' field")
	}
}

// ============================================================================
// CORS Headers
// ============================================================================

func TestCORSAllowsConfiguredOrigin(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodOptions, "/wallet/create", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "content-type,x-requested-with")
	w := serve(s, req)

	origin := w.Header().Get("Access-Control-Allow-Origin")
	if origin != "http://localhost:3000" {
		t.Fatalf("expected Access-Control-Allow-Origin 'http://localhost:3000', got '%s'", origin)
	}
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodOptions, "/wallet/create", nil)
	req.Header.Set("Origin", "http://evil.com")
	req.Header.Set("Access-Control-Request-Method", "POST")
	w := serve(s, req)

	origin := w.Header().Get("Access-Control-Allow-Origin")
	if origin == "http://evil.com" {
		t.Fatal("should not echo back unauthorized origin")
	}
}

// ============================================================================
// Request ID Header
// ============================================================================

func TestRequestIDHeaderPresent(t *testing.T) {
	s := setupFullServer(t)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := serve(s, req)

	reqID := w.Header().Get("X-Request-ID")
	if reqID == "" {
		t.Fatal("expected non-empty X-Request-ID header")
	}
}

// ============================================================================
// Helpers
// ============================================================================

func assertHeader(t *testing.T, w *httptest.ResponseRecorder, key, expected string) {
	t.Helper()
	got := w.Header().Get(key)
	if got != expected {
		t.Fatalf("expected header %s=%q, got %q", key, expected, got)
	}
}
