package main

import (
	"log/slog"
	"os"
	"strings"

	"github.com/lhty24/crypto-wallet/go-backend/internal/api"
)

func main() {
	initLogger()

	slog.Info("starting crypto wallet server")
	server := api.NewServer()

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
