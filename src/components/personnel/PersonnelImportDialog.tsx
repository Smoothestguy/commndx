import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Download, FileText, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  parseCSVFile,
  validatePersonnelRows,
  generateSampleCSV,
  downloadCSV,
  downloadErrorReport,
  type ParsedPersonnelRow,
  type ValidationResult,
} from "@/utils/csvPersonnelParser";
import { useBulkAddPersonnel } from "@/integrations/supabase/hooks/usePersonnel";
import { supabase } from "@/integrations/supabase/client";

interface PersonnelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "preview" | "importing" | "results";

export const PersonnelImportDialog = ({ open, onOpenChange }: PersonnelImportDialogProps) => {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const queryClient = useQueryClient();
  const bulkAdd = useBulkAddPersonnel();

  const handleDownloadTemplate = () => {
    const csv = generateSampleCSV();
    downloadCSV(csv, "personnel-import-template.csv");
    toast.success("Template downloaded");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    setStep("preview");

    try {
      // Parse CSV
      const rows = await parseCSVFile(selectedFile);
      
      // Get existing emails from database
      const { data: existingPersonnel } = await supabase
        .from("personnel")
        .select("email");
      
      const existingEmails = existingPersonnel?.map(p => p.email.toLowerCase()) || [];
      
      // Validate rows
      const validationResult = validatePersonnelRows(rows, existingEmails);
      setValidation(validationResult);

      if (validationResult.invalid.length > 0) {
        toast.warning(`Found ${validationResult.invalid.length} rows with errors`);
      } else {
        toast.success(`All ${validationResult.valid.length} rows validated successfully`);
      }
    } catch (error) {
      console.error("Error parsing CSV:", error);
      toast.error("Failed to parse CSV file");
      setStep("upload");
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!validation?.valid.length) return;

    setStep("importing");
    setImporting(true);
    setProgress(0);

    try {
      const batchSize = 50;
      const batches = [];
      
      for (let i = 0; i < validation.valid.length; i += batchSize) {
        batches.push(validation.valid.slice(i, i + batchSize));
      }

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const cleanBatch = batch.map(({ rowNumber, errors, ...rest }) => rest);

        try {
          await bulkAdd.mutateAsync(cleanBatch as any);
          successCount += batch.length;
        } catch (error) {
          console.error("Batch import error:", error);
          failedCount += batch.length;
        }

        setProgress(((i + 1) / batches.length) * 100);
      }

      setResults({ success: successCount, failed: failedCount });
      setStep("results");

      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-stats"] });

      if (failedCount === 0) {
        toast.success(`Successfully imported ${successCount} personnel records`);
      } else {
        toast.warning(`Imported ${successCount} records, ${failedCount} failed`);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import personnel records");
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setValidation(null);
    setResults(null);
    setProgress(0);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Personnel from CSV</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6">
            <Alert>
              <AlertDescription>
                Upload a CSV file with personnel records. Download the template below to see the required format.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-12 space-y-4">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <span>
                      <FileText className="mr-2 h-4 w-4" />
                      Select CSV File
                    </span>
                  </Button>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download CSV Template
            </Button>
          </div>
        )}

        {step === "preview" && validation && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{validation.totalRows}</div>
                <div className="text-sm text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{validation.valid.length}</div>
                <div className="text-sm text-muted-foreground">Valid</div>
              </div>
              <div className="text-center p-4 bg-red-500/10 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{validation.invalid.length}</div>
                <div className="text-sm text-muted-foreground">Invalid</div>
              </div>
            </div>

            {validation.invalid.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {validation.invalid.length} row(s) have errors and will be skipped during import.
                </AlertDescription>
              </Alert>
            )}

            {validation.invalid.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Rows with Errors:</h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {validation.invalid.map((row) => (
                    <div key={row.rowNumber} className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-sm">
                      <div className="font-medium">Row {row.rowNumber}: {row.first_name} {row.last_name}</div>
                      <ul className="list-disc list-inside text-red-600 dark:text-red-400 mt-1">
                        {row.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => downloadErrorReport(validation.invalid)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Error Report
                </Button>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={validation.valid.length === 0}
                className="flex-1"
              >
                Import {validation.valid.length} Record(s)
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <div className="text-lg font-semibold mb-2">Importing Personnel Records...</div>
              <Progress value={progress} className="w-full" />
              <div className="text-sm text-muted-foreground mt-2">{Math.round(progress)}%</div>
            </div>
          </div>
        )}

        {step === "results" && results && (
          <div className="space-y-6">
            <div className="text-center py-8">
              {results.failed === 0 ? (
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              ) : (
                <AlertTriangle className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
              )}
              <h3 className="text-2xl font-bold mb-2">Import Complete</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-6 bg-green-500/10 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{results.success}</div>
                <div className="text-sm text-muted-foreground">Successfully Imported</div>
              </div>
              {results.failed > 0 && (
                <div className="text-center p-6 bg-red-500/10 rounded-lg">
                  <div className="text-3xl font-bold text-red-600">{results.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              )}
            </div>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
