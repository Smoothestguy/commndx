import { useState, useEffect, useCallback } from "react";

/**
 * Hook to manage the portal switcher modal state and keyboard shortcut.
 * Opens with Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux).
 */
export function usePortalSwitcher() {
  const [isOpen, setIsOpen] = useState(false);

  const openSwitcher = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSwitcher = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleSwitcher = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Global keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;
      
      if (modifierKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        toggleSwitcher();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSwitcher]);

  return {
    isOpen,
    setIsOpen,
    openSwitcher,
    closeSwitcher,
    toggleSwitcher,
  };
}

