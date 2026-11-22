package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
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
		{"drop", http.MethodPost, "/api/tasks/1/drop", "", http.StatusOK},
		{"drop missing task", http.MethodPost, "/api/tasks/999/drop", "", http.StatusNotFound},
		{"move", http.MethodPost, "/api/tasks/1/move", `{"list":"next"}`, http.StatusOK},
		{"move to own list", http.MethodPost, "/api/tasks/1/move", `{"list":"inbox"}`, http.StatusOK},
		{"move to unknown list", http.MethodPost, "/api/tasks/1/move", `{"list":"completed"}`, http.StatusBadRequest},
		{"move with no list", http.MethodPost, "/api/tasks/1/move", `{}`, http.StatusBadRequest},
		{"move with bad JSON", http.MethodPost, "/api/tasks/1/move", `{`, http.StatusBadRequest},
		{"move missing task", http.MethodPost, "/api/tasks/999/move", `{"list":"next"}`, http.StatusNotFound},
		{"inbox view", http.MethodGet, "/api/views/inbox", "", http.StatusOK},
		{"next view", http.MethodGet, "/api/views/next", "", http.StatusOK},
		{"waiting view", http.MethodGet, "/api/views/waiting", "", http.StatusOK},
		{"someday view", http.MethodGet, "/api/views/someday", "", http.StatusOK},
		{"completed view", http.MethodGet, "/api/views/completed", "", http.StatusOK},
		{"dropped view", http.MethodGet, "/api/views/dropped", "", http.StatusOK},
		{"unknown view", http.MethodGet, "/api/views/today", "", http.StatusNotFound},
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

	if got := viewTitles(t, h, "inbox"); !slices.Equal(got, []string{"Buy oat milk"}) {
		t.Errorf("inbox = %v, want only the open task", got)
	}

	reopened := decodeTask(t, do(t, h, http.MethodPost, "/api/tasks/2/reopen", ""))
	if reopened.Status != domain.StatusOpen || reopened.CompletedAt != nil {
		t.Errorf("reopened %+v", reopened)
	}
}

func viewTitles(t *testing.T, h http.Handler, view string) []string {
	t.Helper()
	rec := do(t, h, http.MethodGet, "/api/views/"+view, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("view %s: status = %d", view, rec.Code)
	}
	var tasks []domain.Task
	if err := json.NewDecoder(rec.Body).Decode(&tasks); err != nil {
		t.Fatal(err)
	}
	titles := []string{}
	for _, task := range tasks {
		titles = append(titles, task.Title)
	}
	return titles
}

func TestEmptyViewIsAnArray(t *testing.T) {
	rec := do(t, newTestHandler(t), http.MethodGet, "/api/views/dropped", "")
	if body := strings.TrimSpace(rec.Body.String()); body != "[]" {
		t.Errorf("body = %s, want []", body)
	}
}

// TestViewsFlow captures a task, moves it, completes it, drops it and
// restores it, checking which view it's in at each point.
func TestViewsFlow(t *testing.T) {
	h := newTestHandler(t)
	views := func() map[string][]string {
		got := map[string][]string{}
		for _, v := range []string{"inbox", "next", "waiting", "someday", "completed", "dropped"} {
			if titles := viewTitles(t, h, v); len(titles) > 0 {
				got[v] = titles
			}
		}
		return got
	}
	check := func(step string, want map[string][]string) {
		t.Helper()
		got := views()
		if len(got) != len(want) {
			t.Fatalf("%s: views = %v, want %v", step, got, want)
		}
		for v, titles := range want {
			if !slices.Equal(got[v], titles) {
				t.Fatalf("%s: views = %v, want %v", step, got, want)
			}
		}
	}

	task := decodeTask(t, do(t, h, http.MethodPost, "/api/tasks", `{"title":"Buy milk"}`))
	if task.List != domain.ListInbox {
		t.Errorf("new task list = %q, want inbox", task.List)
	}
	check("captured", map[string][]string{"inbox": {"Buy milk"}})

	moved := decodeTask(t, do(t, h, http.MethodPost, "/api/tasks/1/move", `{"list":"waiting"}`))
	if moved.List != domain.ListWaiting {
		t.Errorf("moved list = %q, want waiting", moved.List)
	}
	check("moved", map[string][]string{"waiting": {"Buy milk"}})

	do(t, h, http.MethodPost, "/api/tasks/1/complete", "")
	check("completed", map[string][]string{"completed": {"Buy milk"}})

	// A done task is frozen: dropping or moving it changes nothing.
	done := decodeTask(t, do(t, h, http.MethodPost, "/api/tasks/1/drop", ""))
	if done.Status != domain.StatusDone {
		t.Errorf("dropping a done task: status = %q, want done", done.Status)
	}
	unmoved := decodeTask(t, do(t, h, http.MethodPost, "/api/tasks/1/move", `{"list":"next"}`))
	if unmoved.List != domain.ListWaiting || !unmoved.UpdatedAt.Equal(done.UpdatedAt) {
		t.Errorf("moving a done task changed it: %+v", unmoved)
	}
	check("frozen", map[string][]string{"completed": {"Buy milk"}})

	do(t, h, http.MethodPost, "/api/tasks/1/reopen", "")
	check("reopened", map[string][]string{"waiting": {"Buy milk"}})

	dropped := decodeTask(t, do(t, h, http.MethodPost, "/api/tasks/1/drop", ""))
	if dropped.Status != domain.StatusDropped {
		t.Errorf("dropped status = %q", dropped.Status)
	}
	check("dropped", map[string][]string{"dropped": {"Buy milk"}})

	restored := decodeTask(t, do(t, h, http.MethodPost, "/api/tasks/1/reopen", ""))
	if restored.Status != domain.StatusOpen || restored.List != domain.ListWaiting {
		t.Errorf("restored %+v, want open in waiting", restored)
	}
	check("restored", map[string][]string{"waiting": {"Buy milk"}})
}
