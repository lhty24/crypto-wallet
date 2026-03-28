package database

import (
	"database/sql"
	_ "embed"
	"fmt"
	"log/slog"
	"strings"
)

//go:embed schema.sql
var schemaSQL string

// RunMigrations executes the embedded schema SQL against the database.
func RunMigrations(db *sql.DB) error {
	statements := strings.Split(schemaSQL, ";")

	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}

		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("execute migration statement: %w\n--- statement ---\n%s", err, stmt)
		}
	}

	slog.Info("database migrations completed")
	return nil
}
