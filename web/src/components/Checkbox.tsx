import { DashIcon, TickIcon } from "./icons";

type Props = {
  status: "open" | "done" | "dropped";
  title: string;
  onToggle: () => void;
};

const verbs = { open: "Complete", done: "Reopen", dropped: "Restore" };

// Checkbox is the round control at the start of a task row. It completes an
// open task, and reopens or restores a done or dropped one.
export function Checkbox({ status, title, onToggle }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={status === "done"}
      aria-label={`${verbs[status]} “${title}”`}
      // Keep presses away from the row, which would select, open or swipe it.
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`grid size-4.5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ${
        status === "done"
          ? "border-accent bg-accent text-white"
          : status === "dropped"
            ? "border-muted/50 bg-line text-muted hover:border-accent"
            : "border-muted/70 bg-surface hover:border-accent"
      }`}
    >
      {status === "done" && <TickIcon className="size-3" />}
      {status === "dropped" && <DashIcon className="size-3" />}
    </button>
  );
}
