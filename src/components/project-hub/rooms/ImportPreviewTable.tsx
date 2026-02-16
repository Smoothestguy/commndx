import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export interface ImportRoomRow {
  unit_number: string;
  shower_size: string;
  ceiling_height: number | null;
  notes: string;
  carpet: number;
  floor_tile: number;
  shower_floor: number;
  shower_wall: number;
  trim_top: number;
  trim_side: number;
  bath_threshold: number;
  entry_threshold: number;
  shower_curbs: number;
}

interface ImportPreviewTableProps {
  rows: ImportRoomRow[];
  onChange: (rows: ImportRoomRow[]) => void;
}

const SCOPE_FIELDS: { key: keyof ImportRoomRow; label: string }[] = [
  { key: 'carpet', label: 'Carpet' },
  { key: 'floor_tile', label: 'Floor Tile' },
  { key: 'shower_floor', label: 'Shr Floor' },
  { key: 'shower_wall', label: 'Shr Wall' },
  { key: 'trim_top', label: 'Trim Top' },
  { key: 'trim_side', label: 'Trim Side' },
  { key: 'bath_threshold', label: 'Bath Thr' },
  { key: 'entry_threshold', label: 'Entry Thr' },
  { key: 'shower_curbs', label: 'Curbs' },
];

export function ImportPreviewTable({ rows, onChange }: ImportPreviewTableProps) {
  const updateRow = (idx: number, field: keyof ImportRoomRow, value: string) => {
    const updated = [...rows];
    const row = { ...updated[idx] };
    if (['carpet', 'floor_tile', 'shower_floor', 'shower_wall', 'trim_top', 'trim_side', 'bath_threshold', 'entry_threshold', 'shower_curbs', 'ceiling_height'].includes(field)) {
      (row as any)[field] = value === '' ? 0 : parseFloat(value) || 0;
    } else {
      (row as any)[field] = value;
    }
    updated[idx] = row;
    onChange(updated);
  };

  const deleteRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    onChange([...rows, {
      unit_number: '', shower_size: '', ceiling_height: null, notes: '',
      carpet: 0, floor_tile: 0, shower_floor: 0, shower_wall: 0,
      trim_top: 0, trim_side: 0, bath_threshold: 0, entry_threshold: 0, shower_curbs: 0,
    }]);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border overflow-auto max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px] sticky top-0 bg-background">Unit</TableHead>
              <TableHead className="w-[90px] sticky top-0 bg-background">Shower</TableHead>
              <TableHead className="w-[50px] sticky top-0 bg-background">Ht</TableHead>
              {SCOPE_FIELDS.map(f => (
                <TableHead key={f.key} className="w-[70px] text-right text-xs sticky top-0 bg-background">{f.label}</TableHead>
              ))}
              <TableHead className="w-[100px] sticky top-0 bg-background">Notes</TableHead>
              <TableHead className="w-[40px] sticky top-0 bg-background" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell className="p-1">
                  <Input
                    className="h-7 text-xs"
                    value={row.unit_number}
                    onChange={e => updateRow(idx, 'unit_number', e.target.value)}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    className="h-7 text-xs"
                    value={row.shower_size}
                    onChange={e => updateRow(idx, 'shower_size', e.target.value)}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    className="h-7 text-xs w-12"
                    type="number"
                    value={row.ceiling_height ?? ''}
                    onChange={e => updateRow(idx, 'ceiling_height', e.target.value)}
                  />
                </TableCell>
                {SCOPE_FIELDS.map(f => (
                  <TableCell key={f.key} className="p-1">
                    <Input
                      className="h-7 text-xs text-right w-16"
                      type="number"
                      step="0.01"
                      value={(row as any)[f.key] || ''}
                      onChange={e => updateRow(idx, f.key, e.target.value)}
                    />
                  </TableCell>
                ))}
                <TableCell className="p-1">
                  <Input
                    className="h-7 text-xs"
                    value={row.notes}
                    onChange={e => updateRow(idx, 'notes', e.target.value)}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteRow(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" onClick={addRow}>+ Add Row</Button>
    </div>
  );
}
