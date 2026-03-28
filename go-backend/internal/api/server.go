package api

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
)

// Server holds the router, database, and configuration for the HTTP server.
type Server struct {
	router *chi.Mux
	db     *sql.DB
	port   string
}

// NewServer creates a Server with all routes and middleware configured.
func NewServer(db *sql.DB) *Server {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	s := &Server{
		router: chi.NewRouter(),
		db:     db,
		port:   port,
	}

	s.setupMiddleware()
	s.setupRoutes()
	return s
}

func (s *Server) setupMiddleware() {
	s.router.Use(RequestID)
	s.router.Use(RequestLogger)
	s.router.Use(CORSMiddleware())
	s.router.Use(SecurityHeaders)
	s.router.Use(RequestTimeout)
	s.router.Use(BodyLimit)
	s.router.Use(RequireCustomHeader)
}

func (s *Server) setupRoutes() {
	s.router.Get("/", s.root)
	s.router.Get("/health", s.healthCheck)

	// Wallet routes — placeholders until T3
	s.router.Get("/wallets", notImplemented)
	s.router.Post("/wallet/create", notImplemented)
	s.router.Post("/wallet/import", notImplemented)
	s.router.Put("/wallet/{id}", notImplemented)
	s.router.Delete("/wallet/{id}", notImplemented)
	s.router.Post("/wallet/{id}/addresses", notImplemented)
	s.router.Get("/wallet/{id}/balance", notImplemented)
	s.router.Get("/wallet/{id}/transactions", notImplemented)
	s.router.Post("/wallet/{id}/broadcast", notImplemented)
}

// Start begins listening and serves requests with graceful shutdown.
func (s *Server) Start() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	addr := fmt.Sprintf("127.0.0.1:%s", s.port)
	srv := &http.Server{
		Addr:    addr,
		Handler: s.router,
	}

	go func() {
		slog.Info("server started", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("server shutdown failed: %w", err)
	}

	slog.Info("server stopped gracefully")
	return nil
}

func (s *Server) root(w http.ResponseWriter, _ *http.Request) {
	fmt.Fprint(w, "Crypto Wallet API v1.0")
}

func (s *Server) healthCheck(w http.ResponseWriter, _ *http.Request) {
	fmt.Fprint(w, "OK")
}

func notImplemented(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)
	fmt.Fprint(w, `{"error":"not implemented"}`)
}
