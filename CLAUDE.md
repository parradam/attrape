# CLAUDE.md

## Workflow
1. Read the spec in `specs/NNN-spec.md` using the format in `specs/SPEC.md`. It defines the scope; don't build anything listed as out of scope.
2. Write a plan to `specs/NNN-plan.md` using the format of `specs/PLAN.md`. Stop and wait for approval.
3. Build in the plan's steps. Each step should leave tests passing and be its own commit. Stop after a step if asked.
4. If something in the spec or plan turns out to be wrong or unclear, stop and ask. Don't silently work around it.

## Before finishing a PR
- **DECISIONS.md:** add an entry for any choice that would be expensive to reverse, such as a new dependency, a schema pattern, how auth or dates work, or a library chosen over an alternative. Add one too if you deviated from an existing decision. Never rewrite an existing entry; add a new one that supersedes it.
- **ARCHITECTURE.md:** update it if the package layout, data flow, or where certain logic lives has changed. It should describe the code as it is now, not as planned.
- Copy the plan into the PR description.

## Conventions
- Business rules live in one place (`internal/domain`), with table-driven tests. Handlers and UI components don't re-implement them.
- Ask before adding a dependency.
- British English in UI text.
- Keep it simple and consistent with existing code. Later work copies its patterns.

## Commands
- `just dev`: run locally
- `just test`: run all tests
- `just build`: production build
- `just lint`: check formatting, lint rules and types (Go, TypeScript, Tailwind, CSS, JSON)
- `just fmt`: fix formatting and auto-fixable lint issues

Run `just lint` and `just test` before each commit; both must pass.
