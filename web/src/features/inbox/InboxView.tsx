import { useEffect, useState } from "react";
import { errorMessage } from "../../api/client";
import { tasksApi, type Task } from "../../api/tasks";
import { useShortcuts } from "../../hooks/useShortcuts";
import { AddButton } from "../../components/AddButton";
import { InboxIcon } from "../../components/icons";
import { QuickCapture } from "../tasks/QuickCapture";
import { TaskRow } from "../tasks/TaskRow";

// InboxView lists Inbox tasks. Tasks completed here stay, struck through,
// until the next load, when the server leaves them out.
export function InboxView() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    tasksApi.inbox().then(setTasks, (err) => setError(errorMessage(err)));
  }, []);

  useShortcuts({ q: () => setCapturing(true) });

  function replace(task: Task) {
    setTasks((ts) => ts?.map((t) => (t.id === task.id ? task : t)) ?? null);
  }

  async function toggle(task: Task) {
    const done = task.status === "done";
    // Show the change straight away; put it back if the server says no.
    replace({ ...task, status: done ? "open" : "done" });
    try {
      replace(await (done ? tasksApi.reopen(task.id) : tasksApi.complete(task.id)));
      setError("");
    } catch (err) {
      replace(task);
      setError(errorMessage(err));
    }
  }

  async function save(task: Task, changes: { title: string; description: string }) {
    replace(await tasksApi.edit(task.id, changes));
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-[calc(3rem+env(safe-area-inset-top))] pb-28 md:px-8 md:pt-16">
      <h1 className="mb-6 flex items-center gap-2.5 px-3 text-[28px] font-bold tracking-tight">
        <InboxIcon className="size-7 text-accent" />
        Inbox
      </h1>

      {error && (
        <p role="alert" className="mx-3 mb-4 rounded-row bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {tasks?.length === 0 && (
        <p className="px-3 pt-16 text-center text-muted">Nothing in your Inbox.</p>
      )}

      <ul>
        {tasks?.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            editing={editingId === task.id}
            onToggle={() => toggle(task)}
            onOpen={() => setEditingId(task.id)}
            onSave={(changes) => save(task, changes)}
            onClose={() => setEditingId(null)}
          />
        ))}
      </ul>

      <AddButton onClick={() => setCapturing(true)} />

      {capturing && (
        <QuickCapture
          onClose={() => setCapturing(false)}
          onCreated={(task) => {
            setTasks((ts) => [...(ts ?? []), task]);
            setCapturing(false);
          }}
        />
      )}
    </main>
  );
}
