import { useState } from "react";
import { FileText, Download, Trash2, Loader2, Eye, DownloadCloud } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  useVendorDocuments,
  useDeleteVendorDocument,
  type VendorDocument,
} from "@/integrations/supabase/hooks/useVendorDocuments";

interface VendorDocumentsListProps {
  vendorId: string;
  canDelete?: boolean;
}

export function VendorDocumentsList({
  vendorId,
  canDelete = true,
}: VendorDocumentsListProps) {
  const { data: documents, isLoading, error } = useVendorDocuments(vendorId);
  const deleteDocument = useDeleteVendorDocument();

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<VendorDocument | null>(null);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<VendorDocument | null>(null);

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
    } catch {
      throw new Error("Failed to download file");
    }
  };

  const handleDownload = async (doc: VendorDocument) => {
    setDownloadingId(doc.id);
    try {
      await forceDownload(doc.document_url, doc.document_name);
    } catch {
      // toast handled by caller
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!documents || documents.length === 0) return;
    setDownloadingAll(true);
    for (const doc of documents) {
      try {
        await forceDownload(doc.document_url, doc.document_name);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch {
        // continue
      }
    }
    setDownloadingAll(false);
  };

  const handlePreview = (doc: VendorDocument) => {
    setPreviewDoc(doc);
  };

  const closePreview = () => {
    setPreviewDoc(null);
  };

  const handleDeleteClick = (doc: VendorDocument) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (documentToDelete) {
      await deleteDocument.mutateAsync({
        id: documentToDelete.id,
        vendorId,
      });
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const getFileExtension = (name: string): string => {
    return name.split(".").pop()?.toLowerCase() || "";
  };

  const isImage = (name: string): boolean => {
    const ext = getFileExtension(name);
    return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  };

  const isPdf = (name: string): boolean => {
    return getFileExtension(name) === "pdf";
  };

  const isExpired = (expiryDate: string | null): boolean => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const isExpiringSoon = (expiryDate: string | null): boolean => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry > now && expiry <= thirtyDays;
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
                    <p className="font-medium truncate">{doc.document_name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {doc.document_type}
                      </Badge>
                      <span>{format(new Date(doc.uploaded_at), "MMM d, yyyy")}</span>
                      {doc.expiry_date && (
                        <>
                          <span>•</span>
                          <span
                            className={
                              isExpired(doc.expiry_date)
                                ? "text-destructive font-medium"
                                : isExpiringSoon(doc.expiry_date)
                                ? "text-amber-600 font-medium"
                                : ""
                            }
                          >
                            {isExpired(doc.expiry_date)
                              ? "Expired"
                              : isExpiringSoon(doc.expiry_date)
                              ? "Expiring soon"
                              : `Expires ${format(new Date(doc.expiry_date), "MMM d, yyyy")}`}
                          </span>
                        </>
                      )}
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
              {previewDoc?.document_name}
            </DialogTitle>
          </DialogHeader>
          <div className="relative min-h-[300px] max-h-[70vh] overflow-auto">
            {previewDoc && isImage(previewDoc.document_name) ? (
              <img
                src={previewDoc.document_url}
                alt={previewDoc.document_name}
                className="max-w-full h-auto mx-auto rounded-lg"
              />
            ) : previewDoc && isPdf(previewDoc.document_name) ? (
              <iframe
                src={previewDoc.document_url}
                className="w-full h-[65vh] rounded-lg border"
                title={previewDoc.document_name}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Preview not available for this file type
                </p>
                <Button
                  onClick={() =>
                    previewDoc && window.open(previewDoc.document_url, "_blank")
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download to View
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.document_name}"?
              This action cannot be undone.
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
