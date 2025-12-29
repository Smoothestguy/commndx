import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, Trash2, Upload, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface PendingFile {
  id: string;
  file: File;
  tempPath: string;
  file_name: string;
  file_type: string;
  file_size: number;
}

interface PendingAttachmentsUploadProps {
  entityType: "invoice" | "estimate" | "vendor_bill" | "po_addendum";
  pendingFiles: PendingFile[];
  onFilesChange: (files: PendingFile[]) => void;
  compact?: boolean;
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

export const PendingAttachmentsUpload = ({
  entityType,
  pendingFiles,
  onFilesChange,
  compact = false,
}: PendingAttachmentsUploadProps) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    const newPendingFiles: PendingFile[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(`Invalid file type: ${file.name}. Skipping.`);
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          toast.error(`File too large: ${file.name}. Skipping.`);
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const tempPath = `pending/${user.id}/${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("document-attachments")
          .upload(tempPath, file);

        if (uploadError) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        newPendingFiles.push({
          id: crypto.randomUUID(),
          file,
          tempPath,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        });
      }

      if (newPendingFiles.length > 0) {
        onFilesChange([...pendingFiles, ...newPendingFiles]);
        toast.success(`${newPendingFiles.length} file(s) added`);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload files");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async (fileId: string) => {
    const fileToRemove = pendingFiles.find(f => f.id === fileId);
    if (!fileToRemove) return;

    try {
      // Delete from temp storage
      await supabase.storage
        .from("document-attachments")
        .remove([fileToRemove.tempPath]);

      onFilesChange(pendingFiles.filter(f => f.id !== fileId));
      toast.success("File removed");
    } catch (error: any) {
      console.error("Remove error:", error);
      toast.error("Failed to remove file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileChange(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
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

  const inputId = `pending-file-upload-${entityType}`;

  const content = (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
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
          id={inputId}
          disabled={uploading}
          multiple
        />
        <label
          htmlFor={inputId}
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
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

      {/* Pending Files List */}
      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          {pendingFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 border border-border rounded-lg bg-secondary/30"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.file_size)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(file.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          Attachments
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};
