import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, Trash2, Upload, Download, Paperclip, X, RefreshCw, CloudDownload, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface FileAttachmentUploadProps {
  entityId: string;
  entityType: "invoice" | "estimate" | "vendor_bill";
  attachments: Attachment[];
  isLoading: boolean;
  onUpload: (file: File, filePath: string) => Promise<void>;
  onDelete: (attachmentId: string, filePath: string) => Promise<void>;
  onRetrySync?: (attachmentId: string) => Promise<void>;
  onPullFromQuickBooks?: () => Promise<void>;
  isPulling?: boolean;
  isRetrying?: boolean;
  /** Called before upload starts. Return false to abort upload. */
  onBeforeUpload?: (file: File, filePath: string) => Promise<boolean>;
  /** If true, disables all upload interactions and shows an info panel instead. */
  uploadDisabled?: boolean;
  /** Optional message shown when uploads are disabled. */
  uploadDisabledMessage?: string;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileAttachmentUpload = ({
  entityId,
  entityType,
  attachments,
  isLoading,
  onUpload,
  onDelete,
  onRetrySync,
  onPullFromQuickBooks,
  isPulling = false,
  isRetrying = false,
  onBeforeUpload,
  uploadDisabled = false,
  uploadDisabledMessage,
}: FileAttachmentUploadProps) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;

    const file = files[0];

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Invalid file type. Please upload PDF, images, or Word documents.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size exceeds 10MB limit.");
      return;
    }

    const fileExt = file.name.split(".").pop();
    const filePath = `${entityType}/${entityId}/${Date.now()}.${fileExt}`;

    // Check if we need to save first (for dirty forms)
    if (onBeforeUpload) {
      const shouldProceed = await onBeforeUpload(file, filePath);
      if (!shouldProceed) {
        // Upload was intercepted (e.g., save dialog shown)
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
    }

    setUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      await onUpload(file, filePath);
      toast.success("File uploaded successfully");
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm("Are you sure you want to delete this attachment?")) return;

    setDeleting(attachment.id);
    try {
      const { error: storageError } = await supabase.storage
        .from("document-attachments")
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      await onDelete(attachment.id, attachment.file_path);
      toast.success("Attachment deleted");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete attachment");
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("document-attachments")
        .createSignedUrl(attachment.file_path, 60);

      if (error) throw error;

      // Fetch as blob and trigger download instead of opening in new tab
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("Failed to fetch file");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("document-attachments")
        .createSignedUrl(attachment.file_path, 300);
      if (error) throw error;

      const ext = attachment.file_name.split(".").pop()?.toLowerCase();
      const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"];
      if (imageExts.includes(ext || "") || attachment.file_type?.startsWith("image/")) {
        setPreviewType('image');
        setPreviewUrl(data.signedUrl);
      } else if (ext === "pdf" || attachment.file_type === "application/pdf") {
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (uploadDisabled) return;
    handleFileChange(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploadDisabled) return;
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (uploadDisabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const timestamp = Date.now();
          const extension = item.type.split('/')[1] || 'png';
          const namedFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
            type: file.type,
          });
          imageFiles.push(namedFile);
        }
      }
    }

    if (imageFiles.length > 0) {
      const dataTransfer = new DataTransfer();
      imageFiles.forEach(file => dataTransfer.items.add(file));
      handleFileChange(dataTransfer.files);
    }
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          Attachments
        </CardTitle>
        {entityType === "vendor_bill" && onPullFromQuickBooks && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPullFromQuickBooks}
            disabled={isPulling}
          >
            {isPulling ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CloudDownload className="h-4 w-4 mr-2" />
            )}
            Import from QB
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        {uploadDisabled ? (
          <div className="border-2 border-dashed rounded-lg p-6 text-center bg-secondary/20">
            <X className="h-8 w-8 text-muted-foreground mx-auto" />
            <div className="mt-2">
              <p className="text-sm font-medium">Uploads disabled</p>
              <p className="text-xs text-muted-foreground mt-1">
                {uploadDisabledMessage || "Open this record in edit mode to add attachments."}
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onPaste={handlePaste}
            tabIndex={0}
          >
            <Input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleFileChange(e.target.files)}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              className="hidden"
              id={`file-upload-${entityId}`}
              disabled={uploading}
            />
            <label
              htmlFor={`file-upload-${entityId}`}
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {uploading ? "Uploading..." : "Click to upload, drag and drop, or paste"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, images, or Word docs (max 10MB) · Cmd+V to paste
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Attachments List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg bg-secondary/30"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{attachment.file_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(attachment.file_size)}</span>
                      <span>•</span>
                      <span>{format(new Date(attachment.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePreview(attachment)}
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(attachment)}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {entityType === "vendor_bill" && onRetrySync && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        setRetrying(attachment.id);
                        try {
                          await onRetrySync(attachment.id);
                        } finally {
                          setRetrying(null);
                        }
                      }}
                      disabled={retrying === attachment.id}
                      title="Retry QuickBooks Sync"
                    >
                      {retrying === attachment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(attachment)}
                    disabled={deleting === attachment.id}
                    title="Delete"
                  >
                    {deleting === attachment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4 text-sm">
            No attachments yet
          </p>
        )}
      </CardContent>
    </Card>

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
};