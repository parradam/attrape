import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { tasksApi } from "./api/tasks";
import { task } from "./test/task";
import App from "./App";

beforeEach(() => {
  vi.spyOn(tasksApi, "view").mockImplementation((view) =>
    Promise.resolve([task(1, `A task in ${view}`)]),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderAt(path: string) {
  window.history.replaceState(null, "", path);
  render(<App />);
  await screen.findByText(/^A task in/);
}

function heading() {
  return screen.getByRole("heading", { level: 1 }).textContent;
}

const views = [
  ["/inbox", "inbox", "Inbox"],
  ["/next", "next", "Next Actions"],
  ["/waiting", "waiting", "Waiting"],
  ["/someday", "someday", "Someday"],
  ["/completed", "completed", "Completed"],
  ["/dropped", "dropped", "Dropped"],
] as const;

test.each(views)("%s shows the %s view", async (path, view, title) => {
  await renderAt(path);
  expect(tasksApi.view).toHaveBeenCalledWith(view);
  expect(heading()).toContain(title);
  expect(document.title).toBe(`${title} · Attrape`);
  expect(screen.getByText(`A task in ${view}`)).toBeTruthy();
});

test.each(["/", "/today", "/inbox/extra"])("%s goes to the Inbox", async (path) => {
  const before = window.history.length;
  await renderAt(path);
  expect(window.location.pathname).toBe("/inbox");
  expect(window.history.length).toBe(before);
  expect(heading()).toContain("Inbox");
});

test("the sidebar reaches every view and marks the current one", async () => {
  await renderAt("/inbox");
  const sidebar = screen.getByRole("navigation", { name: "Views" });
  const links = within(sidebar).getAllByRole("link");
  expect(links.map((a) => a.textContent)).toEqual(views.map(([, , title]) => title));
  expect(links.map((a) => a.getAttribute("href"))).toEqual(views.map(([path]) => path));
  expect(within(sidebar).getByRole("link", { current: "page" }).textContent).toBe("Inbox");
});

test("clicking a sidebar link changes view and URL", async () => {
  await renderAt("/inbox");
  const sidebar = screen.getByRole("navigation", { name: "Views" });
  await act(async () => {
    fireEvent.click(within(sidebar).getByRole("link", { name: "Waiting" }));
  });
  expect(window.location.pathname).toBe("/waiting");
  expect(heading()).toContain("Waiting");
  expect(await screen.findByText("A task in waiting")).toBeTruthy();
});

test("a modified click on a link is left to the browser", async () => {
  await renderAt("/inbox");
  const sidebar = screen.getByRole("navigation", { name: "Views" });
  fireEvent.click(within(sidebar).getByRole("link", { name: "Waiting" }), { metaKey: true });
  expect(window.location.pathname).toBe("/inbox");
});

test("the back button returns to the previous view", async () => {
  await renderAt("/inbox");
  const sidebar = screen.getByRole("navigation", { name: "Views" });
  await act(async () => {
    fireEvent.click(within(sidebar).getByRole("link", { name: "Someday" }));
  });
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
  });
  expect(heading()).toContain("Inbox");
});

test("the mobile menu reaches every view", async () => {
  await renderAt("/inbox");
  const toggle = screen.getByRole("button", { name: "Inbox, choose a view" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");

  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  const menu = screen.getByRole("navigation", { name: "Choose a view" });
  expect(
    within(menu)
      .getAllByRole("link")
      .map((a) => a.textContent),
  ).toEqual(views.map(([, , title]) => title));

  await act(async () => {
    fireEvent.click(within(menu).getByRole("link", { name: "Dropped" }));
  });
  expect(window.location.pathname).toBe("/dropped");
  expect(screen.queryByRole("navigation", { name: "Choose a view" })).toBeNull();
});

test("Escape closes the mobile menu", async () => {
  await renderAt("/inbox");
  fireEvent.click(screen.getByRole("button", { name: "Inbox, choose a view" }));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("navigation", { name: "Choose a view" })).toBeNull();
});
