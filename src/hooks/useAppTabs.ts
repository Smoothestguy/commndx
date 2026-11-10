import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getPageName } from "./useRecentPages";

/**
 * Browser-like workspace tabs. A tab is keyed by pathname (one per screen);
 * its latest query string (filters/URL state) and scroll offset are remembered
 * so flipping back restores the screen as it was left. Session-scoped.
 */
export interface AppTab {
  /** pathname (tab identity) */
  key: string;
  /** last full path (pathname + search) visited inside this tab */
  path: string;
  label: string;
  openedAt: number;
  scrollY?: number;
}

const STORAGE_KEY = "workspaceTabs";
const MAX_TABS = 15;
export const HOME_KEY = "/";

const EXCLUDED_PREFIXES = ["/auth", "/unauthorized", "/apply", "/onboarding", "/portal", "/vendor", "/subcontractor", "/punch", "/kiosk", "/sign", "/agency", "/customer-portal", "/join"];

const shouldTrack = (pathname: string) => !EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

const home = (): AppTab => ({ key: HOME_KEY, path: HOME_KEY, label: "Home", openedAt: 0 });

const readStored = (): AppTab[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const tabs: AppTab[] = raw ? JSON.parse(raw) : [];
    const rest = tabs.filter((t) => t && t.key && t.key !== HOME_KEY);
    return [tabs.find((t) => t.key === HOME_KEY) ?? home(), ...rest];
  } catch {
    return [home()];
  }
};

const writeStored = (tabs: AppTab[]) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs)); } catch { /* ignore */ }
};

export function useAppTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<AppTab[]>(() => readStored());
  const pendingScroll = useRef<number | null>(null);

  const activeKey = shouldTrack(location.pathname) ? location.pathname : null;
  const currentPath = location.pathname + location.search;

  // Track the current screen; update its remembered query string.
  useEffect(() => {
    if (!activeKey) return;
    setTabs((prev) => {
      const existing = prev.find((t) => t.key === activeKey);
      let next: AppTab[];
      if (existing) {
        next = prev.map((t) => (t.key === activeKey ? { ...t, path: currentPath, label: activeKey === HOME_KEY ? "Home" : getPageName(location.pathname) } : t));
      } else {
        next = [...prev, { key: activeKey, path: currentPath, label: getPageName(location.pathname), openedAt: Date.now() }];
        if (next.length > MAX_TABS) {
          const oldest = next.filter((t) => t.key !== activeKey && t.key !== HOME_KEY).sort((a, b) => a.openedAt - b.openedAt)[0];
          if (oldest) next = next.filter((t) => t.key !== oldest.key);
        }
      }
      writeStored(next);
      return next;
    });
  }, [activeKey, currentPath, location.pathname]);

  // Restore scroll after flipping to a tab.
  useEffect(() => {
    if (pendingScroll.current == null) return;
    const y = pendingScroll.current;
    pendingScroll.current = null;
    let tries = 0;
    const tick = () => {
      window.scrollTo(0, y);
      if (Math.abs(window.scrollY - y) > 4 && tries++ < 20) setTimeout(tick, 100);
    };
    setTimeout(tick, 50);
  }, [location.key]);

  const rememberScroll = useCallback(() => {
    if (!activeKey) return;
    setTabs((prev) => {
      const next = prev.map((t) => (t.key === activeKey ? { ...t, scrollY: window.scrollY } : t));
      writeStored(next);
      return next;
    });
  }, [activeKey]);

  const activateTab = useCallback((key: string) => {
    if (key === activeKey) return;
    const tab = tabs.find((t) => t.key === key);
    rememberScroll();
    pendingScroll.current = tab?.scrollY ?? 0;
    navigate(tab?.path ?? key);
  }, [activeKey, tabs, navigate, rememberScroll]);

  const closeTab = useCallback((key: string) => {
    if (key === HOME_KEY) return;
    const idx = tabs.findIndex((t) => t.key === key);
    const next = tabs.filter((t) => t.key !== key);
    setTabs(next);
    writeStored(next);
    if (key === activeKey) {
      const fallback = next[Math.max(0, idx - 1)] ?? next[0];
      pendingScroll.current = fallback?.scrollY ?? 0;
      navigate(fallback ? fallback.path : "/");
    }
  }, [tabs, activeKey, navigate]);

  const closeOthers = useCallback((key: string) => {
    const keep = tabs.filter((t) => t.key === key || t.key === HOME_KEY);
    setTabs(keep);
    writeStored(keep);
  }, [tabs]);

  const closeAll = useCallback(() => {
    const keep = [tabs.find((t) => t.key === HOME_KEY) ?? home()];
    setTabs(keep);
    writeStored(keep);
    navigate("/");
  }, [tabs, navigate]);

  return { tabs, activeKey, activateTab, closeTab, closeOthers, closeAll };
}
