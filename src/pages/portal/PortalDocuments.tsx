import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { 
  usePersonnelDocuments, 
  useGetPersonnelDocumentUrl,
  getDocumentTypeLabel,
  PersonnelDocument
} from "@/integrations/supabase/hooks/usePersonnelDocuments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Loader2, FolderOpen, Eye, X } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";

export default function PortalDocuments() {
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: documents, isLoading: documentsLoading } = usePersonnelDocuments(personnel?.id);
  const getDocumentUrl = useGetPersonnelDocumentUrl();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PersonnelDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const handlePreview = async (doc: PersonnelDocument) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    try {
      const url = await getDocumentUrl(doc.file_path);
      setPreviewUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (fileName: string): boolean => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
  };

  const isPdf = (fileName: string): boolean => {
    return fileName.toLowerCase().endsWith('.pdf');
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
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handlePreview(doc)}
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(doc);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(doc.id, doc.file_path, doc.file_name);
                          }}
                          disabled={downloadingId === doc.id}
                        >
                          {downloadingId === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {previewDoc && getDocumentTypeLabel(previewDoc.document_type)}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 overflow-auto">
            {previewLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewUrl && previewDoc ? (
              <div className="space-y-4">
                {/* Preview Content */}
                <div className="flex items-center justify-center bg-muted/30 rounded-lg p-4 min-h-[400px]">
                  {isImage(previewDoc.file_name) ? (
                    <img 
                      src={previewUrl} 
                      alt={previewDoc.file_name}
                      className="max-w-full max-h-[60vh] object-contain rounded"
                    />
                  ) : isPdf(previewDoc.file_name) ? (
                    <iframe 
                      src={previewUrl}
                      className="w-full h-[60vh] rounded border"
                      title={previewDoc.file_name}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Preview not available for this file type
                      </p>
                    </div>
                  )}
                </div>

                {/* Document Info */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{previewDoc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(previewDoc.file_size)} • Uploaded{" "}
                      {format(new Date(previewDoc.uploaded_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(previewDoc.id, previewDoc.file_path, previewDoc.file_name)}
                    disabled={downloadingId === previewDoc.id}
                  >
                    {downloadingId === previewDoc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
