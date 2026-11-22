# 001b — Clarify and engage

**Status:** Ready

## Goal
I can sort Inbox tasks into Next Actions, Waiting and Someday, complete or drop them, and see each of these as a view, along with Completed and Dropped.

## In scope
- Six views: Inbox, Next Actions, Waiting, Someday, Completed and Dropped
- Moving an open task to another list
- Completing, dropping, reopening and restoring a task
- Switching views from a sidebar on desktop and a menu on mobile
- Single-key shortcuts for all of the above, and buttons on mobile

## Out of scope
- `g` sequences for going to a view, the `?` shortcut overlay, and Undo and Redo on `u` and `r` (001c)
- Dates, Today, Upcoming and `TZ` (001d)
- Projects and areas (001e)
- Tags and contexts (001f)
- Weekly review (001g)
- Permanent delete: Dropped is the bin
- Waiting-specific fields, such as who or since when
- Date headings in Completed and Dropped (need `TZ`, so 001d)
- Paging, search, manual ordering and bulk actions

## Acceptance criteria
- [ ] Every task appears in exactly one view, as set out in the Views table
- [ ] After the migration, tasks completed in 001a are in Completed and open ones are in the Inbox
- [ ] Each key and swipe does what the Keys table says, and nothing else
- [ ] A moved task leaves the current view straight away
- [ ] A completed, dropped, reopened or restored task stays in place until reload, then appears in its new view
- [ ] Until reload, a done task is muted and struck through, a dropped task is muted, and a reopened or restored task looks open
- [ ] Completed and Dropped show each task's list
- [ ] In every view, including Completed and Dropped, `j`/`k`, arrows and clicking select a task, `Enter` edits it and `Escape` deselects it
- [ ] The sidebar on desktop and the menu on mobile reach every view
- [ ] On mobile, an expanded open task has a button for each list and one to drop; an expanded done or dropped task has one to reopen or restore
- [ ] Each view has its own URL, which survives a reload
- [ ] Quick capture always adds to the Inbox; from another view it shows a brief "Added to Inbox" toast

## Notes
- A task has a `list`, which says where it belongs, and a `status`: open, done or dropped. Open tasks appear in their list's view. Completed and Dropped come from `status`, so `list` holds only the four lists a task can be moved to.
- The Inbox is open tasks whose list is Inbox, replacing the 001a definition. No task can be created with a project, area or date yet, so the six views cover every task.
- Done and dropped tasks are frozen: only reopening or restoring changes their status or list. They keep their list, so that's where they return. They can still be edited.
- Reopening (from Completed) and restoring (from Dropped) are the same operation: setting the status back to open.
- Until Undo arrives in 001c, a wrong status change is fixed with `o`, and a misfiled task by moving it back from the view it went to.
- Completed and Dropped don't use the shared `taskOrder`, so they need a DECISIONS.md entry. Ordering Dropped by `updated_at` means editing a dropped task moves it to the top.
- Each view's key is its initial, so 001c can add `g` plus the same letter to go to it. `c` replaces 001a's `x` to fit this. `o` stands for "open".
- `g`, `u` and `r` stay unbound for go-to, Undo and Redo in 001c. Number keys aren't used: six aren't memorable, and `⌘1`–`⌘6` belong to the browser.

### Views
| View | Shows | Order | Key | Go to (001c) |
|---|---|---|---|---|
| Inbox | Open tasks whose list is Inbox | Shared `taskOrder` | `i` | `g i` |
| Next Actions | Open tasks whose list is Next Actions | Shared `taskOrder` | `n` | `g n` |
| Waiting | Open tasks whose list is Waiting | Shared `taskOrder` | `w` | `g w` |
| Someday | Open tasks whose list is Someday | Shared `taskOrder` | `s` | `g s` |
| Completed | Done tasks | `completed_at`, newest first | `c` | `g c` |
| Dropped | Dropped tasks | `updated_at`, newest first | `d` | `g d` |

### Keys
| Key | On an open task | On a done or dropped task |
|---|---|---|
| `i` `n` `w` `s` | Move to Inbox, Next Actions, Waiting or Someday; nothing if it's already there | Nothing |
| `c` | Complete | Nothing |
| `d` | Drop | Nothing |
| `o` | Nothing | Reopen or restore |
| Swipe right | Complete | Reopen or restore |
| `x` `g` `u` `r` | Nothing | Nothing |

Unchanged from 001a: `q` quick capture, `j`/`k` and arrows to select, `Enter` to edit, `Escape` to deselect.
