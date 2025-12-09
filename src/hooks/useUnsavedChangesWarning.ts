import { useEffect, useState, useCallback } from "react";

interface UseUnsavedChangesWarningOptions {
  hasUnsavedChanges: boolean;
  enabled?: boolean;
}

interface UseUnsavedChangesWarningReturn {
  showLeaveDialog: boolean;
  setShowLeaveDialog: (show: boolean) => void;
  confirmLeave: () => void;
  cancelLeave: () => void;
  handleCancelClick: () => boolean; // Returns true if should proceed with cancel
}

export function useUnsavedChangesWarning({
  hasUnsavedChanges,
  enabled = true,
}: UseUnsavedChangesWarningOptions): UseUnsavedChangesWarningReturn {
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Handle browser tab close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (enabled && hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ""; // Required for Chrome
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, enabled]);

  const confirmLeave = useCallback(() => {
    setShowLeaveDialog(false);
  }, []);

  const cancelLeave = useCallback(() => {
    setShowLeaveDialog(false);
  }, []);

  // Handle cancel button click - returns true if should proceed
  const handleCancelClick = useCallback(() => {
    if (enabled && hasUnsavedChanges) {
      setShowLeaveDialog(true);
      return false; // Don't proceed, show dialog instead
    }
    return true; // Proceed with navigation
  }, [enabled, hasUnsavedChanges]);

  return {
    showLeaveDialog,
    setShowLeaveDialog,
    confirmLeave,
    cancelLeave,
    handleCancelClick,
  };
}
