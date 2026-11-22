package store

import (
	"context"
	"errors"
	"path/filepath"
	"slices"
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
	if got.Title != "Buy milk" || got.Status != domain.StatusOpen || got.List != domain.ListInbox {
		t.Errorf("got %+v", got)
	}
	if !got.CreatedAt.Equal(created.CreatedAt) {
		t.Errorf("created_at = %v, want %v", got.CreatedAt, created.CreatedAt)
	}

	if err := got.Edit("Buy oat milk", "semi-skimmed", t0.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := got.Move(domain.ListWaiting, t0.Add(time.Hour)); err != nil {
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
	if again.Title != "Buy oat milk" || again.Description != "semi-skimmed" ||
		again.Status != domain.StatusDone || again.List != domain.ListWaiting {
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

func titles(tasks []domain.Task) []string {
	got := []string{}
	for _, task := range tasks {
		got = append(got, task.Title)
	}
	return got
}

func assertTitles(t *testing.T, view string, tasks []domain.Task, err error, want ...string) {
	t.Helper()
	if err != nil {
		t.Fatalf("%s: %v", view, err)
	}
	if tasks == nil {
		t.Errorf("%s = nil, want a non-nil slice so it encodes as []", view)
	}
	if want == nil {
		want = []string{}
	}
	if got := titles(tasks); !slices.Equal(got, want) {
		t.Errorf("%s = %v, want %v", view, got, want)
	}
}

func moveTo(l domain.List) func(*domain.Task) {
	return func(t *domain.Task) {
		if err := t.Move(l, t0); err != nil {
			panic(err)
		}
	}
}

func TestListOpen(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()

	// Created out of order to check sorting by created_at.
	create(t, s, "inbox second", t0.Add(2*time.Minute), nil)
	create(t, s, "inbox first", t0.Add(time.Minute), nil)
	create(t, s, "inbox done", t0, func(t *domain.Task) { t.Complete(t0) })
	create(t, s, "inbox dropped", t0, func(t *domain.Task) { t.Drop(t0) })
	create(t, s, "next", t0, moveTo(domain.ListNext))
	create(t, s, "waiting", t0, moveTo(domain.ListWaiting))
	create(t, s, "someday", t0, moveTo(domain.ListSomeday))
	create(t, s, "inbox third", t0.Add(3*time.Minute), nil)

	tasks, err := s.ListOpen(ctx, domain.ListInbox)
	assertTitles(t, "inbox", tasks, err, "inbox first", "inbox second", "inbox third")
	tasks, err = s.ListOpen(ctx, domain.ListNext)
	assertTitles(t, "next", tasks, err, "next")
	tasks, err = s.ListOpen(ctx, domain.ListWaiting)
	assertTitles(t, "waiting", tasks, err, "waiting")
	tasks, err = s.ListOpen(ctx, domain.ListSomeday)
	assertTitles(t, "someday", tasks, err, "someday")
}

func TestListCompleted(t *testing.T) {
	s := openTest(t)
	at := func(m int) func(*domain.Task) {
		return func(t *domain.Task) { t.Complete(t0.Add(time.Duration(m) * time.Minute)) }
	}

	create(t, s, "completed second", t0, at(2))
	create(t, s, "completed third", t0, at(3))
	create(t, s, "completed first", t0, at(1))
	create(t, s, "open", t0, nil)
	create(t, s, "dropped", t0, func(t *domain.Task) { t.Drop(t0) })

	tasks, err := s.ListCompleted(context.Background())
	assertTitles(t, "completed", tasks, err, "completed third", "completed second", "completed first")
}

func TestListDropped(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()
	at := func(m int) func(*domain.Task) {
		return func(t *domain.Task) { t.Drop(t0.Add(time.Duration(m) * time.Minute)) }
	}

	create(t, s, "dropped second", t0, at(2))
	first := create(t, s, "dropped first", t0, at(1))
	create(t, s, "dropped third", t0, at(3))
	create(t, s, "open", t0, nil)
	create(t, s, "done", t0, func(t *domain.Task) { t.Complete(t0) })

	tasks, err := s.ListDropped(ctx)
	assertTitles(t, "dropped", tasks, err, "dropped third", "dropped second", "dropped first")

	// Editing a dropped task updates it, so it moves to the top.
	if err := first.Edit("dropped first, edited", "", t0.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateTask(ctx, first); err != nil {
		t.Fatal(err)
	}
	tasks, err = s.ListDropped(ctx)
	assertTitles(t, "dropped after edit", tasks, err, "dropped first, edited", "dropped third", "dropped second")
}

// Every task appears in exactly one view.
func TestEveryTaskInOneView(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()

	lists := []domain.List{domain.ListInbox, domain.ListNext, domain.ListWaiting, domain.ListSomeday}
	statuses := map[string]func(*domain.Task){
		"open":    func(*domain.Task) {},
		"done":    func(t *domain.Task) { t.Complete(t0) },
		"dropped": func(t *domain.Task) { t.Drop(t0) },
	}
	want := map[int64]bool{}
	for _, l := range lists {
		for name, status := range statuses {
			task := create(t, s, string(l)+" "+name, t0, func(t *domain.Task) {
				moveTo(l)(t)
				status(t)
			})
			want[task.ID] = true
		}
	}

	seen := map[int64]int{}
	count := func(tasks []domain.Task, err error) {
		if err != nil {
			t.Fatal(err)
		}
		for _, task := range tasks {
			seen[task.ID]++
		}
	}
	for _, l := range lists {
		count(s.ListOpen(ctx, l))
	}
	count(s.ListCompleted(ctx))
	count(s.ListDropped(ctx))

	for id := range want {
		if seen[id] != 1 {
			t.Errorf("task %d appears in %d views, want 1", id, seen[id])
		}
	}
}

func TestListsEmpty(t *testing.T) {
	s := openTest(t)
	ctx := context.Background()

	tasks, err := s.ListOpen(ctx, domain.ListInbox)
	assertTitles(t, "inbox", tasks, err)
	tasks, err = s.ListCompleted(ctx)
	assertTitles(t, "completed", tasks, err)
	tasks, err = s.ListDropped(ctx)
	assertTitles(t, "dropped", tasks, err)
}
