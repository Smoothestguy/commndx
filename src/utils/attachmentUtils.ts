import { supabase } from "@/integrations/supabase/client";
import { PendingFile } from "@/components/shared/PendingAttachmentsUpload";

export type AttachmentEntityType = "invoice" | "estimate" | "vendor_bill" | "po_addendum";

interface FinalizeResult {
  success: boolean;
  error?: string;
}

/**
 * Moves pending attachments from temp storage to their final location
 * and creates database records for each attachment.
 */
export async function finalizeAttachments(
  pendingFiles: PendingFile[],
  entityId: string,
  entityType: AttachmentEntityType,
  userId: string
): Promise<FinalizeResult> {
  if (pendingFiles.length === 0) {
    return { success: true };
  }

  try {
    for (const pending of pendingFiles) {
      // Generate final path
      const fileExt = pending.file_name.split(".").pop();
      const finalPath = `${entityType}/${entityId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExt}`;

      // Copy file from temp to final location
      const { error: copyError } = await supabase.storage
        .from("document-attachments")
        .copy(pending.tempPath, finalPath);

      if (copyError) {
        console.error("Copy error:", copyError);
        throw new Error(`Failed to copy file: ${pending.file_name}`);
      }

      // Create database record based on entity type
      let dbError: any = null;

      if (entityType === "invoice") {
        const { error } = await supabase
          .from("invoice_attachments")
          .insert({
            invoice_id: entityId,
            file_name: pending.file_name,
            file_path: finalPath,
            file_type: pending.file_type,
            file_size: pending.file_size,
            uploaded_by: userId,
          });
        dbError = error;
      } else if (entityType === "estimate") {
        const { error } = await supabase
          .from("estimate_attachments")
          .insert({
            estimate_id: entityId,
            file_name: pending.file_name,
            file_path: finalPath,
            file_type: pending.file_type,
            file_size: pending.file_size,
            uploaded_by: userId,
          });
        dbError = error;
      } else if (entityType === "vendor_bill") {
        const { error } = await supabase
          .from("vendor_bill_attachments")
          .insert({
            bill_id: entityId,
            file_name: pending.file_name,
            file_path: finalPath,
            file_type: pending.file_type,
            file_size: pending.file_size,
            uploaded_by: userId,
          });
        dbError = error;
      } else if (entityType === "po_addendum") {
        const { error } = await supabase
          .from("po_addendum_attachments")
          .insert({
            addendum_id: entityId,
            file_name: pending.file_name,
            file_path: finalPath,
            file_type: pending.file_type,
            file_size: pending.file_size,
            uploaded_by: userId,
          });
        dbError = error;
      }

      if (dbError) {
        console.error("DB error:", dbError);
        throw new Error(`Failed to save attachment record: ${pending.file_name}`);
      }

      // Delete the temp file
      await supabase.storage
        .from("document-attachments")
        .remove([pending.tempPath]);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Finalize attachments error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Cleans up pending files from temp storage (used when form is cancelled)
 */
export async function cleanupPendingAttachments(
  pendingFiles: PendingFile[]
): Promise<void> {
  if (pendingFiles.length === 0) return;

  const paths = pendingFiles.map(f => f.tempPath);
  
  try {
    await supabase.storage
      .from("document-attachments")
      .remove(paths);
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}
