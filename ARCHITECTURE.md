# Architecture

Attrape is a single-user task manager. A Go server stores tasks in SQLite and serves a React app that's built into the binary.

## Layout

```
cmd/server/          main: reads config from env, opens the store, starts HTTP
internal/domain/     business rules (Task, NewTask, Edit, Complete, Reopen), with table-driven tests
internal/store/      SQLite access: Open runs migrations; task queries; view filters and ordering
  migrations/        numbered .sql files, embedded and applied at startup
internal/httpapi/    HTTP handlers: decode a request, call domain and store, encode JSON; serves the web app
web/                 React app (see Frontend below)
  embed.go           embeds web/dist into the Go binary
specs/               specs and plans for each piece of work
justfile             dev, test, lint, fmt and build commands
.golangci.yml        Go lint and format config (web lint config is in web/eslint.config.js, web/.prettierrc.json)
```

## Frontend

```
web/src/
  main.tsx           mounts the app
  App.tsx            picks the view (only the Inbox so far)
  index.css          Tailwind import and @theme tokens (colours, radii, shadows, font)
  api/
    client.ts        request(), ApiError, errorMessage(): the only code that calls fetch
    tasks.ts         Task type and tasksApi (inbox, create, edit, complete, reopen)
  components/        shared presentational pieces: Checkbox, AddButton, icons
  hooks/             shared behaviour: useShortcuts (keyboard), useSwipe (touch)
  features/
    tasks/           task UI any view can reuse: TaskRow (and its inline editor), QuickCapture
    inbox/           InboxView: loads the Inbox, owns selection, editing and capture state
  test/setup.ts      Vitest setup: stubs DOM methods jsdom lacks (e.g. scrollIntoView)
```

Rules for where code goes:
- `api/` is the only place that knows URLs and JSON shapes. Each resource gets its own file next to `tasks.ts`.
- `components/` don't call the API or know about features. They take props and render.
- `hooks/` hold behaviour shared by more than one feature.
- `features/<name>/` holds one area of the app. A view such as `InboxView` owns its state and passes callbacks down. Task UI shared between views lives in `features/tasks/`. New views, such as Today or a project, get their own folder and reuse it.
- Imports point one way: features use api, components and hooks, but never the reverse.
- Tests sit next to the code (`*.test.tsx`) and mock `tasksApi`, not `fetch`.
- Styling uses Tailwind classes with the theme tokens (`bg-accent`, `rounded-row`, `shadow-card`), not raw colours.

## Request flow

1. `httpapi` matches the route, decodes JSON, and loads the task from `store` if it needs one.
2. A `domain` function or method applies the change and enforces the rules. It returns `domain.ErrTitleRequired` and similar errors.
3. `store` saves the result. `writeError` maps domain and store errors to status codes: 400 for rule errors, 404 for `store.ErrNotFound`, 500 for anything else.
4. The UI shows the server's error message. It doesn't repeat the rules.

Paths outside `/api/` and `/healthz` serve the web app. Unknown paths get `index.html`, so the client can do its own routing later.

## API

| Method and path | Body | Returns |
|---|---|---|
| `GET /api/inbox` | | open tasks with no project, area or `do_at` |
| `POST /api/tasks` | `{title, description?}` | 201 Task |
| `PATCH /api/tasks/{id}` | `{title?, description?}` | Task |
| `POST /api/tasks/{id}/complete` | | Task |
| `POST /api/tasks/{id}/reopen` | | Task |
| `GET /healthz` | | 200 |

## Data

One table, `tasks`, created by `001_tasks.sql`. Timestamps are UTC text at fixed width. `project_id`, `area_id`, `do_at` and `due_at` exist but aren't used until later specs.

## Running

- `just dev`: Vite on :5173, proxying `/api` to Go on :8080. The database is `./data/attrape.db`.
- `just test`: Go tests, then Vitest.
- `just lint`: golangci-lint for Go, then `tsc`, ESLint (including Tailwind class checks) and Prettier for `web/`.
- `just fmt`: applies golangci-lint's formatters, ESLint fixes and Prettier.
- `just build`: builds the web app, then `bin/attrape` with the app embedded.
- `docker compose up`: distroless image. Data is in the `data` volume at `/data`, and the server listens on `127.0.0.1:8080` unless `BIND_ADDR` is set.
