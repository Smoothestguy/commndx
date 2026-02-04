import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileAttachmentUpload } from "@/components/shared/FileAttachmentUpload";
import {
  useVendorBillAttachments,
  useUploadVendorBillAttachment,
  useDeleteVendorBillAttachment,
  useRetrySyncAttachment,
} from "@/integrations/supabase/hooks/useVendorBillAttachments";
import { usePullBillAttachments } from "@/integrations/supabase/hooks/usePullBillAttachments";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2 } from "lucide-react";

interface VendorBillAttachmentsProps {
  billId: string;
  /** True only when the user is actively editing the bill. */
  isEditMode?: boolean;
  isFormDirty?: boolean;
  onSaveRequired?: () => Promise<void>;
}

export const VendorBillAttachments = ({ 
  billId, 
  isEditMode = false,
  isFormDirty = false,
  onSaveRequired 
}: VendorBillAttachmentsProps) => {
  const { data: attachments = [], isLoading } = useVendorBillAttachments(billId);
  const uploadAttachment = useUploadVendorBillAttachment();
  const deleteAttachment = useDeleteVendorBillAttachment();
  const retrySyncMutation = useRetrySyncAttachment();
  const pullAttachmentsMutation = usePullBillAttachments();

  // Query the bill's QB sync status to warn if not synced
  const { data: billMapping } = useQuery({
    queryKey: ["bill-qb-mapping", billId],
    queryFn: async () => {
      const { data } = await supabase
        .from("quickbooks_bill_mappings")
        .select("sync_status, quickbooks_bill_id")
        .eq("bill_id", billId)
        .maybeSingle();
      return data;
    },
    enabled: !!billId,
  });

  const isBillSyncedToQB = billMapping?.sync_status === "synced" && !!billMapping?.quickbooks_bill_id;

  // State for save-first dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ file: File; filePath: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleUpload = async (file: File, filePath: string) => {
    await uploadAttachment.mutateAsync({
      billId,
      file,
      filePath,
    });
  };

  const handleDelete = async (attachmentId: string) => {
    await deleteAttachment.mutateAsync({
      attachmentId,
      billId,
    });
  };

  const handleRetrySync = async (attachmentId: string) => {
    try {
      await retrySyncMutation.mutateAsync({ attachmentId, billId });
      toast.success("Synced to QuickBooks");
    } catch (error: any) {
      toast.error("Sync failed", { description: error.message });
    }
  };

  const handlePullFromQuickBooks = async () => {
    try {
      const result = await pullAttachmentsMutation.mutateAsync({ billId });
      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} attachment(s) from QuickBooks`);
      } else if (result.skipped > 0) {
        toast.info("All QuickBooks attachments already exist locally");
      } else {
        toast.info("No attachments found in QuickBooks");
      }
    } catch (error: any) {
      toast.error("Failed to pull attachments", { description: error.message });
    }
  };

  // Called before upload to check if save is required
  const handleBeforeUpload = async (file: File, filePath: string): Promise<boolean> => {
    // Hard block: uploads only allowed from edit mode
    if (!isEditMode) {
      toast.error("Press Edit to upload attachments", {
        description: "Attachments can only be added while editing the bill so they sync correctly.",
      });
      return false;
    }

    // Check if form has unsaved changes - require save first
    if (isFormDirty && onSaveRequired) {
      // Store the pending upload and show dialog
      setPendingUpload({ file, filePath });
      setShowSaveDialog(true);
      return false; // Don't proceed with upload yet
    }
    
    // Warn if bill isn't synced to QuickBooks yet (but allow upload)
    if (!isBillSyncedToQB) {
      toast.warning("Bill not synced to QuickBooks", {
        description: "The attachment will upload, but QB sync will happen after the bill is synced.",
      });
    }
    
    return true; // Proceed with upload
  };

  // Handle save & upload from dialog
  const handleSaveAndUpload = async () => {
    if (!pendingUpload || !onSaveRequired) return;
    
    setIsSaving(true);
    try {
      await onSaveRequired();
      // After save succeeds, proceed with upload
      await handleUpload(pendingUpload.file, pendingUpload.filePath);
      setShowSaveDialog(false);
      setPendingUpload(null);
    } catch (error: any) {
      toast.error("Failed to save bill", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSaveDialog = () => {
    setShowSaveDialog(false);
    setPendingUpload(null);
  };

  return (
    <>
      <FileAttachmentUpload
        entityId={billId}
        entityType="vendor_bill"
        attachments={attachments}
        isLoading={isLoading}
        onUpload={handleUpload}
        onDelete={handleDelete}
        onRetrySync={handleRetrySync}
        onPullFromQuickBooks={handlePullFromQuickBooks}
        isPulling={pullAttachmentsMutation.isPending}
        isRetrying={retrySyncMutation.isPending}
        onBeforeUpload={handleBeforeUpload}
        uploadDisabled={!isEditMode}
        uploadDisabledMessage="Press Edit to add attachments."
      />

      {/* Save Required Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes First</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this bill. Save the bill first to ensure 
              attachments sync correctly to QuickBooks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSaveDialog} disabled={isSaving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndUpload} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Upload"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};