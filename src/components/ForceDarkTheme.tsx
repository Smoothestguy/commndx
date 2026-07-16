import { useEffect } from "react";

/**
 * Forces `.dark` class on <html> while mounted (for public/brand-consistent pages).
 * Restores prior class on unmount. Does not touch next-themes storage.
 */
export function ForceDarkTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    const hadLight = root.classList.contains("light");
    root.classList.remove("light");
    root.classList.add("dark");
    return () => {
      if (!hadDark) root.classList.remove("dark");
      if (hadLight) root.classList.add("light");
    };
  }, []);
  return null;
}
