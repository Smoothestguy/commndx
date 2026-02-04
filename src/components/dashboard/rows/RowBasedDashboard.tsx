import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { WelcomeStrip } from "./WelcomeStrip";
import { KPIBar } from "./KPIBar";
import { QuickActionsRow } from "./QuickActionsRow";
import { RevenueChartRow } from "./RevenueChartRow";
import { RecentInvoicesTable } from "./RecentInvoicesTable";
import { RecentActivityTable } from "./RecentActivityTable";
import { InvoiceAgingSummary } from "./InvoiceAgingSummary";

import { MobileSessionCard } from "@/components/session/MobileSessionCard";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { useDashboardDraft } from "@/contexts/DashboardDraftContext";
import { usePageHeaderActions } from "@/contexts/PageHeaderActionsContext";
import { EditModeToggle } from "../customization/EditModeToggle";
import { DashboardThemeEditor } from "../customization/DashboardThemeEditor";
import { UnsavedChangesDialog } from "../customization/UnsavedChangesDialog";
import { DashboardTheme } from "../widgets/types";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function RowBasedDashboard() {
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const {
    activeTheme,
    updateConfigAsync,
    isUpdating,
    resetToDefault,
    hasCustomConfig,
    isLoading: configLoading,
  } = useDashboardConfig();

  const [isEditMode, setIsEditMode] = useState(false);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [draftTheme, setDraftTheme] = useState<DashboardTheme | null>(null);

  const canCustomize = isAdmin || isManager;
  const draftContext = useDashboardDraft();

  // Get page header actions context - may not be available during SSR/initial render
  let pageHeaderActions: ReturnType<typeof usePageHeaderActions> | null = null;
  try {
    pageHeaderActions = usePageHeaderActions();
  } catch {
    // Context not available, will render inline
  }

  // Track previous edit mode state to detect transitions
  const prevIsEditModeRef = useRef(isEditMode);
  const hasInitializedRef = useRef(false);

  // Initialize and sync draft theme
  useEffect(() => {
    if (configLoading) return;

    const wasEditMode = prevIsEditModeRef.current;
    prevIsEditModeRef.current = isEditMode;

    // Initialize on first successful load
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setDraftTheme(activeTheme);
      return;
    }

    // Sync when ENTERING edit mode
    if (isEditMode && !wasEditMode) {
      setDraftTheme(activeTheme);
    }

    // Keep draft in sync when NOT in edit mode
    if (!isEditMode) {
      setDraftTheme(activeTheme);
    }
  }, [configLoading, isEditMode, activeTheme]);

  // Sync draft state to context so BackgroundMediaLayer can access it
  useEffect(() => {
    if (draftContext) {
      draftContext.setDraftTheme(draftTheme);
      draftContext.setIsEditMode(isEditMode);
    }
  }, [draftTheme, isEditMode, draftContext]);

  const hasUnsavedChanges = useMemo(() => {
    if (!isEditMode) return false;
    return JSON.stringify(draftTheme) !== JSON.stringify(activeTheme);
  }, [isEditMode, draftTheme, activeTheme]);

  // Theme change handler
  const handleThemeChange = useCallback((theme: DashboardTheme) => {
    setDraftTheme(theme);
  }, []);

  // Save changes to database
  const handleSave = useCallback(async () => {
    if (!draftTheme) return;
    try {
      await updateConfigAsync({ theme: draftTheme });
      toast.success("Dashboard saved");
    } catch (error) {
      // Error toast is handled in the hook
    }
  }, [draftTheme, updateConfigAsync]);

  // Revert to saved state
  const handleRevert = useCallback(() => {
    setDraftTheme(activeTheme);
    toast.info("Changes reverted");
  }, [activeTheme]);

  // Handle exit edit mode
  const handleExitEditMode = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      setIsEditMode(false);
      setShowThemeEditor(false);
    }
  }, [hasUnsavedChanges]);

  // Save and exit
  const handleSaveAndExit = useCallback(async () => {
    if (!draftTheme) return;
    try {
      await updateConfigAsync({ theme: draftTheme });
      toast.success("Dashboard saved");
    } catch (error) {
      // Error toast is handled in the hook
    }
    setShowUnsavedDialog(false);
    setIsEditMode(false);
    setShowThemeEditor(false);
  }, [draftTheme, updateConfigAsync]);

  // Discard and exit
  const handleDiscardAndExit = useCallback(() => {
    setDraftTheme(activeTheme);
    setShowUnsavedDialog(false);
    setIsEditMode(false);
    setShowThemeEditor(false);
  }, [activeTheme]);

  const handleReset = useCallback(() => {
    resetToDefault();
    setShowResetConfirm(false);
    setIsEditMode(false);
    setShowThemeEditor(false);
  }, [resetToDefault]);

  // Store handlers in ref to avoid useEffect dependency issues
  const handlersRef = useRef({
    handleExitEditMode,
    handleSave,
    handleRevert,
  });
  
  useEffect(() => {
    handlersRef.current = {
      handleExitEditMode,
      handleSave,
      handleRevert,
    };
  });

  // Register the EditModeToggle in the page header
  useEffect(() => {
    if (!pageHeaderActions || !canCustomize) return;

    pageHeaderActions.setRightActions(
      <EditModeToggle
        isEditMode={isEditMode}
        onToggle={isEditMode ? () => handlersRef.current.handleExitEditMode() : () => setIsEditMode(true)}
        onSave={() => handlersRef.current.handleSave()}
        onRevert={() => handlersRef.current.handleRevert()}
        onReset={() => setShowResetConfirm(true)}
        hasCustomConfig={hasCustomConfig}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isUpdating}
      />
    );

    return () => {
      pageHeaderActions.setRightActions(null);
    };
  }, [
    pageHeaderActions,
    canCustomize,
    isEditMode,
    hasCustomConfig,
    hasUnsavedChanges,
    isUpdating,
  ]);

  return (
    <>
      <div className="space-y-4 p-4 lg:p-6">
        {/* Mobile Session Clock - prominent on mobile */}
        <MobileSessionCard />

        {/* Edit Mode Toolbar */}
        {isEditMode && (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-dashed border-primary/30">
            <span className="text-sm text-muted-foreground">Edit Mode</span>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowThemeEditor(true)}
              className="gap-2"
            >
              <Palette className="h-4 w-4" />
              Theme
            </Button>
          </div>
        )}

        {/* Row 1: Welcome Strip */}
        <WelcomeStrip />

        {/* Row 2: KPI Bar */}
        <KPIBar />

        {/* Row 3: Quick Actions */}
        <QuickActionsRow />

        {/* Row 4: Tables Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RecentInvoicesTable />
          <RecentActivityTable />
        </div>

        {/* Row 5: Revenue Chart */}
        <RevenueChartRow />

        {/* Row 6: Invoice Aging Summary */}
        <InvoiceAgingSummary />
      </div>

      {/* Theme Editor Sidebar */}
      {draftTheme && (
        <DashboardThemeEditor
          theme={draftTheme}
          onChange={handleThemeChange}
          isOpen={showThemeEditor}
          onClose={() => setShowThemeEditor(false)}
        />
      )}

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onSaveAndExit={handleSaveAndExit}
        onDiscardAndExit={handleDiscardAndExit}
        onClose={() => setShowUnsavedDialog(false)}
        isSaving={isUpdating}
      />

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all your customizations and restore the default
              dashboard settings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Reset to Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
