import { useEffect, useEffectEvent } from "react";

export type Shortcuts = Partial<Record<string, (e: KeyboardEvent) => void>>;

// isTyping reports whether a key press belongs to a text field.
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// useShortcuts calls the handler for e.key on keydown anywhere in the page.
// Keys are ignored while typing in a field or with a modifier held.
export function useShortcuts(shortcuts: Shortcuts) {
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    const handler = shortcuts[e.key];
    if (handler) {
      e.preventDefault();
      handler(e);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
