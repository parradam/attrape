package store

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/parradam/attrape/internal/domain"
)

var t0 = time.Date(2026, 10, 24, 9, 0, 0, 0, time.UTC)

func openTest(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := s.Close(); err != nil {
			t.Error(err)
		}
	})
	return s
}

func create(t *testing.T, s *Store, title string, at time.Time, edit func(*domain.Task)) domain.Task {
	t.Helper()
	task, err := domain.NewTask(title, "", at)
	if err != nil {
		t.Fatal(err)
	}
	if edit != nil {
		edit(&task)
	}
	if err := s.CreateTask(context.Background(), &task); err != nil {
		t.Fatal(err)
	}
	return task
}

func TestTaskRoundTrip(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()

	created := create(t, s, "Buy milk", t0.Add(123456789*time.Nanosecond), nil)
	if created.ID == 0 {
		t.Fatal("ID not set")
	}

	got, err := s.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Buy milk" || got.Status != domain.StatusOpen {
		t.Errorf("got %+v", got)
	}
	if !got.CreatedAt.Equal(created.CreatedAt) {
		t.Errorf("created_at = %v, want %v", got.CreatedAt, created.CreatedAt)
	}

	if err := got.Edit("Buy oat milk", "semi-skimmed", t0.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	got.Complete(t0.Add(time.Hour))
	if err := s.UpdateTask(ctx, got); err != nil {
		t.Fatal(err)
	}

	again, err := s.GetTask(ctx, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if again.Title != "Buy oat milk" || again.Description != "semi-skimmed" || again.Status != domain.StatusDone {
		t.Errorf("after update got %+v", again)
	}
	if again.CompletedAt == nil || !again.CompletedAt.Equal(t0.Add(time.Hour)) {
		t.Errorf("completed_at = %v", again.CompletedAt)
	}
}

func TestTaskNotFound(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()

	if _, err := s.GetTask(ctx, 999); !errors.Is(err, ErrNotFound) {
		t.Errorf("GetTask err = %v, want ErrNotFound", err)
	}
	if err := s.UpdateTask(ctx, domain.Task{ID: 999, CreatedAt: t0, UpdatedAt: t0}); !errors.Is(err, ErrNotFound) {
		t.Errorf("UpdateTask err = %v, want ErrNotFound", err)
	}
}

func TestListInbox(t *testing.T) {
	s := openTest(t)
	id := int64(1)
	doAt := t0.Add(24 * time.Hour)

	// Created out of order to check sorting by created_at.
	create(t, s, "second", t0.Add(2*time.Minute), nil)
	create(t, s, "first", t0.Add(time.Minute), nil)
	create(t, s, "done", t0, func(t *domain.Task) { t.Complete(t0) })
	create(t, s, "dropped", t0, func(t *domain.Task) { t.Status = domain.StatusDropped })
	create(t, s, "in a project", t0, func(t *domain.Task) { t.ProjectID = &id })
	create(t, s, "in an area", t0, func(t *domain.Task) { t.AreaID = &id })
	create(t, s, "scheduled", t0, func(t *domain.Task) { t.DoAt = &doAt })
	create(t, s, "third", t0.Add(3*time.Minute), nil)

	tasks, err := s.ListInbox(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, task := range tasks {
		got = append(got, task.Title)
	}
	want := []string{"first", "second", "third"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
}

func TestListInboxEmpty(t *testing.T) {
	tasks, err := openTest(t).ListInbox(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if tasks == nil || len(tasks) != 0 {
		t.Errorf("got %v, want empty non-nil slice", tasks)
	}
}
