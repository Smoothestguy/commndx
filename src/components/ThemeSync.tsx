import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ThemeChoice = "light" | "dark" | "system";
const SET_AT_KEY = "commandx-theme-set-at";
const VALID = new Set<ThemeChoice>(["light", "dark", "system"]);

/**
 * Explicit theme choice: stored locally (instant, per device) and on the signed-in
 * user's account (follows them across domains/devices). Newest choice wins.
 */
export function useThemePreference() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const setPreference = useCallback((t: ThemeChoice) => {
    const at = new Date().toISOString();
    setTheme(t);
    try { localStorage.setItem(SET_AT_KEY, at); } catch { /* ignore */ }
    if (user) {
      supabase.auth.updateUser({ data: { theme: t, theme_set_at: at } })
        .catch((e) => console.warn("theme sync failed", e));
    }
  }, [setTheme, user]);
  return { theme: (theme as ThemeChoice) ?? "dark", resolvedTheme, setPreference };
}

/** On sign-in, adopt the account's saved theme only if it is newer than this device's choice. Never forces a default. */
export function ThemeSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!user || done.current === user.id) return;
    done.current = user.id;
    const meta = (user.user_metadata ?? {}) as { theme?: string; theme_set_at?: string };
    let localAt: string | null = null;
    try { localAt = localStorage.getItem(SET_AT_KEY); } catch { /* ignore */ }
    const remote = meta.theme as ThemeChoice | undefined;
    if (remote && VALID.has(remote) && meta.theme_set_at && (!localAt || meta.theme_set_at > localAt)) {
      setTheme(remote);
      try { localStorage.setItem(SET_AT_KEY, meta.theme_set_at); } catch { /* ignore */ }
    } else if (localAt) {
      // Device has the newer explicit choice — push it up so other devices/domains follow.
      let local: string | null = null;
      try { local = localStorage.getItem("commandx-theme"); } catch { /* ignore */ }
      if (local && VALID.has(local as ThemeChoice) && (local !== remote || meta.theme_set_at !== localAt)) {
        supabase.auth.updateUser({ data: { theme: local, theme_set_at: localAt } }).catch(() => {});
      }
    }
  }, [user, setTheme]);
  return null;
}
