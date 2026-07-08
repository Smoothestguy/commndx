import { useRef, useState, useCallback, useEffect } from "react";
import { Upload, X, FileText, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FormFileUploadProps {
  value?: File | string | null;
  onChange: (value: string | null) => void;
  onUploadStateChange?: (uploading: boolean) => void;
  /** Called with a short reason string ("photo_upload_failed: <detail>") whenever an upload fails. */
  onUploadError?: (reason: string) => void;
  label?: string;
  required?: boolean;
  helpText?: string;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in MB
  storageBucket?: string;
  storagePath?: string;
  disabled?: boolean;
}

// Client-side upload timeout — beyond this, treat as hung and prompt retry.
const UPLOAD_TIMEOUT_MS = 45_000;

// Detect HEIC/HEIF by MIME or file extension. Most browsers can't render or
// upload/convert these; we reject early with a clear message so users on iPhone
// don't hit a silent failure.
function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

export function FormFileUpload({
  value,
  onChange,
  onUploadStateChange,
  onUploadError,
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
  // Hold the last file so the user can retry without re-picking.
  const lastFileRef = useRef<File | null>(null);

  // Check if value is a URL string (already uploaded)
  const isUrlValue = typeof value === "string" && value.length > 0;

  // Notify parent of upload state changes. Hold callbacks in refs so effects
  // don't fire from parent re-renders that pass new arrow functions.
  const cbRef = useRef(onUploadStateChange);
  useEffect(() => { cbRef.current = onUploadStateChange; });
  useEffect(() => { cbRef.current?.(uploading); }, [uploading]);

  const errorCbRef = useRef(onUploadError);
  useEffect(() => { errorCbRef.current = onUploadError; });

  const reportError = useCallback((userMessage: string, logReason: string) => {
    setError(userMessage);
    setUploadSuccess(false);
    // Loud, unavoidable feedback so the user cannot silently proceed.
    toast.error("Photo upload failed", { description: userMessage });
    errorCbRef.current?.(`photo_upload_failed: ${logReason}`);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File exceeds ${maxFileSize}MB limit`;
    }
    return null;
  }, [maxFileSize]);

  const uploadFile = async (file: File): Promise<{ url: string | null; error?: string }> => {
    const fileExt = file.name.split(".").pop();
    const uniqueFileName = `${storagePath}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Race the upload against a hard client timeout so a hung mobile network
    // doesn't leave the form spinning forever.
    const uploadPromise = supabase.storage
      .from(storageBucket)
      .upload(uniqueFileName, file, { cacheControl: "3600", upsert: false });

    const timeoutPromise = new Promise<{ error: { message: string } }>((resolve) => {
      setTimeout(
        () => resolve({ error: { message: `upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s` } }),
        UPLOAD_TIMEOUT_MS,
      );
    });

    try {
      const result = (await Promise.race([uploadPromise, timeoutPromise])) as any;
      if (result?.error) {
        return { url: null, error: result.error.message || "storage upload failed" };
      }
      const { data: { publicUrl } } = supabase.storage.from(storageBucket).getPublicUrl(uniqueFileName);
      return { url: publicUrl };
    } catch (err: any) {
      return { url: null, error: err?.message || "unknown storage error" };
    }
  };

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setUploadSuccess(false);
    lastFileRef.current = file;

    // Reject HEIC/HEIF up front — Safari/iOS Photos exports these by default
    // and most browsers can't render them, so they'd upload but never display.
    if (isHeic(file)) {
      const msg = "iPhone HEIC photos aren't supported. In Camera settings, choose 'Most Compatible', or save as JPG/PNG and try again.";
      reportError(msg, "heic_not_supported");
      setFileName(null);
      setFileSize(null);
      setPreview(null);
      onChange(null);
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      reportError(validationError, `validation:${validationError}`);
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }

    setUploading(true);
    const { url, error: uploadErr } = await uploadFile(file);
    setUploading(false);

    if (url) {
      setUploadSuccess(true);
      onChange(url);
    } else {
      const reason = uploadErr || "unknown";
      reportError(
        `Upload failed: ${reason}. Tap Retry below or pick a different photo.`,
        reason,
      );
      onChange(null);
      // Keep fileName/preview so the retry button stays visible with context.
    }
  }, [validateFile, onChange, storageBucket, storagePath, reportError]);

  const retryUpload = useCallback(() => {
    if (lastFileRef.current) {
      processFile(lastFileRef.current);
    } else {
      inputRef.current?.click();
    }
  }, [processFile]);

  const handleClick = () => inputRef.current?.click();

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };

  const removeFile = () => {
    if (preview) { URL.revokeObjectURL(preview); setPreview(null); }
    setFileName(null);
    setFileSize(null);
    setError(null);
    setUploadSuccess(false);
    lastFileRef.current = null;
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
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

  const displayName = fileName || (isUrlValue ? value.split("/").pop() : null);
  const hasFile = isUrlValue || fileName;
  const displayPreview = preview || (isUrlValue && value?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? value : null);
  const showRetry = !!error && !uploading;

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
        <div
          className={cn(
            "border rounded-lg p-3",
            error ? "bg-destructive/5 border-destructive/40" : "bg-muted/30",
          )}
        >
          <div className="flex items-center gap-3">
            {displayPreview ? (
              <img src={displayPreview} alt="Preview" className="h-12 w-12 object-cover rounded" />
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
              {(isUrlValue || uploadSuccess) && !uploading && !error && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Uploaded successfully
                </div>
              )}
              {error && !uploading && (
                <div className="flex items-start gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="break-words">{error}</span>
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
                aria-label="Remove file"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
          {showRetry && !disabled && (
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={retryUpload}
                className="h-8"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry upload
              </Button>
            </div>
          )}
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
                : "bg-muted/30 hover:bg-muted/50 border-muted-foreground/25 cursor-pointer",
          )}
        >
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {disabled ? "File upload disabled" : "Click to upload or drag and drop"}
          </p>
          {!disabled && acceptedFileTypes && (
            <p className="text-xs text-muted-foreground mt-1">Max {maxFileSize}MB • JPG or PNG (no HEIC)</p>
          )}
        </div>
      )}

      {helpText && !error && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
