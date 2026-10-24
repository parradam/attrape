package store

import (
	"path/filepath"
	"testing"
)

func TestMigrationsApplyCleanly(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")

	s, err := Open(path)
	if err != nil {
		t.Fatalf("first open: %v", err)
	}
	want := userVersion(t, s)
	if want == 0 {
		t.Fatal("user_version = 0 after migrating, want > 0")
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}

	// Reopening must not re-run migrations.
	s, err = Open(path)
	if err != nil {
		t.Fatalf("second open: %v", err)
	}
	t.Cleanup(func() {
		if err := s.Close(); err != nil {
			t.Error(err)
		}
	})
	if got := userVersion(t, s); got != want {
		t.Fatalf("user_version = %d after reopen, want %d", got, want)
	}

	if _, err := s.db.Exec(`SELECT id, title, description, status, project_id, area_id,
		do_at, due_at, completed_at, created_at, updated_at FROM tasks`); err != nil {
		t.Fatalf("tasks table: %v", err)
	}
}

func userVersion(t *testing.T, s *Store) int {
	t.Helper()
	var v int
	if err := s.db.QueryRow("PRAGMA user_version").Scan(&v); err != nil {
		t.Fatal(err)
	}
	return v
}
