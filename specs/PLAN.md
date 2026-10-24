# NNN — Plan

**Spec:** NNN-title.md
**Status:** Draft | Approved

## Approach
Two or three sentences: how this will be built, and any notable choices.

## Data changes
Tables, columns, migrations. "None" is a valid answer.

## Interfaces
Endpoints, function signatures or components that other code will depend on.
One line each, e.g. `POST /api/tasks {title, description?} → Task`.

## Files
- new: `internal/domain/tasks.go`, Task type and validation rules
- change: `cmd/server/main.go`, register routes

## Steps
1. Schema and migration, with a test that it applies cleanly
2. Domain rules and tests
3. Store queries
4. HTTP handlers and tests
5. Inbox UI
(Each step should leave the build passing, so it can be its own commit.)

## Questions
Anything ambiguous in the spec. Claude waits for answers before building.

## Assumptions
Choices made without asking, so you can veto them.
