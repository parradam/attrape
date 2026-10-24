import { PlusIcon } from "./icons";

// AddButton opens quick capture on small screens, where there's no `q` key.
export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="New task"
      onClick={onClick}
      className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] grid size-14 place-items-center rounded-full bg-accent text-white shadow-card transition-transform active:scale-95 md:hidden"
    >
      <PlusIcon className="size-6" />
    </button>
  );
}
