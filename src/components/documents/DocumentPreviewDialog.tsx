import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2, Navigation } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { SystemDocument } from "@/integrations/supabase/hooks/useAllSystemDocuments";
import { DOCUMENT_SOURCE_LABELS } from "@/integrations/supabase/hooks/useAllSystemDocuments";
import { format } from "date-fns";
import { getSourceEntityRoute, getSourceEntityLabel } from "@/utils/documentSourceRoutes";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: SystemDocument | null;
  onDownload: (doc: SystemDocument) => void;
  previewUrl?: string | null;
  isLoadingUrl?: boolean;
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
  onDownload,
  previewUrl,
  isLoadingUrl,
}: DocumentPreviewDialogProps) {
  const navigate = useNavigate();

  if (!document) return null;

  const isImage = document.file_type?.match(/^(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
    document.file_path?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
  const isPdf = document.file_type === "pdf" || 
    document.file_type === "application/pdf" ||
    document.file_path?.toLowerCase().endsWith(".pdf");

  // Use previewUrl if provided, otherwise fall back to file_path
  const displayUrl = previewUrl || document.file_path;

  // Get navigation route for source entity
  const sourceRoute = getSourceEntityRoute(document.source_type, document.related_entity_id);
  const sourceLabel = getSourceEntityLabel(document.source_type);

  const handleGoToSource = () => {
    if (sourceRoute) {
      onOpenChange(false);
      navigate(sourceRoute);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span className="truncate">{document.file_name}</span>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              {sourceRoute && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGoToSource}
                >
                  <Navigation className="h-4 w-4 mr-1" />
                  Go to {sourceLabel}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(document)}
                disabled={isLoadingUrl}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => displayUrl && window.open(displayUrl, "_blank")}
                disabled={isLoadingUrl || !displayUrl}
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
            {isLoadingUrl ? (
              <div className="text-center p-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading preview...</p>
              </div>
            ) : isImage && displayUrl ? (
              <img
                src={displayUrl}
                alt={document.file_name}
                className="max-w-full max-h-[60vh] object-contain"
              />
            ) : isPdf && displayUrl ? (
              <iframe
                src={displayUrl}
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
