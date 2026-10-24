// Package httpapi translates HTTP requests to and from the domain.
package httpapi

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/parradam/attrape/internal/domain"
	"github.com/parradam/attrape/internal/store"
)

const maxBodyBytes = 1 << 20

type api struct {
	store *store.Store
}

// New returns the application's HTTP handler. static is the built web app.
func New(st *store.Store, static fs.FS) http.Handler {
	a := &api{store: st}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", health)
	mux.HandleFunc("GET /api/inbox", a.listInbox)
	mux.HandleFunc("POST /api/tasks", a.createTask)
	mux.HandleFunc("PATCH /api/tasks/{id}", a.editTask)
	mux.HandleFunc("POST /api/tasks/{id}/complete", a.completeTask)
	mux.HandleFunc("POST /api/tasks/{id}/reopen", a.reopenTask)
	mux.Handle("/api/", http.NotFoundHandler())
	mux.Handle("/", spa(static))
	return mux
}

func health(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (a *api) listInbox(w http.ResponseWriter, r *http.Request) {
	tasks, err := a.store.ListInbox(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (a *api) createTask(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if !decode(w, r, &req) {
		return
	}

	task, err := domain.NewTask(req.Title, req.Description, time.Now())
	if err != nil {
		writeError(w, err)
		return
	}
	if err := a.store.CreateTask(r.Context(), &task); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (a *api) editTask(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
	}
	if !decode(w, r, &req) {
		return
	}

	a.updateTask(w, r, func(t *domain.Task) error {
		title, description := t.Title, t.Description
		if req.Title != nil {
			title = *req.Title
		}
		if req.Description != nil {
			description = *req.Description
		}
		return t.Edit(title, description, time.Now())
	})
}

func (a *api) completeTask(w http.ResponseWriter, r *http.Request) {
	a.updateTask(w, r, func(t *domain.Task) error {
		t.Complete(time.Now())
		return nil
	})
}

func (a *api) reopenTask(w http.ResponseWriter, r *http.Request) {
	a.updateTask(w, r, func(t *domain.Task) error {
		t.Reopen(time.Now())
		return nil
	})
}

// updateTask loads the task named in the path, applies change and saves it.
func (a *api) updateTask(w http.ResponseWriter, r *http.Request, change func(*domain.Task) error) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, store.ErrNotFound)
		return
	}
	task, err := a.store.GetTask(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := change(&task); err != nil {
		writeError(w, err)
		return
	}
	if err := a.store.UpdateTask(r.Context(), task); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody{"invalid JSON body"})
		return false
	}
	return true
}

type errorBody struct {
	Error string `json:"error"`
}

// writeError maps domain and store errors to HTTP responses.
func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrTitleRequired):
		writeJSON(w, http.StatusBadRequest, errorBody{err.Error()})
	case errors.Is(err, store.ErrNotFound):
		writeJSON(w, http.StatusNotFound, errorBody{err.Error()})
	default:
		slog.Error("request failed", "err", err)
		writeJSON(w, http.StatusInternalServerError, errorBody{"internal error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("encoding response", "err", err)
	}
}
