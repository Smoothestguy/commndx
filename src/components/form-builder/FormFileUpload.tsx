import { useRef, useState, useCallback, useEffect } from "react";
import { Upload, X, FileText, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface FormFileUploadProps {
  value?: File | string | null;
  onChange: (value: string | null) => void;
  onUploadStateChange?: (uploading: boolean) => void;
  label?: string;
  required?: boolean;
  helpText?: string;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in MB
  storageBucket?: string;
  storagePath?: string;
  disabled?: boolean;
}

export function FormFileUpload({
  value,
  onChange,
  onUploadStateChange,
  label,
  required,
  helpText,
  acceptedFileTypes = ["image/*", ".pdf", ".doc", ".docx"],
  maxFileSize = 5,
  storageBucket = "application-files",
  storagePath = "uploads",
  disabled = false,
}: FormFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  // Check if value is a URL string (already uploaded)
  const isUrlValue = typeof value === "string" && value.length > 0;

  // Notify parent of upload state changes
  useEffect(() => {
    onUploadStateChange?.(uploading);
  }, [uploading, onUploadStateChange]);

  const validateFile = useCallback((file: File): string | null => {
    console.log("[FormFileUpload] Validating file:", file.name, "Size:", file.size, "Type:", file.type);
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File exceeds ${maxFileSize}MB limit`;
    }
    return null;
  }, [maxFileSize]);

  const uploadFile = async (file: File): Promise<string | null> => {
    console.log("[FormFileUpload] Starting upload to bucket:", storageBucket);
    try {
      const fileExt = file.name.split(".").pop();
      const uniqueFileName = `${storagePath}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      console.log("[FormFileUpload] Uploading file as:", uniqueFileName);

      const { error: uploadError, data } = await supabase.storage
        .from(storageBucket)
        .upload(uniqueFileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("[FormFileUpload] Upload error:", uploadError);
        throw uploadError;
      }

      console.log("[FormFileUpload] Upload successful, data:", data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(storageBucket)
        .getPublicUrl(uniqueFileName);

      console.log("[FormFileUpload] Public URL generated:", publicUrl);
      return publicUrl;
    } catch (err) {
      console.error("[FormFileUpload] Failed to upload file:", err);
      return null;
    }
  };

  const processFile = useCallback(async (file: File) => {
    console.log("[FormFileUpload] Processing file:", file.name);
    setError(null);
    setUploadSuccess(false);
    
    const validationError = validateFile(file);
    if (validationError) {
      console.error("[FormFileUpload] Validation failed:", validationError);
      setError(validationError);
      return;
    }

    // Store file info for display
    setFileName(file.name);
    setFileSize(file.size);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      console.log("[FormFileUpload] Image preview created");
    } else {
      setPreview(null);
    }

    // Upload immediately
    setUploading(true);
    console.log("[FormFileUpload] Starting upload...");
    const publicUrl = await uploadFile(file);
    setUploading(false);

    if (publicUrl) {
      console.log("[FormFileUpload] Upload complete, calling onChange with URL:", publicUrl);
      setUploadSuccess(true);
      onChange(publicUrl);
    } else {
      console.error("[FormFileUpload] Upload failed - no URL returned");
      setError("Failed to upload file. Please try again.");
      setFileName(null);
      setFileSize(null);
      setPreview(null);
      onChange(null);
    }
  }, [validateFile, onChange, storageBucket, storagePath]);

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
    setFileName(null);
    setFileSize(null);
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
    if (preview || (isUrlValue && value?.match(/\.(jpg|jpeg|png|gif|webp)$/i))) {
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    }
    return <FileText className="h-4 w-4 text-orange-500" />;
  };

  // Determine display name
  const displayName = fileName || (isUrlValue ? value.split("/").pop() : null);
  const hasFile = isUrlValue || fileName;

  // Determine preview URL
  const displayPreview = preview || (isUrlValue && value?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? value : null);

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

      {hasFile ? (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center gap-3">
            {displayPreview ? (
              <img
                src={displayPreview}
                alt="Preview"
                className="h-12 w-12 object-cover rounded"
              />
            ) : (
              <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                {getFileIcon()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              {fileSize && <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>}
              {uploading && (
                <div className="flex items-center gap-1 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Uploading...
                </div>
              )}
              {(isUrlValue || uploadSuccess) && !uploading && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Uploaded successfully
                </div>
              )}
              {error && !uploading && (
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </div>
              )}
            </div>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={removeFile}
                disabled={uploading}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={disabled ? undefined : handleClick}
          onDrop={disabled ? undefined : handleDrop}
          onDragOver={disabled ? undefined : handleDragOver}
          onDragLeave={disabled ? undefined : handleDragLeave}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
            disabled 
              ? "bg-muted/50 border-muted-foreground/15 cursor-not-allowed opacity-70"
              : dragOver
                ? "border-primary bg-primary/5 cursor-pointer"
                : "bg-muted/30 hover:bg-muted/50 border-muted-foreground/25 cursor-pointer"
          )}
        >
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {disabled ? "File upload disabled" : "Click to upload or drag and drop"}
          </p>
          {!disabled && acceptedFileTypes && (
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
