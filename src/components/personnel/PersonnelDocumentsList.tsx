import { useState } from "react";
import { FileText, Download, Trash2, Loader2, Eye, DownloadCloud } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  usePersonnelDocuments,
  useDeletePersonnelDocument,
  useGetPersonnelDocumentUrl,
  getDocumentTypeLabel,
  type PersonnelDocument,
} from "@/integrations/supabase/hooks/usePersonnelDocuments";

interface PersonnelDocumentsListProps {
  personnelId: string;
  canDelete?: boolean;
}

export function PersonnelDocumentsList({
  personnelId,
  canDelete = true,
}: PersonnelDocumentsListProps) {
  const { data: documents, isLoading, error } = usePersonnelDocuments(personnelId);
  const deleteDocument = useDeletePersonnelDocument();
  const getDocumentUrl = useGetPersonnelDocumentUrl();
  
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<PersonnelDocument | null>(null);
  
  // Preview state
  const [previewDoc, setPreviewDoc] = useState<PersonnelDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const forceDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      throw new Error("Failed to download file");
    }
  };

  const handleDownload = async (document: PersonnelDocument) => {
    setDownloadingId(document.id);
    try {
      const url = await getDocumentUrl(document.file_path);
      if (url) {
        await forceDownload(url, document.file_name);
        toast({
          title: "Download complete",
          description: `${document.file_name} has been downloaded.`,
        });
      }
    } catch (err) {
      toast({
        title: "Download failed",
        description: "Failed to download the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!documents || documents.length === 0) return;
    
    setDownloadingAll(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const doc of documents) {
      try {
        const url = await getDocumentUrl(doc.file_path);
        if (url) {
          await forceDownload(url, doc.file_name);
          successCount++;
          // Small delay between downloads to prevent browser issues
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        failCount++;
      }
    }
    
    setDownloadingAll(false);
    
    if (failCount === 0) {
      toast({
        title: "All downloads complete",
        description: `Successfully downloaded ${successCount} document(s).`,
      });
    } else {
      toast({
        title: "Downloads completed with errors",
        description: `Downloaded ${successCount} file(s), ${failCount} failed.`,
        variant: "destructive",
      });
    }
  };

  const handlePreview = async (document: PersonnelDocument) => {
    setPreviewDoc(document);
    setPreviewLoading(true);
    try {
      const url = await getDocumentUrl(document.file_path);
      setPreviewUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  const handleDeleteClick = (document: PersonnelDocument) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (documentToDelete) {
      await deleteDocument.mutateAsync({
        documentId: documentToDelete.id,
        filePath: documentToDelete.file_path,
      });
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (fileType: string | null): boolean => {
    if (!fileType) return false;
    return fileType.startsWith("image/");
  };

  const isPdf = (fileType: string | null): boolean => {
    if (!fileType) return false;
    return fileType === "application/pdf";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load documents. Please try again.
        </CardContent>
      </Card>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No documents uploaded</p>
        </CardContent>
      </Card>
    );
  }

  // Group documents by type for better organization
  const groupedDocuments = documents.reduce((acc, doc) => {
    const type = doc.document_type || "other";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, PersonnelDocument[]>);

  // Priority order for document types
  const typeOrder = ["government_id", "ssn_card", "work_authorization", "profile_photo", "other"];
  const sortedTypes = Object.keys(groupedDocuments).sort(
    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Uploaded Documents ({documents.length})
          </CardTitle>
          {documents.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={downloadingAll}
            >
              {downloadingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <DownloadCloud className="h-4 w-4 mr-2" />
                  Download All
                </>
              )}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="shrink-0">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{doc.file_name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {getDocumentTypeLabel(doc.document_type)}
                      </Badge>
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{format(new Date(doc.uploaded_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePreview(doc)}
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                    title="Download"
                  >
                    {downloadingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(doc)}
                      disabled={deleteDocument.isPending}
                      className="text-destructive hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {previewDoc?.file_name}
            </DialogTitle>
          </DialogHeader>
          <div className="relative min-h-[300px] max-h-[70vh] overflow-auto">
            {previewLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewUrl ? (
              <>
                {isImage(previewDoc?.file_type || null) ? (
                  <img
                    src={previewUrl}
                    alt={previewDoc?.file_name}
                    className="max-w-full h-auto mx-auto rounded-lg"
                  />
                ) : isPdf(previewDoc?.file_type || null) ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[65vh] rounded-lg border"
                    title={previewDoc?.file_name}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Preview not available for this file type
                    </p>
                    <Button onClick={() => previewUrl && window.open(previewUrl, "_blank")}>
                      <Download className="h-4 w-4 mr-2" />
                      Download to View
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Failed to load preview
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDocument.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
