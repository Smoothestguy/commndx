import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectDocuments, useUploadProjectDocument, useDeleteProjectDocument, useGetProjectDocumentUrl } from "@/integrations/supabase/hooks/useProjectDocuments";
import { FileText, Upload, Trash2, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ProjectDocumentsProps {
  projectId: string;
}

export const ProjectDocuments = ({ projectId }: ProjectDocumentsProps) => {
  const { data: documents, isLoading } = useProjectDocuments(projectId);
  const uploadDocument = useUploadProjectDocument();
  const deleteDocument = useDeleteProjectDocument();
  const getDocumentUrl = useGetProjectDocumentUrl();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      try {
        for (const file of Array.from(files)) {
          await uploadDocument.mutateAsync({ projectId, file });
        }
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [projectId, uploadDocument]
  );

  const handleDownload = async (filePath: string, fileName: string) => {
    const url = await getDocumentUrl(filePath);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
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
    <Card className="glass border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-heading flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Project Documents ({documents?.length || 0})
        </CardTitle>
        <div>
          <input
            type="file"
            id="document-upload"
            className="hidden"
            multiple
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => document.getElementById("document-upload")?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload
          </Button>
        </div>
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
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(doc.file_path, doc.file_name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc.id, doc.file_path)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
