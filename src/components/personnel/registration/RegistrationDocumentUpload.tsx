import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { RegistrationDocument } from "@/integrations/supabase/hooks/usePersonnelRegistrations";

interface RegistrationDocumentUploadProps {
  documents: RegistrationDocument[];
  onChange: (documents: RegistrationDocument[]) => void;
  sessionId: string;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const RegistrationDocumentUpload = ({
  documents,
  onChange,
  sessionId,
}: RegistrationDocumentUploadProps) => {
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
    const fileName = `${sessionId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
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
    } as RegistrationDocument;
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);

      const fileArray = Array.from(files);
      const uploadPromises = fileArray.map((file) => uploadFile(file));
      const results = await Promise.all(uploadPromises);

      const successfulUploads = results.filter(
        (r): r is RegistrationDocument => r !== null
      );

      if (successfulUploads.length > 0) {
        onChange([...documents, ...successfulUploads]);
        toast.success(
          `${successfulUploads.length} document(s) uploaded successfully`
        );
      }

      setUploading(false);
    },
    [documents, onChange, sessionId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const removeDocument = async (index: number) => {
    const doc = documents[index];

    // Try to delete from storage
    await supabase.storage.from("personnel-documents").remove([doc.path]);

    onChange(documents.filter((_, i) => i !== index));
    toast.success("Document removed");
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
            <p className="text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground mb-2">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Accepted: JPG, PNG, WebP, PDF (max 10MB)
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.accept = ALLOWED_TYPES.join(",");
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files) handleFiles(files);
                };
                input.click();
              }}
            >
              Select Files
            </Button>
          </>
        )}
      </div>

      {documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Uploaded Documents</p>
          {documents.map((doc, index) => (
            <Card key={index}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDocument(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
