import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X, FileImage, Loader2 } from "lucide-react";

interface ReceiptUploadProps {
  personnelId: string;
  onUpload: (url: string) => void;
  existingUrl?: string | null;
}

export function ReceiptUpload({ personnelId, onUpload, existingUrl }: ReceiptUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP) or PDF.");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File is too large. Maximum size is 5MB.");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const timestamp = Date.now();
      const filePath = `reimbursement-receipts/${personnelId}/${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("document-attachments")
        .getPublicUrl(filePath);

      setPreviewUrl(publicUrl);
      onUpload(publicUrl);
      toast.success("Receipt uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload receipt");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClear = () => {
    setPreviewUrl(null);
    onUpload("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isImage = previewUrl && !previewUrl.endsWith(".pdf");

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {previewUrl ? (
        <div className="relative">
          {isImage ? (
            <div className="relative w-full h-32 rounded-lg overflow-hidden border bg-muted">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted">
              <FileImage className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate flex-1">
                PDF Receipt
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-24 border-dashed"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Uploading...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click to upload receipt (Max 5MB)
              </span>
            </div>
          )}
        </Button>
      )}
    </div>
  );
}
