import { afterEach, beforeEach, expect, test } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useRoute } from "./useRoute";

beforeEach(() => window.history.replaceState(null, "", "/inbox"));
afterEach(cleanup);

test("starts at the current path", () => {
  const { result } = renderHook(() => useRoute());
  expect(result.current.path).toBe("/inbox");
});

test("navigate adds a history entry", () => {
  const { result } = renderHook(() => useRoute());
  const before = window.history.length;
  act(() => result.current.navigate("/next"));
  expect(result.current.path).toBe("/next");
  expect(window.location.pathname).toBe("/next");
  expect(window.history.length).toBe(before + 1);
});

test("navigate with replace doesn't add a history entry", () => {
  const { result } = renderHook(() => useRoute());
  const before = window.history.length;
  act(() => result.current.navigate("/next", { replace: true }));
  expect(window.location.pathname).toBe("/next");
  expect(window.history.length).toBe(before);
});

test("navigating to the current path does nothing", () => {
  const { result } = renderHook(() => useRoute());
  const before = window.history.length;
  act(() => result.current.navigate("/inbox"));
  expect(window.history.length).toBe(before);
});

test("follows the back and forward buttons", () => {
  const { result } = renderHook(() => useRoute());
  act(() => {
    window.history.pushState(null, "", "/waiting");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(result.current.path).toBe("/waiting");
});
