import { useEffect, useState, useCallback } from "react";
import { useBlocker } from "react-router-dom";

interface UseUnsavedChangesWarningOptions {
  hasUnsavedChanges: boolean;
  enabled?: boolean;
}

interface UseUnsavedChangesWarningReturn {
  showLeaveDialog: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  handleCancelClick: () => boolean; // Returns true if should proceed with cancel
}

export function useUnsavedChangesWarning({
  hasUnsavedChanges,
  enabled = true,
}: UseUnsavedChangesWarningOptions): UseUnsavedChangesWarningReturn {
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingCancelAction, setPendingCancelAction] = useState(false);

  // Block in-app navigation when there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      enabled && hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  // Show dialog when blocker is triggered
  useEffect(() => {
    if (blocker.state === "blocked") {
      setShowLeaveDialog(true);
    }
  }, [blocker.state]);

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
    setPendingCancelAction(false);
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  }, [blocker]);

  const cancelLeave = useCallback(() => {
    setShowLeaveDialog(false);
    setPendingCancelAction(false);
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }, [blocker]);

  // Handle cancel button click - returns true if should proceed
  const handleCancelClick = useCallback(() => {
    if (enabled && hasUnsavedChanges) {
      setShowLeaveDialog(true);
      setPendingCancelAction(true);
      return false; // Don't proceed, show dialog instead
    }
    return true; // Proceed with navigation
  }, [enabled, hasUnsavedChanges]);

  return {
    showLeaveDialog,
    confirmLeave,
    cancelLeave,
    handleCancelClick,
  };
}
