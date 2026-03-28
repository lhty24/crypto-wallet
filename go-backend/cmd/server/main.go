package main

import (
	"log/slog"
	"os"
	"strings"

	"github.com/lhty24/crypto-wallet/go-backend/internal/api"
	"github.com/lhty24/crypto-wallet/go-backend/internal/database"
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

	server := api.NewServer(db)

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
