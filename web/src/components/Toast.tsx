import { useEffect, useEffectEvent } from "react";

type Props = {
  message: string;
  onDone: () => void;
};

const DURATION_MS = 2000;

// Toast shows a short message that disappears on its own. Give it a new key
// to show the same message again from the start.
export function Toast({ message, onDone }: Props) {
  const done = useEffectEvent(onDone);

  useEffect(() => {
    const timer = setTimeout(done, DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <p
      role="status"
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-card md:bottom-8"
    >
      {message}
    </p>
  );
}
