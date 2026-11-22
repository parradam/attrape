import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { errorMessage } from "../../api/client";
import type { List, Task } from "../../api/tasks";
import { SWIPE_THRESHOLD, useSwipe } from "../../hooks/useSwipe";
import { Checkbox } from "../../components/Checkbox";
import { TickIcon } from "../../components/icons";

type Props = {
  task: Task;
  selected: boolean;
  editing: boolean;
  // listLabel names the task's list, in views that mix lists.
  listLabel?: string;
  onSelect: () => void;
  onToggle: () => void;
  // lists are the lists an open task can be moved to, for the card's buttons.
  lists: { list: List; title: string }[];
  onMove: (list: List) => void;
  onDrop: () => void;
  onReopen: () => void;
  onOpen: () => void;
  onSave: (changes: { title: string; description: string }) => Promise<void>;
  onClose: () => void;
};

// TaskRow is one task in a list. Opening it expands it into an editing card.
// On touch screens a tap opens it and a swipe right does what the checkbox
// does: complete an open task, or reopen or restore a done or dropped one.
export function TaskRow({
  task,
  selected,
  editing,
  listLabel,
  onSelect,
  onToggle,
  lists,
  onMove,
  onDrop,
  onReopen,
  onOpen,
  onSave,
  onClose,
}: Props) {
  const ref = useRef<HTMLLIElement>(null);
  const { offset, handlers } = useSwipe({ onSwipe: onToggle, onTap: onOpen });

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (editing) {
    return (
      <TaskEditor
        task={task}
        lists={lists}
        onToggle={onToggle}
        onMove={onMove}
        onDrop={onDrop}
        onReopen={onReopen}
        onSave={onSave}
        onClose={onClose}
      />
    );
  }

  return (
    <li
      ref={ref}
      aria-selected={selected}
      onClick={onSelect}
      onDoubleClick={onOpen}
      {...handlers}
      className="relative cursor-default touch-pan-y overflow-hidden rounded-row select-none"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center bg-accent pl-4 text-white"
        style={{ opacity: Math.min(offset / SWIPE_THRESHOLD, 1) }}
      >
        <TickIcon className="size-5" />
      </div>
      <div
        className={`relative flex items-center gap-3 px-3 py-1.75 ${
          selected ? "bg-accent-soft" : "bg-canvas"
        } ${offset === 0 ? "transition-transform" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        <Checkbox status={task.status} title={task.title} onToggle={onToggle} />
        <span
          className={`min-w-0 flex-1 truncate text-[15px] transition-colors ${titleStyles[task.status]}`}
        >
          {task.title}
        </span>
        {listLabel && <span className="shrink-0 text-xs text-muted">{listLabel}</span>}
      </div>
    </li>
  );
}

// Until reload, a done task is muted and struck through and a dropped one
// is muted.
const titleStyles = { open: "", done: "text-muted line-through", dropped: "text-muted" };

type EditorProps = Pick<
  Props,
  "task" | "lists" | "onToggle" | "onMove" | "onDrop" | "onReopen" | "onSave" | "onClose"
>;

function TaskEditor({
  task,
  lists,
  onToggle,
  onMove,
  onDrop,
  onReopen,
  onSave,
  onClose,
}: EditorProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [error, setError] = useState("");

  const changed = title !== task.title || description !== task.description;

  // persist saves any changes. If the server rejects them, it keeps the card
  // open on the saved title, so nothing is lost silently, and returns false.
  async function persist(): Promise<boolean> {
    try {
      await onSave({ title, description });
      return true;
    } catch (err) {
      setTitle(task.title);
      setError(errorMessage(err));
      return false;
    }
  }

  async function save() {
    if (!changed || (await persist())) onClose();
  }

  // act saves any changes, closes the card, then runs a button's action.
  async function act(action: () => void) {
    if (changed && !(await persist())) return;
    onClose();
    action();
  }

  function onBlur(e: FocusEvent) {
    if (!e.currentTarget.contains(e.relatedTarget)) void save();
  }

  function onKeyDown(e: KeyboardEvent) {
    // Like Things, Escape keeps your changes rather than discarding them.
    const enterSaves = e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey;
    if (e.key === "Escape" || (e.key === "Enter" && enterSaves)) {
      e.preventDefault();
      void save();
    }
  }

  return (
    <li
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="my-3 rounded-card bg-surface px-3 pt-3 pb-4 shadow-card"
    >
      <div className="flex items-center gap-3">
        <Checkbox status={task.status} title={task.title} onToggle={onToggle} />
        <input
          autoFocus
          aria-label="Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        />
      </div>
      <textarea
        aria-label="Notes"
        placeholder="Notes"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="mt-2 w-full resize-none bg-transparent pl-7.5 text-sm text-ink/80 outline-none placeholder:text-muted"
      />
      {error && (
        <p role="alert" className="pl-7.5 text-sm text-red-600">
          {error}
        </p>
      )}
      {/* On mobile, where there are no keys, buttons move, drop and reopen. */}
      <div className="mt-3 pl-7.5 md:hidden">
        {task.status === "open" ? (
          <>
            <p aria-hidden="true" className="mb-1.5 text-xs text-muted">
              Move to
            </p>
            <div role="group" aria-label="Move to" className="flex flex-wrap gap-1.5">
              {lists.map(({ list, title }) => (
                <ActionButton
                  key={list}
                  pressed={task.list === list}
                  onClick={() => void act(() => onMove(list))}
                >
                  {title}
                </ActionButton>
              ))}
            </div>
            <ActionButton plain onClick={() => void act(onDrop)}>
              Drop
            </ActionButton>
          </>
        ) : (
          <ActionButton onClick={() => void act(onReopen)}>
            {task.status === "done" ? "Reopen" : "Restore"}
          </ActionButton>
        )}
      </div>
    </li>
  );
}

type ActionButtonProps = {
  pressed?: boolean;
  // plain is a quieter text button, set apart from the list buttons.
  plain?: boolean;
  onClick: () => void;
  children: string;
};

function ActionButton({ pressed, plain, onClick, children }: ActionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      // Keep focus in the card, so the press doesn't also save it on blur.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        plain
          ? "mt-3 -ml-1 rounded-row p-1 text-sm text-muted"
          : "rounded-full border border-line px-3 py-1 text-sm text-ink/80 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
      }
    >
      {children}
    </button>
  );
}
