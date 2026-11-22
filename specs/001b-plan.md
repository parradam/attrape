# 001b — Plan

**Spec:** 001b-spec.md
**Status:** Approved

## Approach
A new `list` column records where a task belongs, separate from `status`. The domain owns every rule in the spec's Keys table: what moving, completing, dropping and reopening do in each status, including when they do nothing. The store has one query per kind of view, and the API exposes a view by name, plus `move` and `drop` actions alongside the existing `complete` and `reopen`. On the frontend, `InboxView` becomes a single `ViewPage` driven by a table of the six views. Routing is a small hook over the browser's history API, so there's no new dependency. Each step writes its tests first, then the code that makes them pass.

## Data changes
Migration `002_task_list.sql`:

| column | type | notes |
|---|---|---|
| list | TEXT NOT NULL DEFAULT 'inbox' | CHECK in ('inbox','next','waiting','someday') |

- Existing rows get `inbox`, so 001a's open tasks are in the Inbox and done ones are in Completed with the label Inbox.
- Replace the index `(status, do_at, created_at)` with `(status, list, do_at, created_at)` for the four open views. Completed and Dropped are small enough not to need their own indexes yet.

## Interfaces
- Domain:
  - `type List string` with `ListInbox`, `ListNext`, `ListWaiting`, `ListSomeday`; `domain.ParseList(s string) (List, error)`; `domain.ErrInvalidList`
  - `Task.List` field, JSON `list`; `NewTask` sets it to `ListInbox`
  - `(*Task).Move(list List, now time.Time) error`: open tasks only; nothing if it's already in that list; `ErrInvalidList` for an unknown list
  - `(*Task).Complete(now)`: open tasks only (001a also allowed it on dropped tasks)
  - `(*Task).Drop(now)`: open tasks only
  - `(*Task).Reopen(now)`: done or dropped tasks; clears `completed_at`; nothing on an open task (unchanged)
  - "Nothing" means the task, including `updated_at`, is unchanged, as `Complete` on a done task already behaves in 001a.
- Store, replacing `ListInbox`:
  - `ListOpen(ctx, list domain.List) ([]Task, error)`: shared `taskOrder`
  - `ListCompleted(ctx) ([]Task, error)`: `completed_at DESC, id DESC`
  - `ListDropped(ctx) ([]Task, error)`: `updated_at DESC, id DESC`
  - `CreateTask`, `GetTask` and `UpdateTask` read and write `list`
- HTTP:
  - `GET /api/views/{view} → []Task` for `inbox`, `next`, `waiting`, `someday`, `completed` or `dropped`; `404` for anything else. Replaces `GET /api/inbox`.
  - `POST /api/tasks/{id}/move {list} → Task`, or `400` for an invalid list
  - `POST /api/tasks/{id}/drop → Task`
  - `POST /api/tasks/{id}/reopen → Task`: now also restores a dropped task
  - A no-op returns `200` with the unchanged task, as `complete` on a done task does now.
- Frontend:
  - `tasksApi.view(view)`, `tasksApi.move(id, list)`, `tasksApi.drop(id)`; `Task` gains `list`
  - `features/views/views.ts`: one entry per view: `id`, `title`, `path`, `key`, `icon`, `list?`, `emptyText`
  - `useRoute()` in `hooks/`: current path and `navigate(path)`, using `pushState` and `popstate`
  - `ViewPage({ view })`: loads a view, owns selection, editing, capture and the keys
  - `Sidebar` (desktop) and `ViewMenu` (mobile), both built from `views.ts`
  - `Toast` in `components/`: a short message that disappears on its own

## Files
- new: `internal/store/migrations/002_task_list.sql`
- change: `internal/domain/task.go`, `task_test.go`: `List`, `Move`, `Drop`, status rules
- change: `internal/store/tasks.go`, `tasks_test.go`, `migrate_test.go`: `list` column, view queries
- change: `internal/httpapi/handlers.go`, `handlers_test.go`: view, move and drop routes; `ErrInvalidList` → 400
- change: `web/src/api/tasks.ts`
- new: `web/src/hooks/useRoute.ts`, `useRoute.test.tsx`
- new: `web/src/features/views/views.ts`, `ViewPage.tsx`, `ViewPage.test.tsx`, `Sidebar.tsx`, `ViewMenu.tsx`
- delete: `web/src/features/inbox/` (its tests move into `ViewPage.test.tsx`)
- change: `web/src/App.tsx`: picks the view from the URL, lays out the sidebar and page
- change: `web/src/features/tasks/TaskRow.tsx`: dropped style, list label, mobile action buttons in the editor
- change: `web/src/components/Checkbox.tsx`: open, done and dropped states
- change: `web/src/components/icons.tsx`: an icon per view, our own drawings
- new: `web/src/components/Toast.tsx`
- change: `DECISIONS.md`, `ARCHITECTURE.md`

## Steps
1. **Schema.** Tests first: migrations apply to a fresh DB and to a 001a DB with tasks in it, existing rows get `inbox`, and the CHECK rejects other values. Then the migration.
2. **Domain rules.** Table-driven tests first, covering every cell of the spec's Keys table: each action on an open, done and dropped task, moving to the same list, an invalid list, and whether `updated_at` and `completed_at` change. Then `List`, `ParseList`, `Move`, `Drop`, and the new limits on `Complete`.
3. **Store.** Tests first against a temp-file DB: `list` round-trips; each open view shows only open tasks in its list, in `taskOrder`; Completed is newest `completed_at` first; Dropped is newest `updated_at` first; every task appears in exactly one view. Then the queries.
4. **HTTP.** `httptest` tests first: each view name, an unknown view (404), move with a valid and an invalid list, drop, reopen on a dropped task, no-ops returning the unchanged task, and a flow test that captures, moves, completes and reopens. Then the handlers. The frontend still calls `/api/inbox` at this point, so this step also switches `tasksApi.inbox` to `/api/views/inbox`, keeping the build working.
5. **Views and navigation.** Tests first: `useRoute` (navigate, back, `/` goes to `/inbox`), and `ViewPage` loading and listing each view, with its empty state. Then `views.ts`, `useRoute`, `ViewPage` (replacing `InboxView`), the sidebar, the mobile menu and a URL per view. Selection and editing work as in 001a in every view.
6. **Keys, checkbox and swipe.** Tests first for every row of the Keys table, including the keys that do nothing (`x`, `g`, `u`, `r`, and those on frozen tasks); a moved task leaving the view; status changes staying in place; the dropped style; and the list label in Completed and Dropped. Then the handlers, `Checkbox` states and row styling.
7. **Mobile buttons and quick capture.** Tests first: the expanded card's buttons for open and for done or dropped tasks, and quick capture showing "Added to Inbox" from another view, without adding the task to that view. Then the buttons and `Toast`.
8. **Docs.** DECISIONS.md entries for: `list` separate from `status`; Completed and Dropped not using `taskOrder` (superseding part of the 2026-10-24 entry); routing without a library; and status changes waiting for the server (see Assumptions). Update ARCHITECTURE.md for the API, the `features/views` folder and the data.

## Questions
None. Two choices below are worth checking before I start: routing without a library, and dropping the optimistic update.

## Assumptions
- **No router library.** Six flat paths don't need one; `useRoute` is about 30 lines. A router can replace it if nested routes arrive with projects in 001e.
- **Status changes and moves wait for the server.** 001a updated the row before the server replied. Because `c`, `d` and `o` now do nothing in some statuses, guessing in the UI would mean copying the domain rules there. Instead the UI sends the action and shows the task the server returns. A move removes the task from the view when the returned list differs from the one shown. On a VPN the delay should be too short to notice. While a request is in flight, further key presses on that task are ignored.
- **The UI chooses which buttons to show from `status`** (list and drop buttons for open tasks, reopen or restore otherwise), and `Checkbox` and swipe call `complete` on open tasks and `reopen` otherwise. That's choosing which control to show, not enforcing the rule; the server still decides.
- URLs: `/inbox`, `/next`, `/waiting`, `/someday`, `/completed`, `/dropped`. `/` and unknown paths go to `/inbox`, replacing the history entry.
- After a move, the selection goes to the next task down, or the one above if it was the last.
- The page title follows the view, for example "Next Actions · Attrape".
- The list label in Completed and Dropped is small muted text at the right of the row, such as "Waiting".
- A dropped task's checkbox shows a dash, so done and dropped tasks look different even before you read the text.
- Mobile menu: the view title at the top is a button that opens a list of all six views.
- The empty state for each view names it, for example "Nothing in Next Actions."
- Quick capture from the Inbox behaves as in 001a: the task is added to the bottom and selected, with no toast.
- The toast lasts about 2 seconds and has `role="status"` so screen readers announce it.
- Keyboard handling for `i`, `n`, `w`, `s` and `d` is ignored while typing, like the 001a keys.
