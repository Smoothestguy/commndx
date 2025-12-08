import React, { useState, useCallback } from "react";
import { Upload, X, FileText, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface UploadedFile {
  file: File;
  preview?: string;
  name: string;
  size: number;
  type: string;
}

interface FileUploadZoneProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  label?: string;
  required?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ALLOWED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.doc,.docx";

export function FileUploadZone({
  files,
  onFilesChange,
  label = "Upload Files",
  required = false,
  maxFiles = 10,
  maxSizeMB = 20,
}: FileUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File "${file.name}" exceeds ${maxSizeMB}MB limit`;
    }
    
    const isAllowedType = ALLOWED_TYPES.includes(file.type) || 
      file.name.toLowerCase().endsWith('.heic') || 
      file.name.toLowerCase().endsWith('.heif');
    
    if (!isAllowedType) {
      return `File "${file.name}" has unsupported format`;
    }
    
    return null;
  }, [maxSizeMB]);

  const processFiles = useCallback((newFiles: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(newFiles);
    
    if (files.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validFiles: UploadedFile[] = [];
    
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      const uploadedFile: UploadedFile = {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      };

      // Create preview for images
      if (file.type.startsWith("image/")) {
        uploadedFile.preview = URL.createObjectURL(file);
      }

      validFiles.push(uploadedFile);
    }

    onFilesChange([...files, ...validFiles]);
  }, [files, maxFiles, validateFile, onFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  const removeFile = useCallback((index: number) => {
    const file = files[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  }, [files, onFilesChange]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
          "hover:border-primary/50 hover:bg-muted/50",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        )}
      >
        <input
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS}
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <Upload className={cn(
            "h-10 w-10",
            dragOver ? "text-primary" : "text-muted-foreground"
          )} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Drag & drop files here
            </p>
            <p className="text-xs text-muted-foreground">
              or click to browse
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            PDF, JPG, PNG, HEIC, DOC • Max {maxSizeMB}MB each • Up to {maxFiles} files
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              {/* Preview or icon */}
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-10 h-10 rounded object-cover"
                />
              ) : file.type.includes("pdf") ? (
                <div className="w-10 h-10 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                  <Image className="h-5 w-5 text-muted-foreground" />
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>

              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeFile(index)}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
