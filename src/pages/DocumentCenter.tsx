import { useState, useMemo } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Download, 
  Trash2, 
  Eye, 
  FolderOpen,
  Receipt,
  FileImage,
  File,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { usePermissionCheck } from "@/hooks/usePermissionCheck";
import { Navigate } from "react-router-dom";
import {
  useAllSystemDocuments,
  useDeleteSystemDocument,
  DOCUMENT_SOURCE_LABELS,
  type SystemDocument,
  type DocumentSourceType,
} from "@/integrations/supabase/hooks/useAllSystemDocuments";
import { DocumentFilters } from "@/components/documents/DocumentFilters";
import { DocumentPreviewDialog } from "@/components/documents/DocumentPreviewDialog";
import { getDocumentUrl, downloadDocument } from "@/utils/documentUrlUtils";
import { toast } from "sonner";

export default function DocumentCenter() {
  const { canView, canDelete, loading: permLoading } = usePermissionCheck("document_center");
  const { data: documents, isLoading } = useAllSystemDocuments();
  const deleteDocument = useDeleteSystemDocument();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceType, setSourceType] = useState<DocumentSourceType | "all">("all");
  const [relatedEntity, setRelatedEntity] = useState("");
  const [previewDoc, setPreviewDoc] = useState<SystemDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<SystemDocument | null>(null);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    
    return documents.filter((doc) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesName = doc.file_name.toLowerCase().includes(search);
        const matchesEntity = doc.related_entity_name?.toLowerCase().includes(search);
        const matchesUploader = doc.uploader_name?.toLowerCase().includes(search);
        if (!matchesName && !matchesEntity && !matchesUploader) return false;
      }

      // Source type filter
      if (sourceType !== "all" && doc.source_type !== sourceType) return false;

      // Related entity filter
      if (relatedEntity && doc.related_entity_name !== relatedEntity) return false;

      return true;
    });
  }, [documents, searchTerm, sourceType, relatedEntity]);

  // Get unique entities for filter dropdown
  const uniqueEntities = useMemo(() => {
    if (!documents) return [];
    const entities = new Set<string>();
    documents.forEach((doc) => {
      if (doc.related_entity_name) entities.add(doc.related_entity_name);
    });
    return Array.from(entities).sort();
  }, [documents]);

  // Stats
  const stats = useMemo(() => {
    if (!documents) return { total: 0, byType: {} as Record<string, number> };
    
    const byType: Record<string, number> = {};
    documents.forEach((doc) => {
      byType[doc.source_type] = (byType[doc.source_type] || 0) + 1;
    });
    
    return { total: documents.length, byType };
  }, [documents]);

  // Handlers
  const handlePreview = async (doc: SystemDocument) => {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    setIsLoadingUrl(true);
    
    try {
      const url = await getDocumentUrl(doc.file_path, doc.source_type);
      setPreviewUrl(url);
    } catch (error) {
      console.error("Error getting preview URL:", error);
      toast.error("Failed to load document preview");
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleDownload = async (doc: SystemDocument) => {
    setDownloadingId(doc.id);
    try {
      const success = await downloadDocument(doc.file_path, doc.source_type, doc.file_name);
      if (!success) {
        toast.error("Failed to download document");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = () => {
    if (!deleteDoc) return;
    deleteDocument.mutate(
      { id: deleteDoc.id, sourceType: deleteDoc.source_type },
      { onSuccess: () => setDeleteDoc(null) }
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSourceType("all");
    setRelatedEntity("");
  };

  const hasActiveFilters = searchTerm !== "" || sourceType !== "all" || relatedEntity !== "";

  // Get icon for document type
  const getDocIcon = (doc: SystemDocument) => {
    if (doc.source_type === "reimbursement") return Receipt;
    if (doc.file_type?.match(/^(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) return FileImage;
    return File;
  };

  // Loading state
  if (permLoading) {
    return (
      <PageLayout title="Document Center">
        <div className="flex items-center justify-center h-64">
          <Skeleton className="h-8 w-48" />
        </div>
      </PageLayout>
    );
  }

  // Access denied
  if (!canView) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <PageLayout
      title="Document Center"
      description="View and manage all uploaded documents across the system"
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receipts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byType.reimbursement || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vendor Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.byType.vendor_document || 0) + (stats.byType.vendor_bill_attachment || 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Attachments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.byType.invoice_attachment || 0) +
                  (stats.byType.estimate_attachment || 0) +
                  (stats.byType.project_document || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <DocumentFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              sourceType={sourceType}
              onSourceTypeChange={setSourceType}
              relatedEntity={relatedEntity}
              onRelatedEntityChange={setRelatedEntity}
              uniqueEntities={uniqueEntities}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Documents ({filteredDocuments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents found</p>
                {hasActiveFilters && (
                  <Button variant="link" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Related To</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc) => {
                      const DocIcon = getDocIcon(doc);
                      return (
                        <TableRow 
                          key={`${doc.source_type}-${doc.id}`}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handlePreview(doc)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <DocIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium truncate max-w-[300px]">
                                  {doc.file_name}
                                </p>
                                {doc.uploader_name && (
                                  <p className="text-xs text-muted-foreground">
                                    by {doc.uploader_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="whitespace-nowrap">
                              {DOCUMENT_SOURCE_LABELS[doc.source_type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
                              {doc.related_entity_name || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div 
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
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
                                title="Download"
                                disabled={downloadingId === doc.id}
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
                                  onClick={() => setDeleteDoc(doc)}
                                  title="Delete"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <DocumentPreviewDialog
        open={!!previewDoc}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDoc(null);
            setPreviewUrl(null);
          }
        }}
        document={previewDoc}
        onDownload={handleDownload}
        previewUrl={previewUrl}
        isLoadingUrl={isLoadingUrl}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => !open && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Document
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDoc?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
