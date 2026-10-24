import { useState, type KeyboardEvent, type SubmitEvent } from "react";
import { errorMessage } from "../../api/client";
import { tasksApi, type Task } from "../../api/tasks";

type Props = {
  onCreated: (task: Task) => void;
  onClose: () => void;
};

// QuickCapture is the modal for adding a task to the Inbox.
export function QuickCapture({ onCreated, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e?: SubmitEvent) {
    e?.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      onCreated(await tasksApi.create(title, description));
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void save();
    }
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-start justify-center bg-black/20 px-4 pt-[18vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        role="dialog"
        aria-label="New task"
        onSubmit={(e) => void save(e)}
        onKeyDown={onKeyDown}
        className="w-full max-w-lg rounded-card bg-surface p-4 shadow-card"
      >
        <input
          autoFocus
          aria-label="Title"
          placeholder="New task"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
        <textarea
          aria-label="Notes"
          placeholder="Notes"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-2 w-full resize-none bg-transparent text-sm text-ink/80 outline-none placeholder:text-muted"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-row px-3 py-1.5 text-sm text-muted hover:bg-line/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-row bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Add to Inbox
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
