import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getPageName } from "./useRecentPages";

export interface AppTab {
  path: string; // pathname + search
  label: string;
  openedAt: number;
}

const STORAGE_KEY = "appTabs";
const MAX_TABS = 12;

const EXCLUDED_PREFIXES = ["/auth", "/unauthorized", "/apply", "/onboarding", "/portal", "/vendor", "/subcontractor"];

const shouldTrack = (pathname: string) =>
  !EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));

const readStored = (): AppTab[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeStored = (tabs: AppTab[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    /* ignore */
  }
};

export function useAppTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<AppTab[]>(() => readStored());

  const currentPath = location.pathname + location.search;
  const activePath = shouldTrack(location.pathname) ? currentPath : null;

  // Add / promote current route as a tab
  useEffect(() => {
    if (!shouldTrack(location.pathname)) return;
    setTabs((prev) => {
      const existing = prev.find((t) => t.path === currentPath);
      let next: AppTab[];
      if (existing) {
        next = prev.map((t) =>
          t.path === currentPath ? { ...t, label: getPageName(location.pathname), openedAt: Date.now() } : t
        );
      } else {
        const entry: AppTab = {
          path: currentPath,
          label: getPageName(location.pathname),
          openedAt: Date.now(),
        };
        next = [...prev, entry];
        if (next.length > MAX_TABS) {
          // Evict oldest inactive tab
          const oldest = next
            .filter((t) => t.path !== currentPath)
            .sort((a, b) => a.openedAt - b.openedAt)[0];
          if (oldest) next = next.filter((t) => t.path !== oldest.path);
        }
      }
      writeStored(next);
      return next;
    });
  }, [currentPath, location.pathname]);

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path);
        const next = prev.filter((t) => t.path !== path);
        writeStored(next);
        if (path === activePath) {
          const fallback = next[Math.max(0, idx - 1)] ?? next[0];
          navigate(fallback ? fallback.path : "/");
        }
        return next;
      });
    },
    [activePath, navigate]
  );

  const activateTab = useCallback(
    (path: string) => {
      if (path !== activePath) navigate(path);
    },
    [activePath, navigate]
  );

  const closeOthers = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const keep = prev.filter((t) => t.path === path);
        writeStored(keep);
        return keep;
      });
    },
    []
  );

  const closeAll = useCallback(() => {
    setTabs(() => {
      writeStored([]);
      return [];
    });
    navigate("/");
  }, [navigate]);

  return { tabs, activePath, activateTab, closeTab, closeOthers, closeAll };
}
