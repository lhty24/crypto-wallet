package main

import (
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/lhty24/crypto-wallet/backend/internal/api"
	"github.com/lhty24/crypto-wallet/backend/internal/database"
	"github.com/lhty24/crypto-wallet/backend/internal/service"
)

func main() {
	initLogger()

	slog.Info("starting crypto wallet server")

	db, err := database.InitDatabase()
	if err != nil {
		slog.Error("failed to initialize database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	explorer := service.NewEtherscanClient(os.Getenv("ETHERSCAN_API_KEY"))

	cacheDuration := 6 * time.Hour
	if hours := os.Getenv("TX_CACHE_DURATION"); hours != "" {
		if h, err := strconv.Atoi(hours); err == nil && h > 0 {
			cacheDuration = time.Duration(h) * time.Hour
		}
	}

	server := api.NewServer(db, explorer, cacheDuration)

	if err := server.Start(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func initLogger() {
	levelStr := strings.ToLower(os.Getenv("LOG_LEVEL"))
	var level slog.Level

	switch levelStr {
	case "debug":
		level = slog.LevelDebug
	case "warn", "warning":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	slog.SetDefault(slog.New(handler))
}
