import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUploadVendorDocument } from "@/integrations/supabase/hooks/useVendorDocuments";
import { Loader2, Upload } from "lucide-react";

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
  const uploadDocument = useUploadVendorDocument();

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

  return (
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
  );
};
