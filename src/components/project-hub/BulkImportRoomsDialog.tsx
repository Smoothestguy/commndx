import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAddRoom, useJobOrderRemainingQuantities, RemainingQuantity } from "@/integrations/supabase/hooks/useProjectRooms";
import { Loader2, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

interface ParsedRow {
  unit_number: string;
  floor_number?: number;
  mappings: { column: string; value: number; matchedLineItemId?: string; matchedDescription?: string }[];
}

// Keyword mapping for column headers to JO line item descriptions
const COLUMN_KEYWORDS: Record<string, string[]> = {
  carpet: ["carpet"],
  floor_tile: ["floor tile", "floor_tile", "floortile", "tile floor"],
  wall_tile: ["wall tile", "wall_tile", "walltile", "tile wall"],
  shower_floor: ["shower floor", "shower_floor", "showerfloor"],
  base: ["base", "baseboard"],
  threshold: ["threshold", "thresholds"],
  trim: ["trim"],
};

function matchColumnToLineItem(columnName: string, lineItems: RemainingQuantity[]): RemainingQuantity | undefined {
  const lower = columnName.toLowerCase().trim();

  for (const [, keywords] of Object.entries(COLUMN_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      // Find matching line item
      return lineItems.find((li) => {
        const desc = li.description.toLowerCase();
        return keywords.some((kw) => desc.includes(kw));
      });
    }
  }

  // Direct description match fallback
  return lineItems.find((li) => li.description.toLowerCase().includes(lower));
}

export function BulkImportRoomsDialog({ open, onOpenChange, projectId }: Props) {
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columnMappings, setColumnMappings] = useState<Map<string, { lineItemId: string; description: string }>>(new Map());
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const addRoom = useAddRoom();
  const { data: remainingQuantities } = useJobOrderRemainingQuantities(projectId);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target?.result, { type: "binary" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

          if (jsonData.length === 0) {
            toast.error("No data found in file");
            return;
          }

          const headers = Object.keys(jsonData[0]);
          const unitCol = headers.find((h) =>
            ["unit", "unit_number", "unit number", "room", "room_number"].includes(h.toLowerCase().trim())
          );

          if (!unitCol) {
            toast.error('No "unit_number" column found in the file');
            return;
          }

          // Map columns to line items
          const mappings = new Map<string, { lineItemId: string; description: string }>();
          const scopeColumns = headers.filter((h) => h !== unitCol);

          scopeColumns.forEach((col) => {
            if (!remainingQuantities) return;
            const match = matchColumnToLineItem(col, remainingQuantities);
            if (match) {
              mappings.set(col, { lineItemId: match.line_item_id, description: match.description });
            }
          });

          setColumnMappings(mappings);

          // Parse rows
          const rows: ParsedRow[] = jsonData
            .filter((row) => row[unitCol])
            .map((row) => {
              const unitNumber = String(row[unitCol]).trim();
              const floorNumber = unitNumber.length >= 3 ? parseInt(unitNumber.charAt(0)) : undefined;

              const rowMappings = scopeColumns
                .map((col) => {
                  const val = parseFloat(row[col]);
                  const mapping = mappings.get(col);
                  return {
                    column: col,
                    value: isNaN(val) ? 0 : val,
                    matchedLineItemId: mapping?.lineItemId,
                    matchedDescription: mapping?.description,
                  };
                })
                .filter((m) => m.value > 0);

              return { unit_number: unitNumber, floor_number: floorNumber, mappings: rowMappings };
            });

          setParsedData(rows);
        } catch (err) {
          toast.error("Failed to parse file");
        }
      };
      reader.readAsBinaryString(file);
    },
    [remainingQuantities]
  );

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsImporting(true);

    try {
      for (const row of parsedData) {
        const scopeItems = row.mappings
          .filter((m) => m.matchedLineItemId && m.value > 0)
          .map((m) => ({
            job_order_line_item_id: m.matchedLineItemId!,
            allocated_quantity: m.value,
          }));

        await addRoom.mutateAsync({
          project_id: projectId,
          unit_number: row.unit_number,
          floor_number: row.floor_number ?? null,
          scope_items: scopeItems,
        });
      }
      toast.success(`Imported ${parsedData.length} rooms`);
      onOpenChange(false);
      setParsedData([]);
      setFileName("");
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const unmatchedColumns = parsedData.length > 0
    ? [...new Set(parsedData.flatMap((r) => r.mappings.filter((m) => !m.matchedLineItemId).map((m) => m.column)))]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Rooms</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Upload CSV or Excel File</Label>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
            <p className="text-xs text-muted-foreground">
              Expected columns: unit_number, carpet_yards, floor_tile_sqft, wall_tile_sqft, shower_floor_sqft, base_lf, thresholds
            </p>
          </div>

          {unmatchedColumns.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded border border-border bg-muted text-sm">
              <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Unmatched columns:</p>
                <p className="text-muted-foreground">{unmatchedColumns.join(", ")} — these won't be imported.</p>
              </div>
            </div>
          )}

          {parsedData.length > 0 && (
            <>
              <div className="text-sm font-medium">
                Preview: {parsedData.length} rooms to import
              </div>
              <div className="max-h-[300px] overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit #</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Scope Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.unit_number}</TableCell>
                        <TableCell>{row.floor_number ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {row.mappings
                            .filter((m) => m.matchedLineItemId)
                            .map((m) => `${m.value} ${m.matchedDescription || m.column}`)
                            .join(", ") || "No matches"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedData.length > 50 && (
                <p className="text-xs text-muted-foreground">Showing first 50 of {parsedData.length} rows</p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={parsedData.length === 0 || isImporting}
          >
            {isImporting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Import {parsedData.length} Rooms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
