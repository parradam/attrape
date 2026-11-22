import { ViewLinks } from "./ViewLink";
import { views, type View } from "./views";

type Props = {
  current: View;
  onNavigate: (path: string) => void;
};

// Sidebar lists every view on desktop. Mobile uses ViewMenu instead.
export function Sidebar({ current, onNavigate }: Props) {
  return (
    <nav
      aria-label="Views"
      className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line bg-sidebar px-3 pt-16 md:block"
    >
      <ViewLinks views={views} current={current} onNavigate={onNavigate} />
    </nav>
  );
}
