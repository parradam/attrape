import { request } from "./client";

export type Status = "open" | "done" | "dropped";

// List is where a task belongs. Done and dropped tasks keep theirs.
export type List = "inbox" | "next" | "waiting" | "someday";

// ViewName names a view: one of the four lists, or Completed or Dropped.
export type ViewName = List | "completed" | "dropped";

export interface Task {
  id: number;
  title: string;
  description: string;
  status: Status;
  list: List;
  project_id: number | null;
  area_id: number | null;
  do_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const tasksApi = {
  view: (view: ViewName) => request<Task[]>("GET", `/api/views/${view}`),
  create: (title: string, description: string) =>
    request<Task>("POST", "/api/tasks", { title, description }),
  edit: (id: number, changes: { title?: string; description?: string }) =>
    request<Task>("PATCH", `/api/tasks/${id}`, changes),
  complete: (id: number) => request<Task>("POST", `/api/tasks/${id}/complete`),
  reopen: (id: number) => request<Task>("POST", `/api/tasks/${id}/reopen`),
};
