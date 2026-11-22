import { useEffect } from "react";
import { useRoute } from "./hooks/useRoute";
import { Sidebar } from "./features/views/Sidebar";
import { ViewPage } from "./features/views/ViewPage";
import { viewById, viewForPath } from "./features/views/views";

// App picks the view from the URL. Any path that isn't a view, including /,
// goes to the Inbox.
export default function App() {
  const { path, navigate } = useRoute();
  const view = viewForPath(path);

  useEffect(() => {
    if (view) document.title = `${view.title} · Attrape`;
    else navigate(viewById.inbox.path, { replace: true });
  }, [view, navigate]);

  if (!view) return null;

  return (
    <div className="md:flex">
      <Sidebar current={view} onNavigate={navigate} />
      <ViewPage key={view.id} view={view} onNavigate={navigate} />
    </div>
  );
}
