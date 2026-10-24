CREATE TABLE tasks (
    id           INTEGER PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dropped')),
    project_id   INTEGER,
    area_id      INTEGER,
    do_at        TEXT,
    due_at       TEXT,
    completed_at TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX tasks_status_do_at_created_at ON tasks (status, do_at, created_at);
