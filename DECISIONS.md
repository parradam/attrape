# Decisions

Choices that would be expensive to reverse. Never rewrite an entry; add a new one that supersedes it.

## 2026-10-24: One Go binary with the React app embedded
**Decision:** A Go server serves the JSON API and the built React app, which is embedded with `go:embed` (`web/embed.go`). Deployed as a single Docker container.
**Why:** One thing to build, deploy and back up. No separate web server or CORS.
**Alternatives:** Separate frontend hosting, which adds a second deployment for no gain at this size.

## 2026-10-24: Standard library HTTP routing
**Decision:** Routes use `net/http.ServeMux` method and path patterns. No router dependency.
**Why:** The standard library covers what we need.

## 2026-10-24: SQLite via `modernc.org/sqlite`
**Decision:** Data lives in one SQLite file, opened with the pure-Go `modernc.org/sqlite` driver. A single connection with WAL mode.
**Why:** No cgo, so the build is static and the Docker image can be distroless. Speed is not a concern for one user.
**Alternatives:** `mattn/go-sqlite3` is faster but needs cgo and a C toolchain in the build.

## 2026-10-24: Migrations without a library
**Decision:** Migrations are numbered `.sql` files in `internal/store/migrations`, embedded and applied in order at startup. `PRAGMA user_version` records how many have run. Migrations are only ever added, never edited.
**Why:** A few dozen lines; no dependency needed.

## 2026-10-24: Integer IDs
**Decision:** Tables use SQLite `INTEGER PRIMARY KEY` IDs.
**Why:** Simple, and the server is always online and creates every row.
**Revisit if:** clients ever need to create rows offline.

## 2026-10-24: How dates and times work
**Decision:** Timestamps are stored in UTC as fixed-width text (`2006-01-02T15:04:05.000000Z`) so they sort correctly as strings. "Today" and displayed dates use the user's timezone. How the server learns that timezone, probably a single `TZ` setting, is decided in 001b, the first spec that uses dates.

## 2026-10-24: No login, VPN only
**Decision:** There's no authentication. The app runs on a VPS that is reachable only over a VPN. `docker-compose.yml` binds to `127.0.0.1` unless `BIND_ADDR` is set.
**Why:** Single user. The VPN is the access control.
**Revisit if:** the app is ever exposed beyond the VPN.

## 2026-10-24: Business rules live on the server
**Decision:** Rules such as "a task needs a title" live in `internal/domain`. The UI doesn't re-check them; it sends the request and shows the server's error message.
**Why:** One place to change a rule.

## 2026-10-24: Task list filters and ordering live in SQL
**Decision:** Each view's filter, such as the Inbox, is a store query. Every list uses the shared `taskOrder` in `internal/store/tasks.go`: soonest `do_at` first, then undated tasks oldest first.
**Why:** Filtering in Go would mean loading every task. Each query has its own test.

## 2026-10-24: React, Vite, TypeScript and Tailwind
**Decision:** The UI uses React with TypeScript, built with Vite, and styled with Tailwind v4 utility classes. Shared colours, radii and shadows are `@theme` tokens in `web/src/index.css`. Components use the tokens, not raw values. Tests use Vitest and Testing Library on jsdom. There's no component library, router, data-fetching library or gesture library.
**Why:** A small, common stack. Tokens keep later views consistent.

## 2026-10-24: Visual style similar to Things 3
**Decision:** A calm, spacious layout with round checkboxes and one blue accent, using the system font. Only the layout and feel are borrowed. The icons and colours are our own, and nothing is copied from the app. Light theme only for now; dark mode can come later through the same tokens.

## 2026-10-24: `just` as the command runner
**Decision:** `dev`, `test` and `build` are recipes in a `justfile`. Contributors need `just` installed.
**Why:** Simpler syntax than make for a command runner, with no file-target rules.
**Alternatives:** make.

## 2026-10-24: Frontend folders by role, then by feature
**Decision:** `web/src` is split into `api/`, `components/`, `hooks/` and `features/<name>/`. Imports point one way: features use the other three, never the reverse. See ARCHITECTURE.md for the rules.
**Why:** New views, such as Today and projects, slot in as feature folders and reuse the shared pieces.
