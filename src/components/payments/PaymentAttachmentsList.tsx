import { useState } from "react";
import { Download, Trash2, FileText, Image, File, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { PaymentAttachment } from "@/integrations/supabase/hooks/usePaymentAttachments";

interface PaymentAttachmentsListProps {
  attachments: PaymentAttachment[];
  onDelete: (attachmentId: string, filePath: string) => void;
  isDeleting?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) {
    return <Image className="h-4 w-4 text-blue-500" />;
  }
  if (fileType === "application/pdf") {
    return <FileText className="h-4 w-4 text-red-500" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export function PaymentAttachmentsList({
  attachments,
  onDelete,
  isDeleting,
}: PaymentAttachmentsListProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);

  const handlePreview = async (attachment: PaymentAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("document-attachments")
        .createSignedUrl(attachment.file_path, 300);

      if (error) throw error;

      if (attachment.file_type.startsWith("image/")) {
        setPreviewType('image');
        setPreviewUrl(data.signedUrl);
      } else if (attachment.file_type === "application/pdf") {
        setPreviewType('pdf');
        setPreviewUrl(data.signedUrl);
      } else {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Preview error:", error);
      toast.error("Failed to preview file");
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewType(null);
  };

  const handleDownload = async (attachment: PaymentAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("document-attachments")
        .createSignedUrl(attachment.file_path, 60);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  if (attachments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No attachments uploaded.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30"
          >
            <div 
              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer hover:text-primary transition-colors"
              onClick={() => handlePreview(attachment)}
            >
              {getFileIcon(attachment.file_type)}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.file_size)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handlePreview(attachment)}
                title="Preview"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleDownload(attachment)}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Attachment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{attachment.file_name}". This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(attachment.id, attachment.file_path)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      {/* Image Preview Lightbox */}
      <ImageLightbox 
        imageUrl={previewType === 'image' ? previewUrl : null} 
        onClose={closePreview}
        alt="Attachment preview"
      />

      {/* PDF Preview Dialog */}
      <Dialog open={previewType === 'pdf' && !!previewUrl} onOpenChange={closePreview}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
          {previewUrl && (
            <iframe 
              src={previewUrl} 
              className="w-full h-[85vh] border-0" 
              title="PDF Preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}