package domain

import (
	"errors"
	"testing"
	"time"
)

var (
	t0 = time.Date(2026, 10, 24, 9, 0, 0, 0, time.UTC)
	t1 = t0.Add(time.Hour)
)

func TestNewTask(t *testing.T) {
	tests := []struct {
		name      string
		title     string
		wantTitle string
		wantErr   error
	}{
		{"plain title", "Buy milk", "Buy milk", nil},
		{"trims whitespace", "  Buy milk \n", "Buy milk", nil},
		{"empty title", "", "", ErrTitleRequired},
		{"whitespace-only title", " \t\n", "", ErrTitleRequired},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task, err := NewTask(tt.title, "notes", t0)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if err != nil {
				return
			}
			if task.Title != tt.wantTitle {
				t.Errorf("title = %q, want %q", task.Title, tt.wantTitle)
			}
			if task.Description != "notes" {
				t.Errorf("description = %q, want %q", task.Description, "notes")
			}
			if task.Status != StatusOpen {
				t.Errorf("status = %q, want %q", task.Status, StatusOpen)
			}
			if !task.CreatedAt.Equal(t0) || !task.UpdatedAt.Equal(t0) {
				t.Errorf("timestamps = %v, %v, want %v", task.CreatedAt, task.UpdatedAt, t0)
			}
		})
	}
}

func TestTimestampsAreUTCMicroseconds(t *testing.T) {
	task, err := NewTask("Buy milk", "", t0.Add(1500*time.Nanosecond))
	if err != nil {
		t.Fatal(err)
	}
	if want := t0.Add(time.Microsecond); !task.CreatedAt.Equal(want) {
		t.Errorf("created_at = %v, want %v", task.CreatedAt, want)
	}
}

func TestNewTaskStoresUTC(t *testing.T) {
	london, err := time.LoadLocation("Europe/London")
	if err != nil {
		t.Skip("no tzdata:", err)
	}
	task, err := NewTask("Buy milk", "", t0.In(london))
	if err != nil {
		t.Fatal(err)
	}
	if task.CreatedAt.Location() != time.UTC {
		t.Errorf("created_at location = %v, want UTC", task.CreatedAt.Location())
	}
}

func TestEdit(t *testing.T) {
	tests := []struct {
		name      string
		title     string
		wantTitle string
		wantDesc  string
		wantErr   error
	}{
		{"changes both", "Buy oat milk", "Buy oat milk", "new notes", nil},
		{"trims whitespace", "  Buy oat milk ", "Buy oat milk", "new notes", nil},
		{"blank title keeps old values", "  ", "Buy milk", "notes", ErrTitleRequired},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task, _ := NewTask("Buy milk", "notes", t0)
			err := task.Edit(tt.title, "new notes", t1)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if task.Title != tt.wantTitle || task.Description != tt.wantDesc {
				t.Errorf("got %q/%q, want %q/%q", task.Title, task.Description, tt.wantTitle, tt.wantDesc)
			}
			wantUpdated := t1
			if err != nil {
				wantUpdated = t0
			}
			if !task.UpdatedAt.Equal(wantUpdated) {
				t.Errorf("updated_at = %v, want %v", task.UpdatedAt, wantUpdated)
			}
		})
	}
}

// TestStatusAndListChanges covers the spec's Keys table: what each action
// does to an open, done and dropped task, and when it does nothing.
func TestStatusAndListChanges(t *testing.T) {
	complete := func(t *Task) { t.Complete(t1) }
	drop := func(t *Task) { t.Drop(t1) }
	reopen := func(t *Task) { t.Reopen(t1) }
	moveTo := func(l List) func(*Task) {
		return func(t *Task) {
			if err := t.Move(l, t1); err != nil {
				panic(err)
			}
		}
	}

	tests := []struct {
		name          string
		start         Status
		act           func(*Task)
		wantStatus    Status
		wantList      List
		wantCompleted bool
		wantUpdated   time.Time
	}{
		{"complete open task", StatusOpen, complete, StatusDone, ListNext, true, t1},
		{"drop open task", StatusOpen, drop, StatusDropped, ListNext, false, t1},
		{"reopen open task does nothing", StatusOpen, reopen, StatusOpen, ListNext, false, t0},
		{"move open task", StatusOpen, moveTo(ListWaiting), StatusOpen, ListWaiting, false, t1},
		{"move open task to its own list does nothing", StatusOpen, moveTo(ListNext), StatusOpen, ListNext, false, t0},

		{"complete done task does nothing", StatusDone, complete, StatusDone, ListNext, true, t0},
		{"drop done task does nothing", StatusDone, drop, StatusDone, ListNext, true, t0},
		{"reopen done task", StatusDone, reopen, StatusOpen, ListNext, false, t1},
		{"move done task does nothing", StatusDone, moveTo(ListWaiting), StatusDone, ListNext, true, t0},

		{"complete dropped task does nothing", StatusDropped, complete, StatusDropped, ListNext, false, t0},
		{"drop dropped task does nothing", StatusDropped, drop, StatusDropped, ListNext, false, t0},
		{"restore dropped task", StatusDropped, reopen, StatusOpen, ListNext, false, t1},
		{"move dropped task does nothing", StatusDropped, moveTo(ListWaiting), StatusDropped, ListNext, false, t0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task, _ := NewTask("Buy milk", "", t0)
			task.List = ListNext
			task.Status = tt.start
			if tt.start == StatusDone {
				completed := t0
				task.CompletedAt = &completed
			}

			tt.act(&task)

			if task.Status != tt.wantStatus {
				t.Errorf("status = %q, want %q", task.Status, tt.wantStatus)
			}
			if task.List != tt.wantList {
				t.Errorf("list = %q, want %q", task.List, tt.wantList)
			}
			if (task.CompletedAt != nil) != tt.wantCompleted {
				t.Errorf("completed_at = %v, want set = %v", task.CompletedAt, tt.wantCompleted)
			}
			if !task.UpdatedAt.Equal(tt.wantUpdated) {
				t.Errorf("updated_at = %v, want %v", task.UpdatedAt, tt.wantUpdated)
			}
		})
	}
}

func TestMoveToUnknownList(t *testing.T) {
	for _, status := range []Status{StatusOpen, StatusDone, StatusDropped} {
		t.Run(string(status), func(t *testing.T) {
			task, _ := NewTask("Buy milk", "", t0)
			task.Status = status
			if err := task.Move("completed", t1); !errors.Is(err, ErrInvalidList) {
				t.Fatalf("err = %v, want %v", err, ErrInvalidList)
			}
			if task.List != ListInbox || !task.UpdatedAt.Equal(t0) {
				t.Errorf("task changed: list %q, updated_at %v", task.List, task.UpdatedAt)
			}
		})
	}
}

func TestNewTaskIsInInbox(t *testing.T) {
	task, err := NewTask("Buy milk", "", t0)
	if err != nil {
		t.Fatal(err)
	}
	if task.List != ListInbox {
		t.Errorf("list = %q, want %q", task.List, ListInbox)
	}
}

func TestEditFrozenTask(t *testing.T) {
	for _, status := range []Status{StatusDone, StatusDropped} {
		t.Run(string(status), func(t *testing.T) {
			task, _ := NewTask("Buy milk", "", t0)
			task.Status = status
			if err := task.Edit("Buy oat milk", "", t1); err != nil {
				t.Fatal(err)
			}
			if task.Title != "Buy oat milk" || task.Status != status {
				t.Errorf("got %q (%s), want %q (%s)", task.Title, task.Status, "Buy oat milk", status)
			}
		})
	}
}

func TestParseList(t *testing.T) {
	tests := []struct {
		in      string
		want    List
		wantErr error
	}{
		{"inbox", ListInbox, nil},
		{"next", ListNext, nil},
		{"waiting", ListWaiting, nil},
		{"someday", ListSomeday, nil},
		{"completed", "", ErrInvalidList},
		{"dropped", "", ErrInvalidList},
		{"Inbox", "", ErrInvalidList},
		{"", "", ErrInvalidList},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			got, err := ParseList(tt.in)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("list = %q, want %q", got, tt.want)
			}
		})
	}
}
