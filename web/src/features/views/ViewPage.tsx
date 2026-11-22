import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../../api/client";
import { tasksApi, type Task } from "../../api/tasks";
import { useShortcuts } from "../../hooks/useShortcuts";
import { AddButton } from "../../components/AddButton";
import { QuickCapture } from "../tasks/QuickCapture";
import { TaskRow } from "../tasks/TaskRow";
import { ViewMenu } from "./ViewMenu";
import { viewById, views, type View } from "./views";

type Props = {
  view: View;
  onNavigate: (path: string) => void;
};

// ViewPage lists the tasks in one view. A task completed, dropped, reopened
// or restored here stays in place, styled, until the next load, when the
// server shows it in its new view. A moved task leaves the view straight away.
//
// Changes wait for the server and show the task it returns, so the rules
// about which changes do nothing (such as moving a done task) live only on
// the server.
export function ViewPage({ view, onNavigate }: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);
  // pending holds tasks with a change in flight; further changes wait.
  const pending = useRef(new Set<number>());

  useEffect(() => {
    tasksApi.view(view.id).then(setTasks, (err: unknown) => setError(errorMessage(err)));
  }, [view.id]);

  // Move the selection by step, starting from the top if nothing is selected.
  function move(step: number) {
    if (!tasks?.length) return;
    const i = tasks.findIndex((t) => t.id === selectedId);
    const next = i === -1 ? 0 : Math.min(Math.max(i + step, 0), tasks.length - 1);
    setSelectedId(tasks[next].id);
  }

  const selected = tasks?.find((t) => t.id === selectedId);

  // i, n, w and s move the selected task to that view's list.
  const moveKeys = Object.fromEntries(
    views.flatMap(({ key, list }) =>
      list ? [[key, () => selected && void change(selected, (id) => tasksApi.move(id, list))]] : [],
    ),
  );

  useShortcuts({
    q: () => setCapturing(true),
    j: () => move(1),
    k: () => move(-1),
    ArrowDown: () => move(1),
    ArrowUp: () => move(-1),
    c: () => selected && void change(selected, tasksApi.complete),
    d: () => selected && void change(selected, tasksApi.drop),
    o: () => selected && void change(selected, tasksApi.reopen),
    ...moveKeys,
    Enter: () => selected && setEditingId(selected.id),
    Escape: () => setSelectedId(null),
  });

  function replace(task: Task) {
    setTasks((ts) => ts?.map((t) => (t.id === task.id ? task : t)) ?? null);
  }

  // toggle is the checkbox and swipe: complete an open task, or reopen or
  // restore a done or dropped one.
  function toggle(task: Task) {
    void change(task, task.status === "open" ? tasksApi.complete : tasksApi.reopen);
  }

  // change sends a change to the server and shows the task it returns. A task
  // whose list no longer matches this view leaves it, and the selection moves
  // to the next task down, or the one above if it was the last.
  async function change(task: Task, call: (id: number) => Promise<Task>) {
    if (pending.current.has(task.id)) return;
    pending.current.add(task.id);
    const before = tasks ?? [];
    try {
      const updated = await call(task.id);
      setError("");
      if (view.list && updated.list !== view.list) {
        const i = before.findIndex((t) => t.id === task.id);
        const rest = before.filter((t) => t.id !== task.id);
        // rest[i] is the next task down; past the end, the one above.
        const neighbour = rest.at(Math.min(i, rest.length - 1));
        setTasks((ts) => ts?.filter((t) => t.id !== task.id) ?? null);
        setSelectedId((id) => (id === task.id ? (neighbour?.id ?? null) : id));
      } else {
        replace(updated);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      pending.current.delete(task.id);
    }
  }

  async function save(task: Task, changes: { title: string; description: string }) {
    replace(await tasksApi.edit(task.id, changes));
  }

  return (
    // Clicking anywhere outside a task clears the selection.
    <div
      className="min-h-dvh flex-1"
      onClick={(e) => !(e.target as Element).closest("li") && setSelectedId(null)}
    >
      <main className="mx-auto max-w-2xl px-4 pt-[calc(3rem+env(safe-area-inset-top))] pb-28 md:px-8 md:pt-16">
        <ViewMenu view={view} onNavigate={onNavigate} />

        {error && (
          <p
            role="alert"
            className="mx-3 mb-4 rounded-row bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {tasks?.length === 0 && (
          <p className="px-3 pt-16 text-center text-muted">{view.emptyText}</p>
        )}

        <ul aria-label={view.title}>
          {tasks?.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              selected={selectedId === task.id}
              editing={editingId === task.id}
              listLabel={view.list ? undefined : viewById[task.list].title}
              onSelect={() => setSelectedId(task.id)}
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
              setSelectedId(task.id);
              setCapturing(false);
            }}
          />
        )}
      </main>
    </div>
  );
}
