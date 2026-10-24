package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/parradam/attrape/internal/domain"
	"github.com/parradam/attrape/internal/store"
)

func newTestHandler(t *testing.T) http.Handler {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := st.Close(); err != nil {
			t.Error(err)
		}
	})
	return New(st, fstest.MapFS{"index.html": {Data: []byte("<html>app</html>")}})
}

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

func decodeTask(t *testing.T, rec *httptest.ResponseRecorder) domain.Task {
	t.Helper()
	var task domain.Task
	if err := json.NewDecoder(rec.Body).Decode(&task); err != nil {
		t.Fatalf("decoding %q: %v", rec.Body.String(), err)
	}
	return task
}

func TestHealth(t *testing.T) {
	rec := do(t, newTestHandler(t), http.MethodGet, "/healthz", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestStatusCodes(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
		body   string
		want   int
	}{
		{"create", http.MethodPost, "/api/tasks", `{"title":"Buy milk"}`, http.StatusCreated},
		{"create with blank title", http.MethodPost, "/api/tasks", `{"title":"  "}`, http.StatusBadRequest},
		{"create with no title", http.MethodPost, "/api/tasks", `{}`, http.StatusBadRequest},
		{"create with bad JSON", http.MethodPost, "/api/tasks", `{`, http.StatusBadRequest},
		{"edit", http.MethodPatch, "/api/tasks/1", `{"title":"Buy oat milk"}`, http.StatusOK},
		{"edit with blank title", http.MethodPatch, "/api/tasks/1", `{"title":""}`, http.StatusBadRequest},
		{"edit description only", http.MethodPatch, "/api/tasks/1", `{"description":"notes"}`, http.StatusOK},
		{"edit missing task", http.MethodPatch, "/api/tasks/999", `{"title":"x"}`, http.StatusNotFound},
		{"edit bad id", http.MethodPatch, "/api/tasks/abc", `{"title":"x"}`, http.StatusNotFound},
		{"complete", http.MethodPost, "/api/tasks/1/complete", "", http.StatusOK},
		{"complete missing task", http.MethodPost, "/api/tasks/999/complete", "", http.StatusNotFound},
		{"reopen", http.MethodPost, "/api/tasks/1/reopen", "", http.StatusOK},
		{"reopen missing task", http.MethodPost, "/api/tasks/999/reopen", "", http.StatusNotFound},
		{"inbox", http.MethodGet, "/api/inbox", "", http.StatusOK},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newTestHandler(t)
			if rec := do(t, h, http.MethodPost, "/api/tasks", `{"title":"Buy milk"}`); rec.Code != http.StatusCreated {
				t.Fatalf("setup: status = %d", rec.Code)
			}

			rec := do(t, h, tt.method, tt.path, tt.body)
			if rec.Code != tt.want {
				t.Errorf("status = %d, want %d (body %s)", rec.Code, tt.want, rec.Body.String())
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}
		})
	}
}

func TestInboxFlow(t *testing.T) {
	h := newTestHandler(t)

	first := decodeTask(t, do(t, h, http.MethodPost, "/api/tasks", `{"title":" Buy milk ","description":"semi-skimmed"}`))
	if first.Title != "Buy milk" || first.Description != "semi-skimmed" || first.Status != domain.StatusOpen {
		t.Errorf("created %+v", first)
	}
	do(t, h, http.MethodPost, "/api/tasks", `{"title":"Call the bank"}`)

	edited := decodeTask(t, do(t, h, http.MethodPatch, "/api/tasks/1", `{"title":"Buy oat milk"}`))
	if edited.Title != "Buy oat milk" || edited.Description != "semi-skimmed" {
		t.Errorf("edited %+v, want new title and unchanged description", edited)
	}

	done := decodeTask(t, do(t, h, http.MethodPost, "/api/tasks/2/complete", ""))
	if done.Status != domain.StatusDone || done.CompletedAt == nil {
		t.Errorf("completed %+v", done)
	}

	var inbox []domain.Task
	if err := json.NewDecoder(do(t, h, http.MethodGet, "/api/inbox", "").Body).Decode(&inbox); err != nil {
		t.Fatal(err)
	}
	if len(inbox) != 1 || inbox[0].Title != "Buy oat milk" {
		t.Errorf("inbox = %+v, want only the open task", inbox)
	}

	reopened := decodeTask(t, do(t, h, http.MethodPost, "/api/tasks/2/reopen", ""))
	if reopened.Status != domain.StatusOpen || reopened.CompletedAt != nil {
		t.Errorf("reopened %+v", reopened)
	}
}
