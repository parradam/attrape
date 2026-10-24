import { useState, type FocusEvent, type KeyboardEvent } from "react";
import { errorMessage } from "../../api/client";
import type { Task } from "../../api/tasks";
import { Checkbox } from "../../components/Checkbox";

type Props = {
  task: Task;
  editing: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onSave: (changes: { title: string; description: string }) => Promise<void>;
  onClose: () => void;
};

// TaskRow is one task in a list. Opening it expands it into an editing card.
export function TaskRow({ task, editing, onToggle, onOpen, onSave, onClose }: Props) {
  const done = task.status === "done";

  if (editing) {
    return <TaskEditor task={task} onToggle={onToggle} onSave={onSave} onClose={onClose} />;
  }

  return (
    <li
      onDoubleClick={onOpen}
      onPointerUp={(e) => e.pointerType === "touch" && onOpen()}
      className="flex cursor-default items-center gap-3 rounded-row px-3 py-[7px] select-none"
    >
      <Checkbox checked={done} label={`Complete “${task.title}”`} onToggle={onToggle} />
      <span
        className={`min-w-0 flex-1 truncate text-[15px] transition-colors ${
          done ? "text-muted line-through" : ""
        }`}
      >
        {task.title}
      </span>
    </li>
  );
}

type EditorProps = Omit<Props, "editing" | "onOpen">;

function TaskEditor({ task, onToggle, onSave, onClose }: EditorProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [error, setError] = useState("");

  async function save() {
    if (title === task.title && description === task.description) {
      onClose();
      return;
    }
    try {
      await onSave({ title, description });
      onClose();
    } catch (err) {
      // Keep the card open on the saved title so nothing is lost silently.
      setTitle(task.title);
      setError(errorMessage(err));
    }
  }

  function onBlur(e: FocusEvent) {
    if (!e.currentTarget.contains(e.relatedTarget)) save();
  }

  function onKeyDown(e: KeyboardEvent) {
    // Like Things, Escape keeps your changes rather than discarding them.
    const enterSaves = e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey;
    if (e.key === "Escape" || (e.key === "Enter" && enterSaves)) {
      e.preventDefault();
      save();
    }
  }

  return (
    <li
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="my-3 rounded-card bg-surface px-3 pt-3 pb-4 shadow-card"
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={task.status === "done"}
          label={`Complete “${task.title}”`}
          onToggle={onToggle}
        />
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
        className="mt-2 w-full resize-none bg-transparent pl-[30px] text-sm text-ink/80 outline-none placeholder:text-muted"
      />
      {error && (
        <p role="alert" className="pl-[30px] text-sm text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}
