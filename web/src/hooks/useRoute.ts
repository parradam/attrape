import { useCallback, useEffect, useState } from "react";

// useRoute returns the current path and a navigate function, using the
// browser's history so the back and forward buttons work.
export function useRoute() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((to: string, { replace = false } = {}) => {
    if (to === window.location.pathname) return;
    if (replace) window.history.replaceState(null, "", to);
    else window.history.pushState(null, "", to);
    setPath(to);
  }, []);

  return { path, navigate };
}
