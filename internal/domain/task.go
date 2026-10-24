// Package domain holds the application's business rules.
package domain

import (
	"errors"
	"strings"
	"time"
)

// Status is where a task is in its life.
type Status string

const (
	StatusOpen    Status = "open"
	StatusDone    Status = "done"
	StatusDropped Status = "dropped"
)

// ErrTitleRequired is returned when a task's title is blank.
var ErrTitleRequired = errors.New("title is required")

// Task is a single thing to do.
type Task struct {
	ID          int64      `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      Status     `json:"status"`
	ProjectID   *int64     `json:"project_id"`
	AreaID      *int64     `json:"area_id"`
	DoAt        *time.Time `json:"do_at"`
	DueAt       *time.Time `json:"due_at"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// NewTask returns an open task with a trimmed title. It isn't saved yet.
func NewTask(title, description string, now time.Time) (Task, error) {
	title, err := cleanTitle(title)
	if err != nil {
		return Task{}, err
	}
	now = now.UTC()
	return Task{
		Title:       title,
		Description: description,
		Status:      StatusOpen,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// Edit changes the title and description. On error the task is unchanged.
func (t *Task) Edit(title, description string, now time.Time) error {
	title, err := cleanTitle(title)
	if err != nil {
		return err
	}
	t.Title = title
	t.Description = description
	t.UpdatedAt = now.UTC()
	return nil
}

// Complete marks the task done. Completing a done task changes nothing.
func (t *Task) Complete(now time.Time) {
	if t.Status == StatusDone {
		return
	}
	now = now.UTC()
	t.Status = StatusDone
	t.CompletedAt = &now
	t.UpdatedAt = now
}

// Reopen marks the task open again. Reopening an open task changes nothing.
func (t *Task) Reopen(now time.Time) {
	if t.Status == StatusOpen {
		return
	}
	t.Status = StatusOpen
	t.CompletedAt = nil
	t.UpdatedAt = now.UTC()
}

func cleanTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", ErrTitleRequired
	}
	return title, nil
}
