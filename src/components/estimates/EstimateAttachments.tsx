import { FileAttachmentUpload } from "@/components/shared/FileAttachmentUpload";
import {
  useEstimateAttachments,
  useUploadEstimateAttachment,
  useDeleteEstimateAttachment,
} from "@/integrations/supabase/hooks/useEstimateAttachments";

interface EstimateAttachmentsProps {
  estimateId: string;
}

export const EstimateAttachments = ({ estimateId }: EstimateAttachmentsProps) => {
  const { data: attachments = [], isLoading } = useEstimateAttachments(estimateId);
  const uploadAttachment = useUploadEstimateAttachment();
  const deleteAttachment = useDeleteEstimateAttachment();

  const handleUpload = async (file: File, filePath: string) => {
    await uploadAttachment.mutateAsync({
      estimateId,
      file,
      filePath,
    });
  };

  const handleDelete = async (attachmentId: string) => {
    await deleteAttachment.mutateAsync({
      attachmentId,
      estimateId,
    });
  };

  return (
    <FileAttachmentUpload
      entityId={estimateId}
      entityType="estimate"
      attachments={attachments}
      isLoading={isLoading}
      onUpload={handleUpload}
      onDelete={handleDelete}
    />
  );
};