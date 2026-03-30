package service

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/lhty24/crypto-wallet/backend/internal/database"
)

// BlockExplorer fetches transaction history for an address on a given chain.
type BlockExplorer interface {
	FetchTransactions(walletID, address string) ([]database.TransactionRecord, error)
}

// EtherscanClient fetches Ethereum transaction history from the Etherscan API.
type EtherscanClient struct {
	APIKey     string
	BaseURL    string
	HTTPClient *http.Client
}

// NewEtherscanClient creates a new EtherscanClient.
// If apiKey is empty, requests use the free tier (lower rate limits).
func NewEtherscanClient(apiKey string) *EtherscanClient {
	return &EtherscanClient{
		APIKey:  apiKey,
		BaseURL: "https://api.etherscan.io/api",
		HTTPClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// etherscanResponse is the top-level JSON response from Etherscan.
type etherscanResponse struct {
	Status  string                `json:"status"`
	Message string                `json:"message"`
	Result  json.RawMessage       `json:"result"`
}

// etherscanTx is a single transaction from the Etherscan API.
type etherscanTx struct {
	Hash        string `json:"hash"`
	From        string `json:"from"`
	To          string `json:"to"`
	Value       string `json:"value"`
	TimeStamp   string `json:"timeStamp"`
	BlockNumber string `json:"blockNumber"`
	IsError     string `json:"isError"`
}

// FetchTransactions fetches normal (ETH transfer) transactions for an address from Etherscan.
func (c *EtherscanClient) FetchTransactions(walletID, address string) ([]database.TransactionRecord, error) {
	params := url.Values{
		"module":  {"account"},
		"action":  {"txlist"},
		"address": {address},
		"sort":    {"desc"},
	}
	if c.APIKey != "" {
		params.Set("apikey", c.APIKey)
	}

	reqURL := fmt.Sprintf("%s?%s", c.BaseURL, params.Encode())

	resp, err := c.HTTPClient.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("etherscan request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("etherscan rate limit exceeded")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("etherscan returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read etherscan response: %w", err)
	}

	var ethResp etherscanResponse
	if err := json.Unmarshal(body, &ethResp); err != nil {
		return nil, fmt.Errorf("parse etherscan response: %w", err)
	}

	// Etherscan returns status "0" with message "No transactions found" for empty results.
	if ethResp.Status == "0" {
		if ethResp.Message == "No transactions found" {
			return []database.TransactionRecord{}, nil
		}
		// Try to extract error string from result.
		var errMsg string
		if err := json.Unmarshal(ethResp.Result, &errMsg); err == nil {
			return nil, fmt.Errorf("etherscan error: %s", errMsg)
		}
		return nil, fmt.Errorf("etherscan error: %s", ethResp.Message)
	}

	var txs []etherscanTx
	if err := json.Unmarshal(ethResp.Result, &txs); err != nil {
		return nil, fmt.Errorf("parse etherscan transactions: %w", err)
	}

	records := make([]database.TransactionRecord, 0, len(txs))
	for _, tx := range txs {
		record, err := mapEtherscanTx(tx, walletID, address)
		if err != nil {
			slog.Warn("skipping malformed etherscan tx", "hash", tx.Hash, "error", err)
			continue
		}
		records = append(records, record)
	}

	return records, nil
}

// mapEtherscanTx converts an Etherscan transaction to a TransactionRecord.
func mapEtherscanTx(tx etherscanTx, walletID, address string) (database.TransactionRecord, error) {
	// Convert Unix timestamp to RFC3339.
	ts, err := strconv.ParseInt(tx.TimeStamp, 10, 64)
	if err != nil {
		return database.TransactionRecord{}, fmt.Errorf("parse timestamp %q: %w", tx.TimeStamp, err)
	}
	timestamp := time.Unix(ts, 0).UTC().Format(time.RFC3339)

	// Convert wei to ETH string.
	amount := weiToEth(tx.Value)

	status := "confirmed"
	if tx.IsError == "1" {
		status = "failed"
	}

	blockNumber := tx.BlockNumber

	return database.TransactionRecord{
		WalletID:    walletID,
		Address:     address,
		Hash:        tx.Hash,
		From:        tx.From,
		To:          tx.To,
		Amount:      amount,
		Chain:       "ethereum",
		Symbol:      "ETH",
		Status:      status,
		Timestamp:   timestamp,
		BlockNumber: &blockNumber,
	}, nil
}

// weiToEth converts a wei value string to an ETH decimal string.
func weiToEth(wei string) string {
	val, ok := new(big.Int).SetString(wei, 10)
	if !ok {
		return "0"
	}

	// ETH = wei / 10^18
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	whole := new(big.Int).Div(val, divisor)
	remainder := new(big.Int).Mod(val, divisor)

	if remainder.Sign() == 0 {
		return whole.String()
	}

	// Format remainder with leading zeros to 18 decimal places, then trim trailing zeros.
	fracStr := fmt.Sprintf("%018s", remainder.String())
	fracStr = trimTrailingZeros(fracStr)

	return fmt.Sprintf("%s.%s", whole.String(), fracStr)
}

// trimTrailingZeros removes trailing zeros from a decimal fraction string.
func trimTrailingZeros(s string) string {
	i := len(s) - 1
	for i >= 0 && s[i] == '0' {
		i--
	}
	if i < 0 {
		return "0"
	}
	return s[:i+1]
}
