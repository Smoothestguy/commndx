import { useRef, useState, useCallback } from "react";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FormFileUploadProps {
  value?: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  required?: boolean;
  helpText?: string;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in MB
}

export function FormFileUpload({
  value,
  onChange,
  label,
  required,
  helpText,
  acceptedFileTypes = ["image/*", ".pdf", ".doc", ".docx"],
  maxFileSize = 5,
}: FormFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File exceeds ${maxFileSize}MB limit`;
    }
    return null;
  }, [maxFileSize]);

  const processFile = useCallback((file: File) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }

    onChange(file);
  }, [validateFile, onChange]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeFile = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = () => {
    if (!value) return null;
    if (value.type.startsWith("image/")) {
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    }
    return <FileText className="h-4 w-4 text-orange-500" />;
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={acceptedFileTypes.join(",")}
        onChange={handleFileInput}
      />

      {value ? (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center gap-3">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="h-12 w-12 object-cover rounded"
              />
            ) : (
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                {getFileIcon()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{value.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(value.size)}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={removeFile}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "bg-muted/30 hover:bg-muted/50 border-muted-foreground/25"
          )}
        >
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Click to upload or drag and drop
          </p>
          {acceptedFileTypes && (
            <p className="text-xs text-muted-foreground mt-1">
              Max {maxFileSize}MB
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {helpText && !error && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
