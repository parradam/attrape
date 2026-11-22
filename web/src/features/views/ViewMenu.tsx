import { useState } from "react";
import { useShortcuts } from "../../hooks/useShortcuts";
import { ChevronDownIcon } from "../../components/icons";
import { ViewLinks } from "./ViewLink";
import { views, type View } from "./views";

type Props = {
  view: View;
  onNavigate: (path: string) => void;
};

// ViewMenu is the view's heading. On mobile, where there's no sidebar, the
// heading is a button that opens a menu of every view.
export function ViewMenu({ view, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const Icon = view.icon;

  useShortcuts(open ? { Escape: () => setOpen(false) } : {});

  return (
    <div className="relative mb-6 px-3">
      <h1 className="text-[28px] font-bold tracking-tight">
        <span className="hidden items-center gap-2.5 md:flex">
          <Icon className="size-7 text-accent" />
          {view.title}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${view.title}, choose a view`}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 md:hidden"
        >
          <Icon className="size-7 text-accent" />
          {view.title}
          <ChevronDownIcon
            className={`size-5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h1>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <nav
            aria-label="Choose a view"
            className="absolute top-full left-0 z-20 mt-2 w-64 rounded-card bg-surface p-1.5 shadow-card"
          >
            <ViewLinks
              views={views}
              current={view}
              onNavigate={(path) => {
                setOpen(false);
                onNavigate(path);
              }}
            />
          </nav>
        </>
      )}
    </div>
  );
}
