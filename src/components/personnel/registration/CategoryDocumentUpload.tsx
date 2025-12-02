import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, FileText, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { RegistrationDocument } from "@/integrations/supabase/hooks/usePersonnelRegistrations";

interface CategoryDocumentUploadProps {
  documentType: RegistrationDocument["document_type"];
  label: string;
  helperText?: string;
  required?: boolean;
  existingDocument?: RegistrationDocument;
  onUpload: (doc: RegistrationDocument) => void;
  onRemove: () => void;
  sessionId: string;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const CategoryDocumentUpload = ({
  documentType,
  label,
  helperText,
  required,
  existingDocument,
  onUpload,
  onRemove,
  sessionId,
}: CategoryDocumentUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const uploadFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Invalid file type. Please upload JPG, PNG, WebP, or PDF.");
      return null;
    }

    if (file.size > MAX_SIZE) {
      toast.error("File too large. Maximum size is 10MB.");
      return null;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${sessionId}/${documentType}-${Date.now()}.${fileExt}`;
    const filePath = `pending/${fileName}`;

    const { error } = await supabase.storage
      .from("personnel-documents")
      .upload(filePath, file);

    if (error) {
      toast.error(`Failed to upload ${file.name}`);
      console.error("Upload error:", error);
      return null;
    }

    return {
      name: file.name,
      path: filePath,
      type: file.type,
      uploaded_at: new Date().toISOString(),
      document_type: documentType,
      label: label,
    } as RegistrationDocument;
  };

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);

      const result = await uploadFile(file);
      if (result) {
        onUpload(result);
        toast.success(`${label} uploaded successfully`);
      }

      setUploading(false);
    },
    [documentType, label, onUpload, sessionId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleRemove = async () => {
    if (existingDocument) {
      await supabase.storage
        .from("personnel-documents")
        .remove([existingDocument.path]);
      onRemove();
      toast.success("Document removed");
    }
  };

  if (existingDocument) {
    return (
      <Card className="border-success/50 bg-success/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {existingDocument.name}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragActive(false);
      }}
      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
        dragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      }`}
    >
      {uploading ? (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Uploading...</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">
              {label} {required && <span className="text-destructive">*</span>}
            </span>
          </div>
          {helperText && (
            <p className="text-xs text-muted-foreground">{helperText}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ALLOWED_TYPES.join(",");
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            Select File
          </Button>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WebP, or PDF (max 10MB)
          </p>
        </div>
      )}
    </div>
  );
};