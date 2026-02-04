import { FileAttachmentUpload } from "@/components/shared/FileAttachmentUpload";
import {
  useVendorBillAttachments,
  useUploadVendorBillAttachment,
  useDeleteVendorBillAttachment,
  useRetrySyncAttachment,
  syncAttachmentToQuickBooks,
} from "@/integrations/supabase/hooks/useVendorBillAttachments";
import { usePullBillAttachments } from "@/integrations/supabase/hooks/usePullBillAttachments";
import { toast } from "sonner";

interface VendorBillAttachmentsProps {
  billId: string;
}

export const VendorBillAttachments = ({ billId }: VendorBillAttachmentsProps) => {
  const { data: attachments = [], isLoading } = useVendorBillAttachments(billId);
  const uploadAttachment = useUploadVendorBillAttachment();
  const deleteAttachment = useDeleteVendorBillAttachment();
  const retrySyncMutation = useRetrySyncAttachment();
  const pullAttachmentsMutation = usePullBillAttachments();

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

  return (
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
    />
  );
};