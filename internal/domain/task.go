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

// List is where an open task belongs. Done and dropped tasks keep theirs, so
// reopening or restoring returns them to it.
type List string

const (
	ListInbox   List = "inbox"
	ListNext    List = "next"
	ListWaiting List = "waiting"
	ListSomeday List = "someday"
)

var (
	// ErrTitleRequired is returned when a task's title is blank.
	ErrTitleRequired = errors.New("title is required")
	// ErrInvalidList is returned for a list name that isn't one of the four.
	ErrInvalidList = errors.New("list must be inbox, next, waiting or someday")
)

// ParseList returns the list with the given name, or ErrInvalidList.
func ParseList(s string) (List, error) {
	switch l := List(s); l {
	case ListInbox, ListNext, ListWaiting, ListSomeday:
		return l, nil
	}
	return "", ErrInvalidList
}

// Task is a single thing to do.
type Task struct {
	ID          int64      `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      Status     `json:"status"`
	List        List       `json:"list"`
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
	now = stamp(now)
	return Task{
		Title:       title,
		Description: description,
		Status:      StatusOpen,
		List:        ListInbox,
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
	t.UpdatedAt = stamp(now)
	return nil
}

// Done and dropped tasks are frozen: Complete, Drop and Move change nothing
// until Reopen makes them open again. They can still be edited.

// Complete marks an open task done.
func (t *Task) Complete(now time.Time) {
	if t.Status != StatusOpen {
		return
	}
	now = stamp(now)
	t.Status = StatusDone
	t.CompletedAt = &now
	t.UpdatedAt = now
}

// Drop marks an open task dropped.
func (t *Task) Drop(now time.Time) {
	if t.Status != StatusOpen {
		return
	}
	t.Status = StatusDropped
	t.UpdatedAt = stamp(now)
}

// Reopen marks a done or dropped task open again, back in its list. For a
// dropped task this is restoring it. Reopening an open task changes nothing.
func (t *Task) Reopen(now time.Time) {
	if t.Status == StatusOpen {
		return
	}
	t.Status = StatusOpen
	t.CompletedAt = nil
	t.UpdatedAt = stamp(now)
}

// Move puts an open task in another list. Moving it to the list it's
// already in changes nothing. An unknown list returns ErrInvalidList, whatever
// the task's status, and leaves the task unchanged.
func (t *Task) Move(list List, now time.Time) error {
	if _, err := ParseList(string(list)); err != nil {
		return err
	}
	if t.Status != StatusOpen || t.List == list {
		return nil
	}
	t.List = list
	t.UpdatedAt = stamp(now)
	return nil
}

// stamp returns now in UTC to the microsecond, the precision timestamps are
// stored at, so a task looks the same before and after it's saved.
func stamp(now time.Time) time.Time {
	return now.UTC().Truncate(time.Microsecond)
}

func cleanTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", ErrTitleRequired
	}
	return title, nil
}
