import { FileAttachmentUpload } from "@/components/shared/FileAttachmentUpload";
import {
  useVendorBillAttachments,
  useUploadVendorBillAttachment,
  useDeleteVendorBillAttachment,
} from "@/integrations/supabase/hooks/useVendorBillAttachments";

interface VendorBillAttachmentsProps {
  billId: string;
}

export const VendorBillAttachments = ({ billId }: VendorBillAttachmentsProps) => {
  const { data: attachments = [], isLoading } = useVendorBillAttachments(billId);
  const uploadAttachment = useUploadVendorBillAttachment();
  const deleteAttachment = useDeleteVendorBillAttachment();

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

  return (
    <FileAttachmentUpload
      entityId={billId}
      entityType="vendor_bill"
      attachments={attachments}
      isLoading={isLoading}
      onUpload={handleUpload}
      onDelete={handleDelete}
    />
  );
};