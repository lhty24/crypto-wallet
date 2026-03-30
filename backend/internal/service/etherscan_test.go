package service

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetchTransactionsSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"status": "1",
			"message": "OK",
			"result": [
				{
					"hash": "0xabc123",
					"from": "0xsender",
					"to": "0xreceiver",
					"value": "1000000000000000000",
					"timeStamp": "1700000000",
					"blockNumber": "18000000",
					"isError": "0"
				},
				{
					"hash": "0xdef456",
					"from": "0xsender2",
					"to": "0xreceiver2",
					"value": "500000000000000000",
					"timeStamp": "1700001000",
					"blockNumber": "18000001",
					"isError": "1"
				}
			]
		}`))
	}))
	defer server.Close()

	client := NewEtherscanClient("")
	client.BaseURL = server.URL

	txs, err := client.FetchTransactions("wallet-1", "0xaddr")
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}

	if len(txs) != 2 {
		t.Fatalf("expected 2 txs, got %d", len(txs))
	}

	// First tx
	if txs[0].Hash != "0xabc123" {
		t.Errorf("hash = %q, want %q", txs[0].Hash, "0xabc123")
	}
	if txs[0].Amount != "1" {
		t.Errorf("amount = %q, want %q", txs[0].Amount, "1")
	}
	if txs[0].Status != "confirmed" {
		t.Errorf("status = %q, want %q", txs[0].Status, "confirmed")
	}
	if txs[0].Chain != "ethereum" {
		t.Errorf("chain = %q, want %q", txs[0].Chain, "ethereum")
	}
	if txs[0].Symbol != "ETH" {
		t.Errorf("symbol = %q, want %q", txs[0].Symbol, "ETH")
	}
	if txs[0].WalletID != "wallet-1" {
		t.Errorf("wallet_id = %q, want %q", txs[0].WalletID, "wallet-1")
	}

	// Second tx — failed
	if txs[1].Status != "failed" {
		t.Errorf("status = %q, want %q", txs[1].Status, "failed")
	}
	if txs[1].Amount != "0.5" {
		t.Errorf("amount = %q, want %q", txs[1].Amount, "0.5")
	}
}

func TestFetchTransactionsNoResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"0","message":"No transactions found","result":[]}`))
	}))
	defer server.Close()

	client := NewEtherscanClient("")
	client.BaseURL = server.URL

	txs, err := client.FetchTransactions("wallet-1", "0xaddr")
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if len(txs) != 0 {
		t.Errorf("expected 0 txs, got %d", len(txs))
	}
}

func TestFetchTransactionsAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"0","message":"NOTOK","result":"Invalid API Key"}`))
	}))
	defer server.Close()

	client := NewEtherscanClient("")
	client.BaseURL = server.URL

	_, err := client.FetchTransactions("wallet-1", "0xaddr")
	if err == nil {
		t.Fatal("expected error for API error response")
	}
}

func TestFetchTransactionsRateLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()

	client := NewEtherscanClient("")
	client.BaseURL = server.URL

	_, err := client.FetchTransactions("wallet-1", "0xaddr")
	if err == nil {
		t.Fatal("expected error for rate limit")
	}
}

func TestFetchTransactionsServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewEtherscanClient("")
	client.BaseURL = server.URL

	_, err := client.FetchTransactions("wallet-1", "0xaddr")
	if err == nil {
		t.Fatal("expected error for server error")
	}
}

func TestFetchTransactionsInvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`not json`))
	}))
	defer server.Close()

	client := NewEtherscanClient("")
	client.BaseURL = server.URL

	_, err := client.FetchTransactions("wallet-1", "0xaddr")
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestWeiToEth(t *testing.T) {
	tests := []struct {
		wei  string
		want string
	}{
		{"0", "0"},
		{"1000000000000000000", "1"},
		{"500000000000000000", "0.5"},
		{"1234567890000000000", "1.23456789"},
		{"100000000000000", "0.0001"},
		{"1", "0.000000000000000001"},
	}

	for _, tt := range tests {
		got := weiToEth(tt.wei)
		if got != tt.want {
			t.Errorf("weiToEth(%q) = %q, want %q", tt.wei, got, tt.want)
		}
	}
}

func TestWeiToEthInvalid(t *testing.T) {
	got := weiToEth("not-a-number")
	if got != "0" {
		t.Errorf("weiToEth(invalid) = %q, want %q", got, "0")
	}
}

func TestFetchTransactionsAPIKeyParam(t *testing.T) {
	var receivedKey string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedKey = r.URL.Query().Get("apikey")
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"0","message":"No transactions found","result":[]}`))
	}))
	defer server.Close()

	client := NewEtherscanClient("my-test-key")
	client.BaseURL = server.URL

	client.FetchTransactions("wallet-1", "0xaddr")

	if receivedKey != "my-test-key" {
		t.Errorf("expected apikey 'my-test-key', got %q", receivedKey)
	}
}
