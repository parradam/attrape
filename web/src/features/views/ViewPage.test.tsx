import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { task } from "../../test/task";
import { viewById, views } from "./views";
import { ViewPage } from "./ViewPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(tasksApi, "view").mockResolvedValue([task(1, "Buy milk"), task(2, "Call the bank")]);
});

async function renderInbox() {
  render(<ViewPage view={viewById.inbox} onNavigate={() => undefined} />);
  await screen.findByText("Buy milk");
}

function rowOf(title: string): HTMLElement {
  const row = screen.getByText(title).closest("li");
  if (!row) throw new Error(`no row for ${title}`);
  return row;
}

function titles() {
  return within(screen.getByRole("list", { name: "Inbox" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);
}

test("lists Inbox tasks in order", async () => {
  await renderInbox();
  expect(titles()).toEqual(["Buy milk", "Call the bank"]);
});

test.each([
  ["inbox", "Nothing in your Inbox."],
  ["next", "Nothing in Next Actions."],
  ["waiting", "Nothing in Waiting."],
  ["someday", "Nothing in Someday."],
  ["completed", "Nothing completed yet."],
  ["dropped", "Nothing dropped."],
] as const)("%s has an empty state", async (id, text) => {
  vi.mocked(tasksApi.view).mockResolvedValue([]);
  render(<ViewPage view={viewById[id]} onNavigate={() => undefined} />);
  expect(await screen.findByText(text)).toBeTruthy();
  expect(tasksApi.view).toHaveBeenCalledWith(id);
});

test("every view lists its tasks under its title", async () => {
  for (const view of views) {
    render(<ViewPage view={view} onNavigate={() => undefined} />);
    expect(
      await within(screen.getByRole("list", { name: view.title })).findByText("Buy milk"),
    ).toBeTruthy();
    cleanup();
  }
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
  expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Buy milk");
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
  expect(
    screen.getByRole("checkbox", { name: "Reopen “Buy milk”" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(screen.getByText("Buy milk").className).toContain("line-through");
});

function selectedTitle() {
  return screen.queryAllByRole("listitem").find((li) => li.getAttribute("aria-selected") === "true")
    ?.textContent;
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

test("c completes the selected task and o reopens it", async () => {
  vi.spyOn(tasksApi, "complete").mockResolvedValue(task(2, "Call the bank", { status: "done" }));
  vi.spyOn(tasksApi, "reopen").mockResolvedValue(task(2, "Call the bank"));
  await renderInbox();

  fireEvent.click(screen.getByText("Call the bank"));
  await act(async () => {
    fireEvent.keyDown(window, { key: "c" });
  });
  expect(tasksApi.complete).toHaveBeenCalledWith(2);
  expect(screen.getByText("Call the bank").className).toContain("line-through");

  await act(async () => {
    fireEvent.keyDown(window, { key: "o" });
  });
  expect(tasksApi.reopen).toHaveBeenCalledWith(2);
  expect(screen.getByText("Call the bank").className).not.toContain("line-through");
  expect(titles()).toEqual(["Buy milk", "Call the bank"]);
});

test("action keys do nothing with no selection", async () => {
  const spies = spyOnActions();
  await renderInbox();
  for (const key of ["c", "d", "o", "i", "n", "w", "s"]) {
    fireEvent.keyDown(window, { key });
  }
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});

test("Enter opens the selected task for editing", async () => {
  await renderInbox();
  fireEvent.click(screen.getByText("Buy milk"));
  fireEvent.keyDown(window, { key: "Enter" });
  expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Buy milk");
});

test("a failed completion leaves the task as it was and shows the error", async () => {
  vi.spyOn(tasksApi, "complete").mockRejectedValue(new ApiError("something went wrong", 500));
  await renderInbox();

  await act(async () => {
    fireEvent.click(screen.getByRole("checkbox", { name: "Complete “Buy milk”" }));
  });

  expect(screen.getByText("Buy milk").className).not.toContain("line-through");
  expect(screen.getByRole("alert").textContent).toBe("Something went wrong.");
});

async function swipeRight(row: HTMLElement) {
  const p = { pointerType: "touch", pointerId: 1, clientY: 10 };
  await act(async () => {
    fireEvent.pointerDown(row, { ...p, clientX: 10 });
    fireEvent.pointerMove(row, { ...p, clientX: 60 });
    fireEvent.pointerMove(row, { ...p, clientX: 120 });
    fireEvent.pointerUp(row, { ...p, clientX: 120 });
  });
}

test("swiping right completes a task", async () => {
  vi.spyOn(tasksApi, "complete").mockResolvedValue(task(1, "Buy milk", { status: "done" }));
  await renderInbox();

  await swipeRight(rowOf("Buy milk"));

  expect(tasksApi.complete).toHaveBeenCalledWith(1);
  expect(screen.getByText("Buy milk").className).toContain("line-through");
});

test("tapping a task on a touch screen opens it", async () => {
  await renderInbox();
  const row = rowOf("Buy milk");
  const p = { pointerType: "touch", pointerId: 1, clientX: 10, clientY: 10 };
  fireEvent.pointerDown(row, p);
  fireEvent.pointerUp(row, p);
  expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Buy milk");
});

// spyOnActions spies on every API call that changes a task, so a test can
// check that none was made.
function spyOnActions() {
  return [
    vi.spyOn(tasksApi, "complete"),
    vi.spyOn(tasksApi, "drop"),
    vi.spyOn(tasksApi, "reopen"),
    vi.spyOn(tasksApi, "move"),
    vi.spyOn(tasksApi, "edit"),
    vi.spyOn(tasksApi, "create"),
  ];
}

async function select(title: string) {
  await screen.findByText(title);
  fireEvent.click(screen.getByText(title));
}

async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(window, { key });
  });
}

test.each([
  ["i", "inbox"],
  ["n", "next"],
  ["w", "waiting"],
  ["s", "someday"],
] as const)("%s moves the selected task to %s, and it leaves the view", async (key, list) => {
  vi.mocked(tasksApi.view).mockResolvedValue([
    task(1, "Buy milk", { list: "next" }),
    task(2, "Call the bank", { list: "next" }),
  ]);
  vi.spyOn(tasksApi, "move").mockImplementation((id, to) =>
    Promise.resolve(task(id, "Buy milk", { list: to })),
  );
  render(<ViewPage view={viewById.next} onNavigate={() => undefined} />);
  await select("Buy milk");

  await press(key);

  expect(tasksApi.move).toHaveBeenCalledWith(1, list);
  if (list === "next") {
    // Already there, so the server returns it unchanged and it stays.
    expect(screen.getByText("Buy milk")).toBeTruthy();
  } else {
    expect(screen.queryByText("Buy milk")).toBeNull();
    expect(selectedTitle()).toBe("Call the bank");
  }
});

test("after moving the last task, the one above is selected", async () => {
  vi.spyOn(tasksApi, "move").mockResolvedValue(task(2, "Call the bank", { list: "next" }));
  await renderInbox();
  await select("Call the bank");

  await press("n");

  expect(titles()).toEqual(["Buy milk"]);
  expect(selectedTitle()).toBe("Buy milk");
});

test("after moving the only task, nothing is selected", async () => {
  vi.mocked(tasksApi.view).mockResolvedValue([task(1, "Buy milk")]);
  vi.spyOn(tasksApi, "move").mockResolvedValue(task(1, "Buy milk", { list: "waiting" }));
  await renderInbox();
  await select("Buy milk");

  await press("w");

  expect(screen.getByText("Nothing in your Inbox.")).toBeTruthy();
  expect(selectedTitle()).toBeUndefined();
});

test("d drops the selected task, which stays muted without a strikethrough", async () => {
  vi.spyOn(tasksApi, "drop").mockResolvedValue(task(1, "Buy milk", { status: "dropped" }));
  await renderInbox();
  await select("Buy milk");

  await press("d");

  expect(tasksApi.drop).toHaveBeenCalledWith(1);
  const title = screen.getByText("Buy milk");
  expect(title.className).toContain("text-muted");
  expect(title.className).not.toContain("line-through");
  expect(screen.getByRole("checkbox", { name: "Restore “Buy milk”" })).toBeTruthy();
  expect(titles()).toEqual(["Buy milk", "Call the bank"]);
});

test("o restores the selected dropped task, which stays in place", async () => {
  vi.mocked(tasksApi.view).mockResolvedValue([
    task(1, "Buy milk", { status: "dropped", list: "waiting" }),
  ]);
  vi.spyOn(tasksApi, "reopen").mockResolvedValue(task(1, "Buy milk", { list: "waiting" }));
  render(<ViewPage view={viewById.dropped} onNavigate={() => undefined} />);
  await select("Buy milk");

  await press("o");

  expect(tasksApi.reopen).toHaveBeenCalledWith(1);
  expect(screen.getByText("Buy milk").className).not.toContain("text-muted");
  expect(screen.getByRole("checkbox", { name: "Complete “Buy milk”" })).toBeTruthy();
});

test("a key the server ignores leaves the task as it was", async () => {
  // c on a dropped task: the server returns it unchanged.
  const dropped = task(1, "Buy milk", { status: "dropped" });
  vi.mocked(tasksApi.view).mockResolvedValue([dropped]);
  vi.spyOn(tasksApi, "complete").mockResolvedValue(dropped);
  render(<ViewPage view={viewById.dropped} onNavigate={() => undefined} />);
  await select("Buy milk");

  await press("c");

  expect(screen.getByText("Buy milk").className).not.toContain("line-through");
  expect(screen.getByRole("checkbox", { name: "Restore “Buy milk”" })).toBeTruthy();
});

test.each(["x", "g", "u", "r"])("%s does nothing", async (key) => {
  const spies = spyOnActions();
  await renderInbox();
  await select("Buy milk");

  await press(key);

  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  expect(screen.getByText("Buy milk").className).not.toContain("line-through");
});

test("a second key press waits for the first to finish", async () => {
  let finish: (t: ReturnType<typeof task>) => void = () => undefined;
  vi.spyOn(tasksApi, "complete").mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  vi.spyOn(tasksApi, "drop");
  await renderInbox();
  await select("Buy milk");

  await press("c");
  await press("d");
  expect(tasksApi.drop).not.toHaveBeenCalled();

  await act(async () => finish(task(1, "Buy milk", { status: "done" })));
  expect(screen.getByText("Buy milk").className).toContain("line-through");
});

test.each([
  ["completed", "done"],
  ["dropped", "dropped"],
] as const)("%s shows each task's list", async (id, status) => {
  vi.mocked(tasksApi.view).mockResolvedValue([
    task(1, "Buy milk", { status, list: "waiting" }),
    task(2, "Call the bank", { status, list: "inbox" }),
  ]);
  render(<ViewPage view={viewById[id]} onNavigate={() => undefined} />);
  await screen.findByText("Buy milk");

  expect(rowOf("Buy milk").textContent).toContain("Waiting");
  expect(rowOf("Call the bank").textContent).toContain("Inbox");
});

test("open views don't show the list", async () => {
  await renderInbox();
  expect(rowOf("Buy milk").textContent).toBe("Buy milk");
});

test.each([
  ["completed", "done", "Reopen"],
  ["dropped", "dropped", "Restore"],
] as const)("in %s, the checkbox and a swipe both reopen", async (id, status, verb) => {
  vi.mocked(tasksApi.view).mockResolvedValue([task(1, "Buy milk", { status })]);
  vi.spyOn(tasksApi, "reopen").mockResolvedValue(task(1, "Buy milk"));
  vi.spyOn(tasksApi, "complete");
  render(<ViewPage view={viewById[id]} onNavigate={() => undefined} />);
  await screen.findByText("Buy milk");

  await act(async () => {
    fireEvent.click(screen.getByRole("checkbox", { name: `${verb} “Buy milk”` }));
  });
  expect(tasksApi.reopen).toHaveBeenCalledTimes(1);

  vi.mocked(tasksApi.reopen).mockClear();
  vi.mocked(tasksApi.view).mockResolvedValue([task(1, "Buy milk", { status })]);
  cleanup();
  render(<ViewPage view={viewById[id]} onNavigate={() => undefined} />);
  await screen.findByText("Buy milk");
  await swipeRight(rowOf("Buy milk"));
  expect(tasksApi.reopen).toHaveBeenCalledTimes(1);
  expect(tasksApi.complete).not.toHaveBeenCalled();
});

async function openEditor(title: string) {
  await screen.findByText(title);
  fireEvent.doubleClick(screen.getByText(title));
  return screen.getByLabelText<HTMLInputElement>("Title").closest("li") as HTMLElement;
}

test("an open task's card has a button for each list and one to drop", async () => {
  await renderInbox();
  const card = await openEditor("Buy milk");

  const moveTo = within(card).getByRole("group", { name: "Move to" });
  const buttons = within(moveTo).getAllByRole("button");
  expect(buttons.map((b) => b.textContent)).toEqual([
    "Inbox",
    "Next Actions",
    "Waiting",
    "Someday",
  ]);
  expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual([
    "true",
    "false",
    "false",
    "false",
  ]);
  expect(within(card).getByRole("button", { name: "Drop" })).toBeTruthy();
  expect(within(card).queryByRole("button", { name: /Reopen|Restore/ })).toBeNull();
});

test("a list button moves the task out of the view", async () => {
  vi.spyOn(tasksApi, "move").mockResolvedValue(task(1, "Buy milk", { list: "waiting" }));
  await renderInbox();
  const card = await openEditor("Buy milk");

  await act(async () => {
    fireEvent.click(within(card).getByRole("button", { name: "Waiting" }));
  });

  expect(tasksApi.move).toHaveBeenCalledWith(1, "waiting");
  expect(titles()).toEqual(["Call the bank"]);
  expect(screen.queryByLabelText("Title")).toBeNull();
});

test("a list button saves unsaved changes first", async () => {
  vi.spyOn(tasksApi, "edit").mockResolvedValue(task(1, "Buy oat milk"));
  vi.spyOn(tasksApi, "move").mockResolvedValue(task(1, "Buy oat milk", { list: "next" }));
  await renderInbox();
  const card = await openEditor("Buy milk");
  fireEvent.change(within(card).getByLabelText("Title"), { target: { value: "Buy oat milk" } });

  await act(async () => {
    fireEvent.click(within(card).getByRole("button", { name: "Next Actions" }));
  });

  expect(tasksApi.edit).toHaveBeenCalledWith(1, { title: "Buy oat milk", description: "" });
  expect(tasksApi.move).toHaveBeenCalledWith(1, "next");
  expect(vi.mocked(tasksApi.edit).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(tasksApi.move).mock.invocationCallOrder[0],
  );
});

test("a list button does nothing if the unsaved changes are rejected", async () => {
  vi.spyOn(tasksApi, "edit").mockRejectedValue(new ApiError("title is required", 400));
  vi.spyOn(tasksApi, "move");
  await renderInbox();
  const card = await openEditor("Buy milk");
  fireEvent.change(within(card).getByLabelText("Title"), { target: { value: " " } });

  await act(async () => {
    fireEvent.click(within(card).getByRole("button", { name: "Next Actions" }));
  });

  expect(tasksApi.move).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toBe("Title is required.");
});

test("the drop button drops the task and closes the card", async () => {
  vi.spyOn(tasksApi, "drop").mockResolvedValue(task(1, "Buy milk", { status: "dropped" }));
  await renderInbox();
  const card = await openEditor("Buy milk");

  await act(async () => {
    fireEvent.click(within(card).getByRole("button", { name: "Drop" }));
  });

  expect(tasksApi.drop).toHaveBeenCalledWith(1);
  expect(screen.queryByLabelText("Title")).toBeNull();
  expect(screen.getByText("Buy milk").className).toContain("text-muted");
});

test.each([
  ["completed", "done", "Reopen"],
  ["dropped", "dropped", "Restore"],
] as const)("in %s, a %s task's card has only a %s button", async (id, status, verb) => {
  vi.mocked(tasksApi.view).mockResolvedValue([task(1, "Buy milk", { status, list: "waiting" })]);
  vi.spyOn(tasksApi, "reopen").mockResolvedValue(task(1, "Buy milk", { list: "waiting" }));
  render(<ViewPage view={viewById[id]} onNavigate={() => undefined} />);
  const card = await openEditor("Buy milk");

  expect(within(card).queryByRole("group", { name: "Move to" })).toBeNull();
  expect(within(card).queryByRole("button", { name: "Drop" })).toBeNull();

  await act(async () => {
    fireEvent.click(within(card).getByRole("button", { name: verb }));
  });
  expect(tasksApi.reopen).toHaveBeenCalledWith(1);
  expect(screen.queryByLabelText("Title")).toBeNull();
});

async function capture(title: string) {
  fireEvent.keyDown(window, { key: "q" });
  const dialog = screen.getByRole("dialog", { name: "New task" });
  fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: title } });
  await act(async () => {
    fireEvent.submit(dialog);
  });
}

test("quick capture from another view adds to the Inbox and says so", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    vi.mocked(tasksApi.view).mockResolvedValue([task(1, "Buy milk", { list: "next" })]);
    vi.spyOn(tasksApi, "create").mockResolvedValue(task(3, "Book dentist"));
    render(<ViewPage view={viewById.next} onNavigate={() => undefined} />);
    await screen.findByText("Buy milk");

    await capture("Book dentist");

    expect(tasksApi.create).toHaveBeenCalledWith("Book dentist", "");
    expect(screen.getByRole("status").textContent).toBe("Added to Inbox");
    expect(screen.queryByText("Book dentist")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByRole("status")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test("quick capture in the Inbox shows the task and no toast", async () => {
  vi.spyOn(tasksApi, "create").mockResolvedValue(task(3, "Book dentist"));
  await renderInbox();

  await capture("Book dentist");

  expect(titles()).toEqual(["Buy milk", "Call the bank", "Book dentist"]);
  expect(screen.queryByRole("status")).toBeNull();
});
