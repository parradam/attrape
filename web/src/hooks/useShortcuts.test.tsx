import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useShortcuts } from "./useShortcuts";

afterEach(cleanup);

function Harness({ onQ }: { onQ: () => void }) {
  useShortcuts({ q: onQ });
  return (
    <div>
      <input aria-label="field" />
      <textarea aria-label="notes" />
    </div>
  );
}

test("runs the handler for its key", () => {
  const onQ = vi.fn();
  render(<Harness onQ={onQ} />);
  fireEvent.keyDown(window, { key: "q" });
  expect(onQ).toHaveBeenCalledTimes(1);
});

test("ignores other keys and modifiers", () => {
  const onQ = vi.fn();
  render(<Harness onQ={onQ} />);
  fireEvent.keyDown(window, { key: "w" });
  fireEvent.keyDown(window, { key: "q", metaKey: true });
  fireEvent.keyDown(window, { key: "q", ctrlKey: true });
  expect(onQ).not.toHaveBeenCalled();
});

test("ignores keys typed into fields", () => {
  const onQ = vi.fn();
  const { getByLabelText } = render(<Harness onQ={onQ} />);
  fireEvent.keyDown(getByLabelText("field"), { key: "q" });
  fireEvent.keyDown(getByLabelText("notes"), { key: "q" });
  expect(onQ).not.toHaveBeenCalled();
});
