package store

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"sort"
)

//go:embed migrations/*.sql
var migrations embed.FS

// migrate applies any migrations newer than the database's user_version.
// Migrations are numbered files applied in name order, each in its own
// transaction; user_version records how many have been applied.
func migrate(db *sql.DB) error {
	names, err := fs.Glob(migrations, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(names)

	var version int
	if err := db.QueryRow("PRAGMA user_version").Scan(&version); err != nil {
		return err
	}

	for i := version; i < len(names); i++ {
		body, err := migrations.ReadFile(names[i])
		if err != nil {
			return err
		}
		if err := apply(db, string(body), i+1); err != nil {
			return fmt.Errorf("migration %s: %w", names[i], err)
		}
	}
	return nil
}

func apply(db *sql.DB, body string, version int) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(body); err != nil {
		return err
	}
	// PRAGMA doesn't accept bound parameters; version is an int we control.
	if _, err := tx.Exec(fmt.Sprintf("PRAGMA user_version = %d", version)); err != nil {
		return err
	}
	return tx.Commit()
}
