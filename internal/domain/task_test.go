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

func TestCompleteAndReopen(t *testing.T) {
	tests := []struct {
		name          string
		start         Status
		act           func(*Task)
		wantStatus    Status
		wantCompleted bool
		wantUpdated   time.Time
	}{
		{"complete open task", StatusOpen, func(t *Task) { t.Complete(t1) }, StatusDone, true, t1},
		{"complete done task is a no-op", StatusDone, func(t *Task) { t.Complete(t1) }, StatusDone, true, t0},
		{"complete dropped task", StatusDropped, func(t *Task) { t.Complete(t1) }, StatusDone, true, t1},
		{"reopen done task", StatusDone, func(t *Task) { t.Reopen(t1) }, StatusOpen, false, t1},
		{"reopen open task is a no-op", StatusOpen, func(t *Task) { t.Reopen(t1) }, StatusOpen, false, t0},
		{"reopen dropped task", StatusDropped, func(t *Task) { t.Reopen(t1) }, StatusOpen, false, t1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task, _ := NewTask("Buy milk", "", t0)
			task.Status = tt.start
			if tt.start == StatusDone {
				completed := t0
				task.CompletedAt = &completed
			}

			tt.act(&task)

			if task.Status != tt.wantStatus {
				t.Errorf("status = %q, want %q", task.Status, tt.wantStatus)
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
