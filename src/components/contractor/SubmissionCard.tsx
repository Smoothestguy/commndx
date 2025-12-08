import React, { useState } from "react";
import { format } from "date-fns";
import { FileText, Receipt, Download, Trash2, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ContractorSubmission, getContractorFileUrl, useDeleteContractorSubmission } from "@/integrations/supabase/hooks/useContractorSubmissions";
import { toast } from "sonner";

interface SubmissionCardProps {
  submission: ContractorSubmission;
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const deleteSubmission = useDeleteContractorSubmission();

  const handleDownload = async (filePath: string, fileName: string) => {
    setDownloadingFile(filePath);
    try {
      const url = await getContractorFileUrl(filePath);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSubmission.mutateAsync(submission.id);
      toast.success("Submission deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete submission");
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              submission.submission_type === "bill" 
                ? "bg-blue-100 dark:bg-blue-900/30" 
                : "bg-green-100 dark:bg-green-900/30"
            }`}>
              {submission.submission_type === "bill" ? (
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Receipt className="h-5 w-5 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {submission.contractor_name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {format(new Date(submission.submission_date), "MMM d, yyyy")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={submission.submission_type === "bill" ? "default" : "secondary"}>
              {submission.submission_type === "bill" ? "Bill" : "Expense"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 border-t">
          <div className="pt-4 space-y-4">
            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {submission.submission_type === "bill" && submission.job_name && (
                <div>
                  <span className="text-muted-foreground">Job:</span>
                  <p className="font-medium">{submission.job_name}</p>
                </div>
              )}
              
              {submission.submission_type === "expense" && (
                <>
                  {submission.customer_name && (
                    <div>
                      <span className="text-muted-foreground">Customer:</span>
                      <p className="font-medium">{submission.customer_name}</p>
                    </div>
                  )}
                  {submission.project_name && (
                    <div>
                      <span className="text-muted-foreground">Project:</span>
                      <p className="font-medium">{submission.project_name}</p>
                    </div>
                  )}
                  {submission.amount !== null && (
                    <div>
                      <span className="text-muted-foreground">Amount:</span>
                      <p className="font-medium">{formatCurrency(submission.amount)}</p>
                    </div>
                  )}
                  {submission.expense_description && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Description:</span>
                      <p className="font-medium">{submission.expense_description}</p>
                    </div>
                  )}
                </>
              )}

              <div>
                <span className="text-muted-foreground">Submitted:</span>
                <p className="font-medium">
                  {format(new Date(submission.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>

            {/* Files */}
            {submission.files && submission.files.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Attached Files:</span>
                <div className="mt-2 space-y-2">
                  {submission.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(file.path, file.name)}
                        disabled={downloadingFile === file.path}
                      >
                        {downloadingFile === file.path ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this submission from {submission.contractor_name}? 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
