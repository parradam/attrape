import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SWIPE_THRESHOLD, useSwipe } from "./useSwipe";

afterEach(cleanup);

function Row({ onSwipe, onTap }: { onSwipe: () => void; onTap: () => void }) {
  const { offset, handlers } = useSwipe({ onSwipe, onTap });
  return (
    <div data-testid="row" data-offset={offset} {...handlers}>
      row
    </div>
  );
}

function setup() {
  const onSwipe = vi.fn();
  const onTap = vi.fn();
  render(<Row onSwipe={onSwipe} onTap={onTap} />);
  return { row: screen.getByTestId("row"), onSwipe, onTap };
}

const touch = { pointerType: "touch", pointerId: 1 };

function gesture(row: HTMLElement, dx: number, dy: number, pointerType = "touch") {
  const p = { ...touch, pointerType };
  fireEvent.pointerDown(row, { ...p, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(row, { ...p, clientX: 10 + dx / 2, clientY: 10 + dy / 2 });
  fireEvent.pointerMove(row, { ...p, clientX: 10 + dx, clientY: 10 + dy });
  fireEvent.pointerUp(row, { ...p, clientX: 10 + dx, clientY: 10 + dy });
}

test.each([
  { name: "swipe right past the threshold", dx: SWIPE_THRESHOLD + 5, dy: 0, swipe: 1, tap: 0 },
  { name: "short drag right", dx: SWIPE_THRESHOLD - 20, dy: 0, swipe: 0, tap: 0 },
  { name: "swipe left", dx: -(SWIPE_THRESHOLD + 5), dy: 0, swipe: 0, tap: 0 },
  { name: "vertical scroll", dx: 20, dy: 100, swipe: 0, tap: 0 },
  { name: "tap", dx: 2, dy: 2, swipe: 0, tap: 1 },
])("$name", ({ dx, dy, swipe, tap }) => {
  const { row, onSwipe, onTap } = setup();
  gesture(row, dx, dy);
  expect(onSwipe).toHaveBeenCalledTimes(swipe);
  expect(onTap).toHaveBeenCalledTimes(tap);
});

test("ignores the mouse", () => {
  const { row, onSwipe, onTap } = setup();
  gesture(row, SWIPE_THRESHOLD + 5, 0, "mouse");
  gesture(row, 0, 0, "mouse");
  expect(onSwipe).not.toHaveBeenCalled();
  expect(onTap).not.toHaveBeenCalled();
});

test("the row follows the finger and springs back", () => {
  const { row } = setup();
  fireEvent.pointerDown(row, { ...touch, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(row, { ...touch, clientX: 60, clientY: 10 });
  expect(row.dataset.offset).toBe("50");
  fireEvent.pointerUp(row, { ...touch, clientX: 60, clientY: 10 });
  expect(row.dataset.offset).toBe("0");
});
