import { useUserRole } from "@/hooks/useUserRole";
import { useProjectLocations } from "@/integrations/supabase/hooks/useProjectLocations";
import { useDocumentSignatures } from "@/integrations/supabase/hooks/useDocumentSignatures";
import { DocumentSignaturePanel } from "@/components/documents/DocumentSignaturePanel";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProjectDocuments, useUploadProjectDocument, useDeleteProjectDocument, useGetProjectDocumentUrl } from "@/integrations/supabase/hooks/useProjectDocuments";
import { FileText, Upload, Trash2, Download, Loader2, Eye } from "lucide-react";
import { format } from "date-fns";
import type { ProjectDocument } from "@/integrations/supabase/hooks/useProjectDocuments";

interface ProjectDocumentsProps {
  projectId: string;
  projectName?: string;
}

export const ProjectDocuments = ({ projectId, projectName = "Project" }: ProjectDocumentsProps) => {
  const { data: documents, isLoading } = useProjectDocuments(projectId);
  const { isAdmin, isManager, isUser } = useUserRole();
  const canManage = isAdmin || isManager;
  const canSend = canManage || isUser;
  const { data: locations = [] } = useProjectLocations(projectId);
  const { data: signatures = [] } = useDocumentSignatures(projectId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [locationId, setLocationId] = useState("project");
  const [notes, setNotes] = useState("");
  const uploadDocument = useUploadProjectDocument();
  const deleteDocument = useDeleteProjectDocument();
  const getDocumentUrl = useGetProjectDocumentUrl();
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isImage = (fileType: string) => fileType?.startsWith("image/");
  const isPdf = (fileType: string) => fileType === "application/pdf" || fileType?.includes("pdf");

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      try {
        for (const file of Array.from(files)) {
          await uploadDocument.mutateAsync({ projectId, file, requiresSignature, locationId: locationId === "project" ? null : locationId, notes });
        }
        setUploadOpen(false);
      } catch { /* Mutation displays the failure; keep upload dialog open. */
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [projectId, uploadDocument, requiresSignature, locationId, notes]
  );

  const forceDownload = async (url: string, fileName: string) => {
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
  };

  const handleDownload = async (filePath: string, fileName: string, docId: string) => {
    setDownloadingId(docId);
    try {
      const url = await getDocumentUrl(filePath);
      if (url) {
        await forceDownload(url, fileName);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (doc: ProjectDocument) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    try {
      const url = await getDocumentUrl(doc.file_path);
      setPreviewUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      await deleteDocument.mutateAsync({ id, filePath, projectId });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <Card className="glass border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Project Documents ({documents?.length || 0})
          </CardTitle>
          {canManage && <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1" />Upload</Button>}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !documents || documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No documents uploaded yet. Upload documents to keep track of project files.
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-lg bg-secondary/50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.location_id && `${locations.find(l => l.id === doc.location_id)?.name || "Location"} • `}{formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
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
                      disabled={downloadingId === doc.id}
                      onClick={() => handleDownload(doc.file_path, doc.file_name, doc.id)}
                      title="Download"
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    {canManage && !doc.requires_signature && <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc.id, doc.file_path)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>}
                  </div>
                  </div>
                  {doc.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{doc.notes}</p>}
                  {doc.requires_signature && <DocumentSignaturePanel doc={doc} rows={signatures.filter(r => r.document_id === doc.id)} projectName={projectName} canSend={canSend} canManage={canManage} />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
        <label className="flex items-center justify-between gap-3 text-sm">Requires signature<Switch checked={requiresSignature} onCheckedChange={setRequiresSignature} /></label>
        <Label>Location</Label><Select value={locationId} onValueChange={setLocationId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="project">Project-wide</SelectItem>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
        <Label htmlFor="doc-notes">Notes (optional)</Label><Textarea id="doc-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={3000} />
        <input type="file" aria-label="Document file" accept={requiresSignature ? "application/pdf,.pdf" : undefined} disabled={isUploading} onChange={handleFileChange} className="w-full text-sm" />
        {isUploading && <Loader2 className="h-5 w-5 animate-spin" />}
      </DialogContent></Dialog>
      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <span className="truncate">{previewDoc?.file_name}</span>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={downloadingId === previewDoc?.id}
                onClick={() => previewDoc && handleDownload(previewDoc.file_path, previewDoc.file_name, previewDoc.id)}
              >
                {downloadingId === previewDoc?.id ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Download
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto border rounded-lg min-h-[400px] flex items-center justify-center bg-muted/30">
            {previewLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : previewUrl && previewDoc ? (
              isPdf(previewDoc.file_type) ? (
                <iframe 
                  src={previewUrl} 
                  className="w-full h-[70vh] border-0"
                  title={previewDoc.file_name}
                />
              ) : isImage(previewDoc.file_type) ? (
                <img 
                  src={previewUrl} 
                  alt={previewDoc.file_name}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Preview not available for this file type.</p>
                  <p className="text-sm mt-2">Click Download to view the file.</p>
                </div>
              )
            ) : (
              <p className="text-muted-foreground">Failed to load preview.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
