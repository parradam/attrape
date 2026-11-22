ALTER TABLE tasks ADD COLUMN list TEXT NOT NULL DEFAULT 'inbox'
    CHECK (list IN ('inbox', 'next', 'waiting', 'someday'));

DROP INDEX tasks_status_do_at_created_at;
CREATE INDEX tasks_status_list_do_at_created_at ON tasks (status, list, do_at, created_at);
