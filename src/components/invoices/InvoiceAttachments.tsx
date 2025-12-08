import { FileAttachmentUpload } from "@/components/shared/FileAttachmentUpload";
import {
  useInvoiceAttachments,
  useUploadInvoiceAttachment,
  useDeleteInvoiceAttachment,
} from "@/integrations/supabase/hooks/useInvoiceAttachments";

interface InvoiceAttachmentsProps {
  invoiceId: string;
}

export const InvoiceAttachments = ({ invoiceId }: InvoiceAttachmentsProps) => {
  const { data: attachments = [], isLoading } = useInvoiceAttachments(invoiceId);
  const uploadAttachment = useUploadInvoiceAttachment();
  const deleteAttachment = useDeleteInvoiceAttachment();

  const handleUpload = async (file: File, filePath: string) => {
    await uploadAttachment.mutateAsync({
      invoiceId,
      file,
      filePath,
    });
  };

  const handleDelete = async (attachmentId: string) => {
    await deleteAttachment.mutateAsync({
      attachmentId,
      invoiceId,
    });
  };

  return (
    <FileAttachmentUpload
      entityId={invoiceId}
      entityType="invoice"
      attachments={attachments}
      isLoading={isLoading}
      onUpload={handleUpload}
      onDelete={handleDelete}
    />
  );
};