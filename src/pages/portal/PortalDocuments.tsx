import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { 
  usePersonnelDocuments, 
  useGetPersonnelDocumentUrl,
  getDocumentTypeLabel 
} from "@/integrations/supabase/hooks/usePersonnelDocuments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, FolderOpen } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function PortalDocuments() {
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: documents, isLoading: documentsLoading } = usePersonnelDocuments(personnel?.id);
  const getDocumentUrl = useGetPersonnelDocumentUrl();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (documentId: string, filePath: string, fileName: string) => {
    setDownloadingId(documentId);
    try {
      const url = await getDocumentUrl(filePath);
      if (url) {
        window.open(url, "_blank");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isLoading = personnelLoading || documentsLoading;

  // Group documents by type
  const groupedDocuments = documents?.reduce((acc, doc) => {
    const type = doc.document_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Documents</h1>
          <p className="text-muted-foreground">
            Documents you submitted during onboarding
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !documents || documents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Documents</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You haven't uploaded any documents yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {Object.entries(groupedDocuments || {}).map(([type, docs]) => (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {getDocumentTypeLabel(type)}
                  </CardTitle>
                  <CardDescription>
                    {docs?.length} {docs?.length === 1 ? "file" : "files"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {docs?.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {doc.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)} • Uploaded{" "}
                          {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc.id, doc.file_path, doc.file_name)}
                        disabled={downloadingId === doc.id}
                      >
                        {downloadingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
