import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImportPreviewTable, ImportRoomRow } from "./ImportPreviewTable";
import { useBulkImportRooms, RoomScopeSummaryItem } from "@/integrations/supabase/hooks/useProjectRooms";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, FileSpreadsheet, FileImage } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportRoomsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  summaryItems: RoomScopeSummaryItem[];
}

// Map spreadsheet columns to scope keys
const HEADER_MAPPINGS: Record<string, keyof ImportRoomRow> = {
  'carpet': 'carpet',
  'cp-01': 'carpet',
  'h-cp-01': 'carpet',
  'floor tile': 'floor_tile',
  'floor': 'floor_tile',
  'st-01.f': 'floor_tile',
  'h-st-01.f': 'floor_tile',
  'shower floor': 'shower_floor',
  'shr floor': 'shower_floor',
  'st-01.sf': 'shower_floor',
  'h-st-01.sf': 'shower_floor',
  'shower wall': 'shower_wall',
  'shr wall': 'shower_wall',
  'st-01.sw': 'shower_wall',
  'h-st-01.sw': 'shower_wall',
  'trim top': 'trim_top',
  'tl-002': 'trim_top',
  'h-tl-002': 'trim_top',
  'trim side': 'trim_side',
  'tl-003': 'trim_side',
  'h-tl-003': 'trim_side',
  'bath thresh': 'bath_threshold',
  'bath threshold': 'bath_threshold',
  'ts-001': 'bath_threshold',
  'h-ts-001': 'bath_threshold',
  'entry thresh': 'entry_threshold',
  'entry threshold': 'entry_threshold',
  'ts-002': 'entry_threshold',
  'h-ts-002': 'entry_threshold',
  'curb': 'shower_curbs',
  'curbs': 'shower_curbs',
  'shower curb': 'shower_curbs',
  'shower curbs': 'shower_curbs',
};

// Map scope keys to JO line item matching codes
const SCOPE_TO_JO_CODE: Record<string, string[]> = {
  carpet: ['H-CP-01', 'Carpet'],
  floor_tile: ['H-ST-01.F', 'Floor Tile'],
  shower_floor: ['H-ST-01.SF', 'Shower Floor'],
  shower_wall: ['H-ST-01.SW', 'Shower Wall'],
  trim_top: ['H-TL-002', 'Trim Top'],
  trim_side: ['H-TL-003', 'Trim Side'],
  bath_threshold: ['H-TS-001', 'Bath Thresh'],
  entry_threshold: ['H-TS-002', 'Entry Thresh'],
  shower_curbs: ['Curb', 'Shower Curb'],
};

function mapHeader(header: string): keyof ImportRoomRow | null {
  const h = header.trim().toLowerCase();
  for (const [key, field] of Object.entries(HEADER_MAPPINGS)) {
    if (h.includes(key)) return field;
  }
  if (h.includes('unit') || h === 'no' || h === 'no.') return 'unit_number';
  if (h.includes('shower size') || h === 'shower') return 'shower_size';
  if (h.includes('ceiling') || h.includes('height') || h === 'ht') return 'ceiling_height';
  return null;
}

function detectSpecialNotes(showerSize: string): { cleanSize: string; notes: string } {
  let notes = '';
  let cleanSize = showerSize;
  const lower = showerSize.toLowerCase();
  if (lower.includes('double curb')) {
    notes = 'Double Curb';
    cleanSize = cleanSize.replace(/double\s*curb/i, '').trim();
  }
  if (lower.includes('ada')) {
    notes = notes ? `${notes}, ADA` : 'ADA';
    cleanSize = cleanSize.replace(/ada/i, '').trim();
  }
  // Clean up extra commas/spaces
  cleanSize = cleanSize.replace(/^[\s,]+|[\s,]+$/g, '');
  return { cleanSize, notes };
}

function parseSpreadsheet(workbook: XLSX.WorkBook): ImportRoomRow[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });

  if (rawData.length < 2) return [];

  // Find header row (scan first 5 rows for one with 'unit' or 'no')
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const row = rawData[i].map((c: any) => String(c).toLowerCase());
    if (row.some((c: string) => c.includes('unit') || c.includes('carpet') || c.includes('floor'))) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = rawData[headerRowIdx].map((h: any) => String(h));
  const colMap: Record<number, keyof ImportRoomRow> = {};
  headers.forEach((h: string, i: number) => {
    const mapped = mapHeader(h);
    if (mapped) colMap[i] = mapped;
  });

  const dataRows = rawData.slice(headerRowIdx + 1);
  
  // Skip last row if it looks like totals
  const lastRow = dataRows[dataRows.length - 1];
  const isLastRowTotals = lastRow && (
    String(lastRow[0] || '').toLowerCase().includes('total') ||
    String(lastRow[1] || '').toLowerCase().includes('total') ||
    // If unit_number col is empty or non-numeric in last row, likely totals
    (colMap[Object.keys(colMap).find(k => colMap[Number(k)] === 'unit_number') as any] !== undefined &&
     String(lastRow[Object.keys(colMap).find(k => colMap[Number(k)] === 'unit_number') as any] || '').trim() === '')
  );
  
  const rowsToProcess = isLastRowTotals ? dataRows.slice(0, -1) : dataRows;

  const rooms: ImportRoomRow[] = [];
  for (const row of rowsToProcess) {
    const room: ImportRoomRow = {
      unit_number: '', shower_size: '', ceiling_height: null, notes: '',
      carpet: 0, floor_tile: 0, shower_floor: 0, shower_wall: 0,
      trim_top: 0, trim_side: 0, bath_threshold: 0, entry_threshold: 0, shower_curbs: 0,
    };

    for (const [colIdx, field] of Object.entries(colMap)) {
      const val = row[Number(colIdx)];
      if (field === 'unit_number') {
        room.unit_number = String(val || '').trim();
      } else if (field === 'shower_size') {
        const { cleanSize, notes } = detectSpecialNotes(String(val || ''));
        room.shower_size = cleanSize;
        if (notes) room.notes = notes;
      } else if (field === 'ceiling_height') {
        room.ceiling_height = val ? parseInt(String(val)) || null : null;
      } else {
        (room as any)[field] = val ? parseFloat(String(val)) || 0 : 0;
      }
    }

    // Skip empty rows
    if (!room.unit_number) continue;
    rooms.push(room);
  }

  return rooms;
}

export function ImportRoomsDialog({ open, onOpenChange, projectId, summaryItems }: ImportRoomsDialogProps) {
  const [previewRows, setPreviewRows] = useState<ImportRoomRow[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [tab, setTab] = useState('spreadsheet');
  const bulkImport = useBulkImportRooms();

  const handleSpreadsheetUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const rows = parseSpreadsheet(workbook);
      if (rows.length === 0) {
        toast.error('No room data found in file');
        return;
      }
      setPreviewRows(rows);
      toast.success(`Found ${rows.length} rooms`);
    } catch (err) {
      toast.error('Failed to parse file');
      console.error(err);
    }
  }, []);

  const handlePdfImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const { data, error } = await supabase.functions.invoke('extract-room-units', {
        body: { fileBase64: base64, mimeType: file.type },
      });

      if (error) throw error;
      if (!data?.success || !data?.rooms?.length) {
        toast.error('No room data extracted');
        return;
      }

      const rows: ImportRoomRow[] = data.rooms.map((r: any) => {
        const { cleanSize, notes } = detectSpecialNotes(r.shower_size || '');
        return {
          unit_number: String(r.unit_number || ''),
          shower_size: cleanSize,
          ceiling_height: r.ceiling_height || null,
          notes: [notes, r.notes].filter(Boolean).join(', '),
          carpet: r.carpet || 0,
          floor_tile: r.floor_tile || 0,
          shower_floor: r.shower_floor || 0,
          shower_wall: r.shower_wall || 0,
          trim_top: r.trim_top || 0,
          trim_side: r.trim_side || 0,
          bath_threshold: r.bath_threshold || 0,
          entry_threshold: r.entry_threshold || 0,
          shower_curbs: r.shower_curbs || 0,
        };
      });

      setPreviewRows(rows);
      toast.success(`Extracted ${rows.length} rooms`);
    } catch (err) {
      toast.error('AI extraction failed');
      console.error(err);
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleManualEntry = useCallback(() => {
    setPreviewRows([{
      unit_number: '', shower_size: '', ceiling_height: null, notes: '',
      carpet: 0, floor_tile: 0, shower_floor: 0, shower_wall: 0,
      trim_top: 0, trim_side: 0, bath_threshold: 0, entry_threshold: 0, shower_curbs: 0,
    }]);
  }, []);

  const findMatchingLineItem = (scopeKey: string): RoomScopeSummaryItem | undefined => {
    const codes = SCOPE_TO_JO_CODE[scopeKey] || [];
    return summaryItems.find(si => {
      const desc = si.description.toLowerCase();
      return codes.some(c => desc.includes(c.toLowerCase()));
    });
  };

  const handleConfirmImport = async () => {
    const validRows = previewRows.filter(r => r.unit_number.trim());
    if (validRows.length === 0) {
      toast.error('No valid rooms to import');
      return;
    }

    const rooms = validRows.map(row => {
      const unitNum = row.unit_number.trim();
      const floorNumber = unitNum.length >= 3 ? parseInt(unitNum[0]) : undefined;

      const scope_items: Array<{
        job_order_line_item_id: string;
        scope_code: string;
        scope_description: string;
        allocated_quantity: number;
        unit: string;
      }> = [];

      const scopeKeys: (keyof ImportRoomRow)[] = [
        'carpet', 'floor_tile', 'shower_floor', 'shower_wall',
        'trim_top', 'trim_side', 'bath_threshold', 'entry_threshold', 'shower_curbs',
      ];

      for (const key of scopeKeys) {
        const qty = Number(row[key]) || 0;
        if (qty <= 0) continue;

        const match = findMatchingLineItem(key);
        if (!match) continue;

        const codes = SCOPE_TO_JO_CODE[key] || [];
        scope_items.push({
          job_order_line_item_id: match.job_order_line_item_id,
          scope_code: codes[0] || key,
          scope_description: match.description,
          allocated_quantity: qty,
          unit: ['bath_threshold', 'entry_threshold', 'shower_curbs'].includes(key) ? 'each' : 'sqft',
        });
      }

      return {
        unit_number: unitNum,
        floor_number: floorNumber && !isNaN(floorNumber) ? floorNumber : undefined,
        shower_size: row.shower_size || undefined,
        ceiling_height: row.ceiling_height || undefined,
        notes: row.notes || undefined,
        scope_items,
      };
    });

    try {
      await bulkImport.mutateAsync({ projectId, rooms });
      setPreviewRows([]);
      onOpenChange(false);
    } catch (err) {
      // Error toast is handled by the hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Rooms</DialogTitle>
        </DialogHeader>

        {previewRows.length === 0 ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="spreadsheet">
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Spreadsheet
              </TabsTrigger>
              <TabsTrigger value="pdf">
                <FileImage className="h-4 w-4 mr-1" />
                PDF / Image
              </TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>

            <TabsContent value="spreadsheet" className="space-y-4 pt-4">
              <div>
                <Label>Upload Excel or CSV file</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleSpreadsheetUpload}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Headers like "Carpet", "Floor Tile", "Shower Floor", "Trim Top", etc. will be auto-mapped.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="pdf" className="space-y-4 pt-4">
              <div>
                <Label>Upload PDF or Image</Label>
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handlePdfImageUpload}
                  disabled={isExtracting}
                  className="mt-1"
                />
                {isExtracting && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI is extracting room data...
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">Start with a blank table and enter room data manually.</p>
              <Button onClick={handleManualEntry}>Start Manual Entry</Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{previewRows.length} rooms to import</p>
              <Button variant="outline" size="sm" onClick={() => setPreviewRows([])}>
                Start Over
              </Button>
            </div>
            <ImportPreviewTable rows={previewRows} onChange={setPreviewRows} />
          </div>
        )}

        {previewRows.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirmImport} disabled={bulkImport.isPending}>
              {bulkImport.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {previewRows.filter(r => r.unit_number.trim()).length} Rooms
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
