import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVendorDocuments, useUploadVendorDocument, useDeleteVendorDocument } from "@/integrations/supabase/hooks/useVendorDocuments";
import { FileText, Loader2, Trash2, Upload, Download } from "lucide-react";
import { format } from "date-fns";

interface VendorDocumentUploadProps {
  vendorId: string;
}

const DOCUMENT_TYPES = [
  "W9",
  "Insurance Certificate",
  "License",
  "Contract",
  "Other",
];

export const VendorDocumentUpload = ({ vendorId }: VendorDocumentUploadProps) => {
  const { data: documents, isLoading } = useVendorDocuments(vendorId);
  const uploadDocument = useUploadVendorDocument();
  const deleteDocument = useDeleteVendorDocument();

  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");

  const handleUpload = async () => {
    if (!file || !documentType) return;

    await uploadDocument.mutateAsync({
      vendorId,
      file,
      documentType,
      expiryDate: expiryDate || undefined,
    });

    setFile(null);
    setDocumentType("");
    setExpiryDate("");
  };

  const handleDelete = async (documentId: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await deleteDocument.mutateAsync({ id: documentId, vendorId });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="document-type">Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id="document-type">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry">Expiry Date (Optional)</Label>
            <Input
              id="expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || !documentType || uploadDocument.isPending}
          >
            {uploadDocument.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Upload Document
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{doc.document_name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">
                        {doc.document_type}
                      </span>
                      <span>Uploaded {format(new Date(doc.uploaded_at), "MMM d, yyyy")}</span>
                      {doc.expiry_date && (
                        <span className={new Date(doc.expiry_date) < new Date() ? "text-destructive" : ""}>
                          Expires {format(new Date(doc.expiry_date), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(doc.document_url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleteDocument.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No documents uploaded yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
