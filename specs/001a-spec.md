# 001a — Skeleton and Inbox capture

**Status:** Ready

## Goal
A deployed app where the user can capture tasks into an Inbox from a phone and a computer, then edit and complete them.

## In scope
- Go server with the React app built into it, SQLite, Docker
- Inbox: add, edit, complete/reopen
- Selecting a task (click, or j/k and arrow keys)
- `q` opens quick capture from anywhere; + button on mobile

## Out of scope
- Projects, areas, other views, dates, tags (001b/001c)
- Viewing or managing completed tasks (future spec)
- Login (not currently planned)

## Acceptance criteria
- [ ] `just dev`, `just test` and `docker compose up` work
- [ ] Capture with `q` or the + button adds to the bottom of the Inbox
- [ ] Edit title and description inline; changes survive reload
- [ ] `x` completes the selected task in a desktop browser (stays struck through until reload) and reopens it
- [ ] Swipe right completes a task on mobile
- [ ] Cannot create or save a task without a title
- [ ] Data survives a container restart (`docker compose down` then `up`)

## Notes
- Task fields: title, description, status (open/done/dropped), do_at, due_at, completed_at, project_id, area_id, created_at, updated_at. Create all the columns now, in a logical order, even though only the Inbox is used.
- The Inbox is open tasks with no project, area or do_at.
- Order by do_at, soonest first; tasks without a do_at come after, oldest created first.
- Timestamps are stored in UTC. "Today" and displayed dates use the user's timezone.
- Runs on a VPS reachable only over VPN, hence no auth.
- Decide on SQLite driver.
