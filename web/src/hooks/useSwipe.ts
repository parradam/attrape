import { useRef, useState, type PointerEvent } from "react";

// Distance a finger must travel right before letting go counts as a swipe.
export const SWIPE_THRESHOLD = 80;
// Movement below this is a tap, not a drag.
const TAP_SLOP = 10;
const MAX_OFFSET = 120;

type Options = {
  onSwipe: () => void;
  onTap: () => void;
};

// useSwipe handles touch gestures on a row: a tap, or a swipe right that
// drags the row along with the finger. Mouse and pen input are ignored.
export function useSwipe({ onSwipe, onTap }: Options) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef(false);
  const [offset, setOffset] = useState(0);

  function reset() {
    start.current = null;
    horizontal.current = false;
    setOffset(0);
  }

  return {
    offset,
    handlers: {
      onPointerDown(e: PointerEvent) {
        if (e.pointerType !== "touch") return;
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      },
      onPointerMove(e: PointerEvent) {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (!horizontal.current) {
          if (Math.abs(dy) > TAP_SLOP && Math.abs(dy) > Math.abs(dx)) {
            // The user is scrolling; let the page have it.
            start.current = null;
            return;
          }
          if (dx > TAP_SLOP) horizontal.current = true;
        }
        if (horizontal.current) setOffset(Math.min(Math.max(dx, 0), MAX_OFFSET));
      },
      onPointerUp(e: PointerEvent) {
        const s = start.current;
        if (!s || s.id !== e.pointerId) {
          reset();
          return;
        }
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (horizontal.current && dx >= SWIPE_THRESHOLD) onSwipe();
        else if (!horizontal.current && Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) onTap();
        reset();
      },
      onPointerCancel: reset,
    },
  };
}
