# 001a — Plan

**Spec:** 001a-spec.md
**Status:** Approved

## Approach
A single Go binary serves a JSON API and the built React app, embedded with `go:embed`. It stores data in one SQLite file. Routing uses the standard library (`net/http` method patterns) and migrations use a small built-in runner (embedded `.sql` files tracked with `PRAGMA user_version`), so the only Go dependency is the SQLite driver. The domain package owns task rules (title required, complete/reopen). The store owns the Inbox query. Handlers only translate HTTP to and from the domain. The UI is styled with Tailwind, in a style similar to Things 3: calm and spacious, with round checkboxes and a single blue accent.

## Data changes
New table `tasks`, migration `001_tasks.sql`:

| column | type | notes |
|---|---|---|
| id | INTEGER PRIMARY KEY | |
| title | TEXT NOT NULL | trimmed, non-empty (enforced in domain) |
| description | TEXT NOT NULL DEFAULT '' | plain text |
| status | TEXT NOT NULL DEFAULT 'open' | CHECK in ('open','done','dropped') |
| project_id | INTEGER NULL | no FK until projects exist |
| area_id | INTEGER NULL | no FK until areas exist |
| do_at | TEXT NULL | RFC 3339 UTC |
| due_at | TEXT NULL | RFC 3339 UTC |
| completed_at | TEXT NULL | RFC 3339 UTC; set on complete, cleared on reopen |
| created_at | TEXT NOT NULL | RFC 3339 UTC |
| updated_at | TEXT NOT NULL | RFC 3339 UTC |

Index on `(status, do_at, created_at)` for the Inbox query.

## Interfaces
- `GET /api/inbox → []Task`: open tasks with no project, area or do_at, ordered `do_at IS NULL, do_at, created_at`
- `POST /api/tasks {title, description?} → 201 Task`, or `400 {error}` if the title is blank
- `PATCH /api/tasks/{id} {title?, description?} → Task`, or `400` if the title is blank, `404` if the task doesn't exist
- `POST /api/tasks/{id}/complete → Task`
- `POST /api/tasks/{id}/reopen → Task`
- `GET /healthz → 200`
- Domain: `domain.NewTask(title, description string, now time.Time) (Task, error)`, `(*Task).Edit(title, description string, now time.Time) error`, `(*Task).Complete(now)`, `(*Task).Reopen(now)`, `domain.ErrTitleRequired`
- Store: `store.Open(path) (*Store, error)` (runs migrations), `Create`, `Get`, `Update`, `ListInbox`
- UI components: `InboxView`, `TaskRow`, `QuickCapture`, `AddButton`; hooks `useKeyboard`, `useSwipe`

## Files
- new: `go.mod`, `justfile`, `.gitignore`
- new: `cmd/server/main.go`: config from env (`ADDR`, `DB_PATH`), wiring, graceful shutdown
- new: `internal/domain/task.go` and `task_test.go`: Task type and rules
- new: `internal/store/store.go`, `migrate.go`, `migrations/001_tasks.sql` and tests
- new: `internal/httpapi/handlers.go`, `handlers_test.go`: routes, JSON, error mapping, SPA fallback
- new: `web/` (Vite + React + TypeScript app) and `web/embed.go` (`//go:embed dist`)
- new: `web/src/index.css`: Tailwind import and `@theme` tokens (accent blue, greys, radius, font stack), so later views reuse the same look
- new: `Dockerfile` (multi-stage: node → go with `CGO_ENABLED=0` → distroless static), `docker-compose.yml` (named volume at `/data`)
- change: `DECISIONS.md`, `ARCHITECTURE.md`

## Steps
1. Go skeleton: `go.mod`, `cmd/server` with `/healthz`, justfile (`dev`, `test`, `build`), with a handler test
2. Schema and migration runner, with a test that migrations apply cleanly to a fresh DB and are idempotent
3. Domain rules with table-driven tests: title trimming/required on create and edit, complete sets `completed_at`, reopen clears it, `updated_at` bumps
4. Store queries with tests against a temp-file DB: create/get/update round trip, Inbox filter and ordering
5. HTTP handlers with `httptest` tests: status codes, validation errors, 404s
6. Web scaffold: Vite React app with Tailwind and theme tokens, embedded in the binary; `just dev` runs Vite (proxying `/api`) and the Go server together; `just build` builds `web/dist`, then the binary
7. Inbox UI in a Things 3-like style:
   - Large bold "Inbox" heading with a blue icon, and a narrow centred column on desktop.
   - Rows are a hollow round checkbox plus the title, with a light-blue rounded highlight on the selected row.
   - Editing expands the row into a white card with a soft shadow and a grey "Notes" field.
   - On mobile there's a round blue + button, bottom-right.

   Behaviour: list, quick capture (`q` opens it, ignored while typing in a field; + button on narrow or touch screens), new tasks appear at the bottom, inline edit of title/description (Enter in the title, ⌘/Ctrl+Enter in the notes, Escape or clicking away all save and close, as in Things; a blank title shows an error and keeps the old value)
8. Selection and completion: click or j/k/arrows select; `x` toggles complete on the selected task; swipe right toggles on mobile; completing fills the checkbox blue with a tick, and the title stays greyed and struck through until reload; Vitest tests for the keyboard and swipe hooks
9. Docker: Dockerfile and compose with a volume; check that data survives `down`/`up`; update DECISIONS.md and ARCHITECTURE.md

## Questions
1. **Dependencies (approved):**
   - Go: `modernc.org/sqlite`. It's pure Go, so the build needs no cgo, the Docker image can be static, and cross-compiling is easy. The alternative, `mattn/go-sqlite3`, is faster but needs cgo.
   - Web: `react`, `react-dom`, `vite`, `@vitejs/plugin-react` and `typescript`.
   - Styling: `tailwindcss` v4 and `@tailwindcss/vite`.
   - Tests: `vitest`, `@testing-library/react` and `jsdom`.
   - Lint and format (added during the build): `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-better-tailwindcss`, `prettier` and `prettier-plugin-tailwindcss`. TypeScript pinned to 6.0.3 for typescript-eslint. golangci-lint is a separate binary.
   - Nothing else: no router, ORM, migration library, component library or gesture library.
2. **User's timezone (deferred):** 001a shows no dates and never computes "today", so timezone handling moves to 001b, as a single `TZ` config value.

## Assumptions
- IDs are SQLite integer IDs, not UUIDs. Fine for a single user online; revisit if offline capture is ever wanted.
- Timestamps are stored as RFC 3339 UTC text, which sorts correctly and is readable in the sqlite CLI.
- The Inbox filter and ordering live in the store's SQL query, not in the domain package. Doing it in Go would mean loading every task. The query has its own test.
- "Reopen" on mobile is a second swipe right on a struck-through task.
- Quick capture is a modal with title (required) and an optional description; Enter saves and Escape closes.
- Tailwind utility classes in components, with no component library. Shared colours and spacing live in `@theme` tokens, not hard-coded per component.
- "Similar to Things 3" means its layout and feel only. The icons, colours and assets are our own; nothing is copied from the app.
- System font stack (`-apple-system`, `system-ui`, …), so it looks native on iOS and macOS.
- Light theme only for now. Dark mode can come later through the same tokens.
- UI text in British English.
- No `dropped` behaviour beyond the column constraint.
- The server listens on `:8080`, and the DB lives at `/data/attrape.db` in Docker and `./data/attrape.db` locally.
