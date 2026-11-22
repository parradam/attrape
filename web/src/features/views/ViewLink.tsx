import type { MouseEvent } from "react";
import type { View } from "./views";

type Props = {
  view: View;
  current: boolean;
  onNavigate: (path: string) => void;
};

// ViewLink is a link to a view. A plain click changes view without
// reloading; a modified click is left to the browser, e.g. to open a tab.
export function ViewLink({ view, current, onNavigate }: Props) {
  const Icon = view.icon;

  function onClick(e: MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(view.path);
  }

  return (
    <a
      href={view.path}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-row px-2.5 py-1.5 text-[15px] ${
        current ? "bg-line/70 font-medium" : "hover:bg-line/40"
      }`}
    >
      <Icon className="size-4.5 shrink-0 text-accent" />
      {view.title}
    </a>
  );
}

// ViewLinks lists every view, with Completed and Dropped set apart from the
// four lists.
export function ViewLinks({
  views,
  current,
  onNavigate,
}: {
  views: View[];
  current: View;
  onNavigate: (path: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {views.map((view, i) => (
        <li key={view.id} className={!view.list && views[i - 1]?.list ? "mt-4" : ""}>
          <ViewLink view={view} current={view.id === current.id} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  );
}
