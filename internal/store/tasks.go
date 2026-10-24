package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/parradam/attrape/internal/domain"
)

// ErrNotFound is returned when a row doesn't exist.
var ErrNotFound = errors.New("not found")

// timeLayout stores UTC timestamps at a fixed width so they sort as text.
const timeLayout = "2006-01-02T15:04:05.000000Z"

const taskColumns = `id, title, description, status, project_id, area_id,
	do_at, due_at, completed_at, created_at, updated_at`

// taskOrder is the standard task ordering: soonest do_at first, then
// undated tasks oldest first. Every task list should use it.
const taskOrder = `do_at IS NULL, do_at, created_at, id`

// CreateTask inserts t and sets its ID.
func (s *Store) CreateTask(ctx context.Context, t *domain.Task) error {
	res, err := s.db.ExecContext(ctx, `INSERT INTO tasks (title, description, status, project_id, area_id,
		do_at, due_at, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.Title, t.Description, t.Status, t.ProjectID, t.AreaID,
		formatTimePtr(t.DoAt), formatTimePtr(t.DueAt), formatTimePtr(t.CompletedAt),
		formatTime(t.CreatedAt), formatTime(t.UpdatedAt))
	if err != nil {
		return err
	}
	t.ID, err = res.LastInsertId()
	return err
}

// GetTask returns the task with the given ID, or ErrNotFound.
func (s *Store) GetTask(ctx context.Context, id int64) (domain.Task, error) {
	row := s.db.QueryRowContext(ctx, `SELECT `+taskColumns+` FROM tasks WHERE id = ?`, id)
	t, err := scanTask(row)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Task{}, ErrNotFound
	}
	return t, err
}

// UpdateTask saves every field of t, or returns ErrNotFound.
func (s *Store) UpdateTask(ctx context.Context, t domain.Task) error {
	res, err := s.db.ExecContext(ctx, `UPDATE tasks SET title = ?, description = ?, status = ?,
		project_id = ?, area_id = ?, do_at = ?, due_at = ?, completed_at = ?, created_at = ?, updated_at = ?
		WHERE id = ?`,
		t.Title, t.Description, t.Status, t.ProjectID, t.AreaID,
		formatTimePtr(t.DoAt), formatTimePtr(t.DueAt), formatTimePtr(t.CompletedAt),
		formatTime(t.CreatedAt), formatTime(t.UpdatedAt), t.ID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ListInbox returns open tasks with no project, area or do_at.
func (s *Store) ListInbox(ctx context.Context) ([]domain.Task, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT `+taskColumns+` FROM tasks
		WHERE status = 'open' AND project_id IS NULL AND area_id IS NULL AND do_at IS NULL
		ORDER BY `+taskOrder)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := []domain.Task{}
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanTask(row scanner) (domain.Task, error) {
	var (
		t                        domain.Task
		doAt, dueAt, completedAt sql.NullString
		createdAt, updatedAt     string
	)
	err := row.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.ProjectID, &t.AreaID,
		&doAt, &dueAt, &completedAt, &createdAt, &updatedAt)
	if err != nil {
		return domain.Task{}, err
	}

	var errs []error
	t.DoAt, err = parseTimePtr(doAt)
	errs = append(errs, err)
	t.DueAt, err = parseTimePtr(dueAt)
	errs = append(errs, err)
	t.CompletedAt, err = parseTimePtr(completedAt)
	errs = append(errs, err)
	t.CreatedAt, err = parseTime(createdAt)
	errs = append(errs, err)
	t.UpdatedAt, err = parseTime(updatedAt)
	errs = append(errs, err)
	return t, errors.Join(errs...)
}

func formatTime(t time.Time) string {
	return t.UTC().Format(timeLayout)
}

func formatTimePtr(t *time.Time) any {
	if t == nil {
		return nil
	}
	return formatTime(*t)
}

func parseTime(s string) (time.Time, error) {
	return time.Parse(time.RFC3339Nano, s)
}

func parseTimePtr(s sql.NullString) (*time.Time, error) {
	if !s.Valid {
		return nil, nil
	}
	t, err := parseTime(s.String)
	if err != nil {
		return nil, err
	}
	return &t, nil
}
