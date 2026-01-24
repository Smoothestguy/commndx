import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, FileText, Loader2, CheckCircle, AlertTriangle, XCircle, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { RegistrationDocument } from "@/integrations/supabase/hooks/usePersonnelRegistrations";

export interface VerificationResult {
  verified: boolean;
  documentType: 'ssn_card' | 'government_id' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  message: string;
  extracted_ssn_last4?: string;
  extracted_name?: string;
  ssn_matches?: boolean;
}

interface CategoryDocumentUploadProps {
  documentType: RegistrationDocument["document_type"];
  label: string;
  helperText?: string;
  required?: boolean;
  existingDocument?: RegistrationDocument & { verification?: VerificationResult };
  onUpload: (doc: RegistrationDocument & { verification?: VerificationResult }) => void;
  onRemove: () => void;
  sessionId: string;
  /** For SSN card verification - pass the entered SSN for cross-checking */
  expectedSSN?: string;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// Document types that require AI verification
const VERIFIABLE_DOCUMENT_TYPES = ['ssn_card', 'government_id'];

export const CategoryDocumentUpload = ({
  documentType,
  label,
  helperText,
  required,
  existingDocument,
  onUpload,
  onRemove,
  sessionId,
  expectedSSN,
}: CategoryDocumentUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const verifyDocument = async (file: File): Promise<VerificationResult | null> => {
    // Only verify SSN cards and Government IDs
    if (!VERIFIABLE_DOCUMENT_TYPES.includes(documentType)) {
      return null;
    }

    // Only verify images, not PDFs
    if (!file.type.startsWith('image/')) {
      return null;
    }

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix to get just the base64
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await supabase.functions.invoke('verify-document', {
        body: {
          imageBase64: base64,
          imageType: file.type,
          expectedDocumentType: documentType,
          // Pass the expected SSN for cross-verification (SSN card only)
          expectedSSN: documentType === 'ssn_card' ? expectedSSN : undefined,
        },
      });

      if (response.error) {
        console.error('Verification error:', response.error);
        return null;
      }

      return response.data as VerificationResult;
    } catch (error) {
      console.error('Error verifying document:', error);
      return null;
    }
  };

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
        // Check if this document type needs verification
        if (VERIFIABLE_DOCUMENT_TYPES.includes(documentType) && file.type.startsWith('image/')) {
          setUploading(false);
          setVerifying(true);
          toast.info("Verifying document with AI...");
          
          const verification = await verifyDocument(file);
          setVerifying(false);
          
          if (verification) {
            const docWithVerification = { ...result, verification };
            onUpload(docWithVerification);
            
            if (verification.verified) {
              toast.success(verification.message || `${label} verified successfully`);
            } else if (verification.confidence === 'medium') {
              toast.warning(verification.message || `${label} uploaded with warnings`);
            } else {
              toast.error(verification.message || `${label} verification failed`);
            }
          } else {
            // Verification failed to run, still upload but note it wasn't verified
            onUpload(result);
            toast.success(`${label} uploaded (verification unavailable)`);
          }
        } else {
          onUpload(result);
          toast.success(`${label} uploaded successfully`);
        }
      }

      setUploading(false);
      setVerifying(false);
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

  const getVerificationIcon = (verification?: VerificationResult) => {
    if (!verification) return null;
    
    if (verification.verified && verification.confidence === 'high') {
      return <CheckCircle className="h-5 w-5 text-success" />;
    } else if (verification.verified && verification.confidence === 'medium') {
      return <AlertTriangle className="h-5 w-5 text-warning" />;
    } else if (!verification.verified) {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    return <Shield className="h-5 w-5 text-muted-foreground" />;
  };

  const getVerificationBorderClass = (verification?: VerificationResult) => {
    if (!verification) return "border-success/50 bg-success/5";
    
    if (verification.verified && verification.confidence === 'high') {
      return "border-success/50 bg-success/5";
    } else if (verification.verified && verification.confidence === 'medium') {
      return "border-warning/50 bg-warning/5";
    } else if (!verification.verified) {
      return "border-destructive/50 bg-destructive/5";
    }
    return "border-muted bg-muted/5";
  };

  if (existingDocument) {
    const verification = (existingDocument as any).verification as VerificationResult | undefined;
    
    return (
      <Card className={getVerificationBorderClass(verification)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getVerificationIcon(verification) || <CheckCircle className="h-5 w-5 text-success" />}
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {existingDocument.name}
                </p>
                {verification && (
                  <div className="mt-1">
                    {verification.verified ? (
                      <span className={`text-xs ${verification.confidence === 'high' ? 'text-success' : 'text-warning'}`}>
                        ✓ Verified ({verification.confidence} confidence)
                      </span>
                    ) : (
                      <span className="text-xs text-destructive">
                        ✗ {verification.message}
                      </span>
                    )}
                    {verification.issues && verification.issues.length > 0 && (
                      <div className="mt-1">
                        {verification.issues.map((issue, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground">• {issue}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
      {uploading || verifying ? (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {verifying ? "AI is verifying document..." : "Uploading..."}
          </span>
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
          {VERIFIABLE_DOCUMENT_TYPES.includes(documentType) && (
            <p className="text-xs text-primary flex items-center justify-center gap-1">
              <Shield className="h-3 w-3" />
              AI verification enabled
            </p>
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
