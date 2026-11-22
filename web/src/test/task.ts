import type { Task } from "../api/tasks";

// task builds an open Inbox task for tests.
export function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    title,
    description: "",
    status: "open",
    list: "inbox",
    project_id: null,
    area_id: null,
    do_at: null,
    due_at: null,
    completed_at: null,
    created_at: "2026-10-24T09:00:00.000000Z",
    updated_at: "2026-10-24T09:00:00.000000Z",
    ...extra,
  };
}
