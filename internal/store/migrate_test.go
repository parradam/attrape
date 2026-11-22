package store

import (
	"database/sql"
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

	if _, err := s.db.Exec(`SELECT id, title, description, status, list, project_id, area_id,
		do_at, due_at, completed_at, created_at, updated_at FROM tasks`); err != nil {
		t.Fatalf("tasks table: %v", err)
	}
}

// A database created by 001a has tasks but no list column. Migrating it puts
// every existing task in the Inbox and keeps its status.
func TestMigrateFrom001a(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	body, err := migrations.ReadFile("migrations/001_tasks.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(string(body)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`PRAGMA user_version = 1`); err != nil {
		t.Fatal(err)
	}
	const ts = "2026-10-24T09:00:00.000000Z"
	if _, err := db.Exec(`INSERT INTO tasks (title, status, completed_at, created_at, updated_at)
		VALUES ('Open task', 'open', NULL, ?, ?), ('Done task', 'done', ?, ?, ?)`,
		ts, ts, ts, ts, ts); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	s, err := Open(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() {
		if err := s.Close(); err != nil {
			t.Error(err)
		}
	})

	rows, err := s.db.Query(`SELECT title, status, list FROM tasks ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var got [][3]string
	for rows.Next() {
		var r [3]string
		if err := rows.Scan(&r[0], &r[1], &r[2]); err != nil {
			t.Fatal(err)
		}
		got = append(got, r)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	want := [][3]string{{"Open task", "open", "inbox"}, {"Done task", "done", "inbox"}}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Errorf("tasks = %v, want %v", got, want)
	}
}

func TestListColumnRejectsUnknownLists(t *testing.T) {
	s := openTest(t)
	const ts = "2026-10-24T09:00:00.000000Z"
	for _, list := range []string{"inbox", "next", "waiting", "someday"} {
		if _, err := s.db.Exec(`INSERT INTO tasks (title, list, created_at, updated_at) VALUES ('t', ?, ?, ?)`,
			list, ts, ts); err != nil {
			t.Errorf("list %q: %v", list, err)
		}
	}
	for _, list := range []string{"completed", "dropped", "", "Inbox"} {
		if _, err := s.db.Exec(`INSERT INTO tasks (title, list, created_at, updated_at) VALUES ('t', ?, ?, ?)`,
			list, ts, ts); err == nil {
			t.Errorf("list %q was accepted, want a CHECK error", list)
		}
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
