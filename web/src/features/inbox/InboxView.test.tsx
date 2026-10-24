import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "../../api/client";
import { tasksApi, type Task } from "../../api/tasks";
import { InboxView } from "./InboxView";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    title,
    description: "",
    status: "open",
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

beforeEach(() => {
  vi.spyOn(tasksApi, "inbox").mockResolvedValue([task(1, "Buy milk"), task(2, "Call the bank")]);
});

async function renderInbox() {
  render(<InboxView />);
  await screen.findByText("Buy milk");
}

function titles() {
  return within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((li) => li.textContent);
}

test("lists Inbox tasks in order", async () => {
  await renderInbox();
  expect(titles()).toEqual(["Buy milk", "Call the bank"]);
});

test("shows an empty state", async () => {
  vi.mocked(tasksApi.inbox).mockResolvedValue([]);
  render(<InboxView />);
  expect(await screen.findByText("Nothing in your Inbox.")).toBeTruthy();
});

test("q opens quick capture and a new task goes to the bottom", async () => {
  vi.spyOn(tasksApi, "create").mockResolvedValue(task(3, "Book dentist"));
  await renderInbox();

  fireEvent.keyDown(window, { key: "q" });
  const dialog = screen.getByRole("dialog", { name: "New task" });
  fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Book dentist" } });
  await act(async () => {
    fireEvent.submit(dialog);
  });

  expect(tasksApi.create).toHaveBeenCalledWith("Book dentist", "");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(titles()).toEqual(["Buy milk", "Call the bank", "Book dentist"]);
});

test("the + button opens quick capture", async () => {
  await renderInbox();
  fireEvent.click(screen.getByRole("button", { name: "New task" }));
  expect(screen.getByRole("dialog", { name: "New task" })).toBeTruthy();
});

test("quick capture shows the server's error for a blank title", async () => {
  vi.spyOn(tasksApi, "create").mockRejectedValue(new ApiError("title is required", 400));
  await renderInbox();

  fireEvent.keyDown(window, { key: "q" });
  await act(async () => {
    fireEvent.submit(screen.getByRole("dialog"));
  });

  expect(screen.getByRole("alert").textContent).toBe("Title is required.");
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("Escape closes quick capture", async () => {
  await renderInbox();
  fireEvent.keyDown(window, { key: "q" });
  fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("double-click edits a task inline and Enter saves", async () => {
  vi.spyOn(tasksApi, "edit").mockResolvedValue(task(1, "Buy oat milk", { description: "semi" }));
  await renderInbox();

  fireEvent.doubleClick(screen.getByText("Buy milk"));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Buy oat milk" } });
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "semi" } });
  await act(async () => {
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });
  });

  expect(tasksApi.edit).toHaveBeenCalledWith(1, { title: "Buy oat milk", description: "semi" });
  expect(screen.queryByLabelText("Title")).toBeNull();
  expect(titles()).toEqual(["Buy oat milk", "Call the bank"]);
});

test("a blank title on edit shows the error and keeps the old title", async () => {
  vi.spyOn(tasksApi, "edit").mockRejectedValue(new ApiError("title is required", 400));
  await renderInbox();

  fireEvent.doubleClick(screen.getByText("Buy milk"));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  " } });
  await act(async () => {
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });
  });

  expect(screen.getByRole("alert").textContent).toBe("Title is required.");
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Buy milk");
});

test("Escape saves and closes an edit", async () => {
  vi.spyOn(tasksApi, "edit").mockResolvedValue(task(1, "Buy oat milk"));
  await renderInbox();

  fireEvent.doubleClick(screen.getByText("Buy milk"));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Buy oat milk" } });
  await act(async () => {
    fireEvent.keyDown(screen.getByLabelText("Notes"), { key: "Escape" });
  });

  expect(tasksApi.edit).toHaveBeenCalledWith(1, { title: "Buy oat milk", description: "" });
  expect(screen.queryByLabelText("Title")).toBeNull();
  expect(titles()).toEqual(["Buy oat milk", "Call the bank"]);
});

test("Escape with no changes closes without saving", async () => {
  vi.spyOn(tasksApi, "edit");
  await renderInbox();

  fireEvent.doubleClick(screen.getByText("Buy milk"));
  fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });

  expect(tasksApi.edit).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Title")).toBeNull();
});

test("Cmd+Enter in the notes saves, plain Enter doesn't", async () => {
  vi.spyOn(tasksApi, "edit").mockResolvedValue(task(1, "Buy milk", { description: "semi" }));
  await renderInbox();

  fireEvent.doubleClick(screen.getByText("Buy milk"));
  const notes = screen.getByLabelText("Notes");
  fireEvent.change(notes, { target: { value: "semi" } });
  fireEvent.keyDown(notes, { key: "Enter" });
  expect(tasksApi.edit).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.keyDown(notes, { key: "Enter", metaKey: true });
  });
  expect(tasksApi.edit).toHaveBeenCalledWith(1, { title: "Buy milk", description: "semi" });
  expect(screen.queryByLabelText("Notes")).toBeNull();
});

test("the checkbox completes a task, which stays struck through", async () => {
  vi.spyOn(tasksApi, "complete").mockResolvedValue(task(1, "Buy milk", { status: "done" }));
  await renderInbox();

  await act(async () => {
    fireEvent.click(screen.getByRole("checkbox", { name: "Complete “Buy milk”" }));
  });

  expect(tasksApi.complete).toHaveBeenCalledWith(1);
  expect(screen.getByRole("checkbox", { name: "Complete “Buy milk”" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("Buy milk").className).toContain("line-through");
});

function selectedTitle() {
  return screen
    .getAllByRole("listitem")
    .find((li) => li.getAttribute("aria-selected") === "true")?.textContent;
}

test("j/k and arrow keys move the selection", async () => {
  await renderInbox();
  expect(selectedTitle()).toBeUndefined();

  fireEvent.keyDown(window, { key: "j" });
  expect(selectedTitle()).toBe("Buy milk");
  fireEvent.keyDown(window, { key: "ArrowDown" });
  expect(selectedTitle()).toBe("Call the bank");
  fireEvent.keyDown(window, { key: "j" });
  expect(selectedTitle()).toBe("Call the bank");
  fireEvent.keyDown(window, { key: "k" });
  expect(selectedTitle()).toBe("Buy milk");
  fireEvent.keyDown(window, { key: "ArrowUp" });
  expect(selectedTitle()).toBe("Buy milk");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(selectedTitle()).toBeUndefined();
});

test("clicking a task selects it and clicking elsewhere clears it", async () => {
  await renderInbox();
  fireEvent.click(screen.getByText("Call the bank"));
  expect(selectedTitle()).toBe("Call the bank");
  fireEvent.click(screen.getByRole("main"));
  expect(selectedTitle()).toBeUndefined();
});

test("x completes and reopens the selected task", async () => {
  vi.spyOn(tasksApi, "complete").mockResolvedValue(task(2, "Call the bank", { status: "done" }));
  vi.spyOn(tasksApi, "reopen").mockResolvedValue(task(2, "Call the bank"));
  await renderInbox();

  fireEvent.click(screen.getByText("Call the bank"));
  await act(async () => {
    fireEvent.keyDown(window, { key: "x" });
  });
  expect(tasksApi.complete).toHaveBeenCalledWith(2);
  expect(screen.getByText("Call the bank").className).toContain("line-through");

  await act(async () => {
    fireEvent.keyDown(window, { key: "x" });
  });
  expect(tasksApi.reopen).toHaveBeenCalledWith(2);
  expect(screen.getByText("Call the bank").className).not.toContain("line-through");
});

test("x does nothing with no selection", async () => {
  vi.spyOn(tasksApi, "complete");
  await renderInbox();
  fireEvent.keyDown(window, { key: "x" });
  expect(tasksApi.complete).not.toHaveBeenCalled();
});

test("Enter opens the selected task for editing", async () => {
  await renderInbox();
  fireEvent.click(screen.getByText("Buy milk"));
  fireEvent.keyDown(window, { key: "Enter" });
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Buy milk");
});

test("a failed completion is put back", async () => {
  vi.spyOn(tasksApi, "complete").mockRejectedValue(new ApiError("something went wrong", 500));
  await renderInbox();

  await act(async () => {
    fireEvent.click(screen.getByRole("checkbox", { name: "Complete “Buy milk”" }));
  });

  expect(screen.getByText("Buy milk").className).not.toContain("line-through");
  expect(screen.getByRole("alert").textContent).toBe("Something went wrong.");
});

test("swiping right completes a task", async () => {
  vi.spyOn(tasksApi, "complete").mockResolvedValue(task(1, "Buy milk", { status: "done" }));
  await renderInbox();

  const row = screen.getByText("Buy milk").closest("li")!;
  const p = { pointerType: "touch", pointerId: 1, clientY: 10 };
  await act(async () => {
    fireEvent.pointerDown(row, { ...p, clientX: 10 });
    fireEvent.pointerMove(row, { ...p, clientX: 60 });
    fireEvent.pointerMove(row, { ...p, clientX: 120 });
    fireEvent.pointerUp(row, { ...p, clientX: 120 });
  });

  expect(tasksApi.complete).toHaveBeenCalledWith(1);
  expect(screen.getByText("Buy milk").className).toContain("line-through");
});

test("tapping a task on a touch screen opens it", async () => {
  await renderInbox();
  const row = screen.getByText("Buy milk").closest("li")!;
  const p = { pointerType: "touch", pointerId: 1, clientX: 10, clientY: 10 };
  fireEvent.pointerDown(row, p);
  fireEvent.pointerUp(row, p);
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Buy milk");
});
