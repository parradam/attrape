import { TickIcon } from "./icons";

type Props = {
  checked: boolean;
  label: string;
  onToggle: () => void;
};

// Checkbox is the round completion control at the start of a task row.
export function Checkbox({ checked, label, onToggle }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ${
        checked
          ? "border-accent bg-accent text-white"
          : "border-muted/70 bg-surface hover:border-accent"
      }`}
    >
      {checked && <TickIcon className="size-3" />}
    </button>
  );
}
