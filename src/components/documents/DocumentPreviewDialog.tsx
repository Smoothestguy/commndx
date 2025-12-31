import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import type { SystemDocument } from "@/integrations/supabase/hooks/useAllSystemDocuments";
import { DOCUMENT_SOURCE_LABELS } from "@/integrations/supabase/hooks/useAllSystemDocuments";
import { format } from "date-fns";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: SystemDocument | null;
  onDownload: (doc: SystemDocument) => void;
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
  onDownload,
}: DocumentPreviewDialogProps) {
  if (!document) return null;

  const isImage = document.file_type?.match(/^(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
    document.file_path?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
  const isPdf = document.file_type === "pdf" || 
    document.file_type === "application/pdf" ||
    document.file_path?.toLowerCase().endsWith(".pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span className="truncate">{document.file_name}</span>
            <div className="flex gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(document)}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(document.file_path, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {/* Document metadata */}
          <div className="mb-4 p-4 bg-muted rounded-lg text-sm space-y-1">
            <p><span className="font-medium">Type:</span> {DOCUMENT_SOURCE_LABELS[document.source_type]}</p>
            <p><span className="font-medium">Related to:</span> {document.related_entity_name || "N/A"}</p>
            <p><span className="font-medium">Uploaded:</span> {format(new Date(document.uploaded_at), "PPp")}</p>
            {document.uploader_name && (
              <p><span className="font-medium">By:</span> {document.uploader_name}</p>
            )}
            {document.file_size && (
              <p><span className="font-medium">Size:</span> {(document.file_size / 1024).toFixed(1)} KB</p>
            )}
          </div>

          {/* Preview content */}
          <div className="border rounded-lg overflow-hidden bg-muted/50 min-h-[300px] flex items-center justify-center">
            {isImage ? (
              <img
                src={document.file_path}
                alt={document.file_name}
                className="max-w-full max-h-[60vh] object-contain"
              />
            ) : isPdf ? (
              <iframe
                src={document.file_path}
                className="w-full h-[60vh]"
                title={document.file_name}
              />
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                <p className="mb-4">Preview not available for this file type</p>
                <Button onClick={() => onDownload(document)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download to View
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
