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
import { supabase } from "@/integrations/supabase/client";
import { createPersonnelOverride, findContactMatches, logCreateAnyway, matchesBlock, parseDuplicateError, REASON_LABEL, type ContactMatch } from "@/lib/contactMatches";
import { useUserRole } from "@/hooks/useUserRole";

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
  const [results, setResults] = useState<{ success: number; failed: number; attached: number; rows: { rowNumber: number; name: string; outcome: string; ok: boolean }[] } | null>(null);
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  // Review step: rows with possible matches default to Skip.
  const [rowMatches, setRowMatches] = useState<Record<number, ContactMatch[]>>({});
  const [createRows, setCreateRows] = useState<Record<number, boolean>>({});
  const [checkingMatches, setCheckingMatches] = useState(false);

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
      setCheckingMatches(true);
      const found: Record<number, ContactMatch[]> = {};
      const queue = [...validationResult.valid];
      await Promise.all(Array.from({ length: 5 }, async () => {
        for (let row = queue.shift(); row; row = queue.shift()) {
          try { const m = await findContactMatches(row); if (m.length) found[row.rowNumber] = m; } catch (e) { console.error("Duplicate check failed", e); }
        }
      }));
      setRowMatches(found); setCreateRows({}); setCheckingMatches(false);

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
    const toImport = validation.valid.filter((r) => !rowMatches[r.rowNumber] || createRows[r.rowNumber]);

    setStep("importing");
    setImporting(true);
    setProgress(0);

    try {
      // One row at a time so a duplicate-guard refusal is reported per row and never fails the batch.
      let successCount = 0, failedCount = 0;
      const report: { rowNumber: number; name: string; outcome: string; ok: boolean }[] = [];
      const attached = validation.valid.filter((r) => rowMatches[r.rowNumber] && !createRows[r.rowNumber]);
      for (const r of attached) { const m = rowMatches[r.rowNumber][0]; report.push({ rowNumber: r.rowNumber, name: `${r.first_name} ${r.last_name}`, outcome: `Kept existing ${m.ref_number ?? m.full_name}`, ok: true }); }
      for (let i = 0; i < toImport.length; i++) {
        const r = toImport[i];
        const { rowNumber, errors, ...rest } = r;
        const name = `${r.first_name} ${r.last_name}`;
        const forced = !!createRows[rowNumber] && matchesBlock(rowMatches[rowNumber] ?? []);
        try {
          let newId: string | undefined;
          if (forced) newId = await createPersonnelOverride(rest as Record<string, unknown>, `CSV row ${rowNumber} created anyway`);
          else {
            const { data, error } = await supabase.from("personnel").insert(rest as any).select("id").single();
            if (error) throw error;
            newId = data.id;
            if (rowMatches[rowNumber]) await logCreateAnyway("csv_import", r, rowMatches[rowNumber], `CSV row ${rowNumber} created anyway`, newId);
          }
          successCount++; report.push({ rowNumber, name, outcome: "Created", ok: true });
        } catch (error) {
          failedCount++;
          const m = parseDuplicateError(error);
          report.push({ rowNumber, name, ok: false, outcome: m ? `Not created — matches ${m.ref_number ?? ""} ${m.full_name}`.trim() : (error as Error)?.message ?? "Failed" });
        }
        setProgress(((i + 1) / toImport.length) * 100);
      }
      report.sort((a, b) => a.rowNumber - b.rowNumber);
      setResults({ success: successCount, failed: failedCount, attached: attached.length, rows: report });
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

            {checkingMatches && <p className="text-sm text-muted-foreground">Checking for existing people…</p>}
            {Object.keys(rowMatches).length > 0 && (
              <div className="space-y-2" aria-label="Rows with possible matches">
                <h4 className="font-semibold">Possible matches ({Object.keys(rowMatches).length}) — each keeps the existing person unless you choose Create</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {validation.valid.filter((r) => rowMatches[r.rowNumber]).map((r) => {
                    const m = rowMatches[r.rowNumber]; const blocked = matchesBlock(m);
                    return (
                      <div key={r.rowNumber} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">Row {r.rowNumber}: {r.first_name} {r.last_name}</span>{" "}
                          <span className="font-medium">{createRows[r.rowNumber] ? "· New" : `· Will attach to existing ${m[0]?.ref_number ?? m[0]?.full_name ?? ""}`}</span>
                          <span className="text-muted-foreground"> — {m.slice(0, 2).map((x) => `${x.full_name}${x.ref_number ? ` ${x.ref_number}` : ""} · ${x.reasons.map((y) => REASON_LABEL[y]).join(" · ")}`).join("; ")}</span>
                        </span>
                        <Button size="sm" variant={createRows[r.rowNumber] ? "outline" : "secondary"} onClick={() => setCreateRows((c) => ({ ...c, [r.rowNumber]: false }))}>Use existing</Button>
                        <Button size="sm" variant={createRows[r.rowNumber] ? "secondary" : "outline"} disabled={blocked && !isAdmin} title={blocked && !isAdmin ? "Same phone or email — admin only" : undefined} onClick={() => setCreateRows((c) => ({ ...c, [r.rowNumber]: true }))}>Create anyway</Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={checkingMatches || validation.valid.length === 0}
                className="flex-1"
              >
                Import {validation.valid.filter((r) => !rowMatches[r.rowNumber] || createRows[r.rowNumber]).length} Record(s)
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

            {results.rows.length > 0 && (
              <ul className="max-h-64 overflow-y-auto space-y-1 text-sm" aria-label="Import results by row">
                {results.rows.map((x) => <li key={x.rowNumber} className={x.ok ? "" : "text-destructive"}>Row {x.rowNumber}: {x.name} — {x.outcome}</li>)}
              </ul>
            )}
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
