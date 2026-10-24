import { request } from "./client";

export type Status = "open" | "done" | "dropped";

export interface Task {
  id: number;
  title: string;
  description: string;
  status: Status;
  project_id: number | null;
  area_id: number | null;
  do_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const tasksApi = {
  inbox: () => request<Task[]>("GET", "/api/inbox"),
  create: (title: string, description: string) =>
    request<Task>("POST", "/api/tasks", { title, description }),
  edit: (id: number, changes: { title?: string; description?: string }) =>
    request<Task>("PATCH", `/api/tasks/${id}`, changes),
  complete: (id: number) => request<Task>("POST", `/api/tasks/${id}/complete`),
  reopen: (id: number) => request<Task>("POST", `/api/tasks/${id}/reopen`),
};
