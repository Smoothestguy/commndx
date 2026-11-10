import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Preview = { archive_applicants: number; deactivate_personnel: number; archived_applicants: number; inactive_personnel: number };

/** Manager/admin data hygiene: reversible archive of idle applicants (90d) and deactivation of idle personnel (120d). */
export function DataHygieneCard() {
  const qc = useQueryClient();
  const [exportId, setExportId] = useState<string | null>(null);
  const [exportCount, setExportCount] = useState(0);
  const [confirmation, setConfirmation] = useState('');
  const [exporting, setExporting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compression, setCompression] = useState<{ processed: number; net_bytes_saved: number; failures: string[] } | null>(null);
  const exportArchived = async () => {
    setExporting(true);
    setExportId(null);
    try {
      const { data, error } = await supabase.rpc('export_archived_applicants');
      if (error) throw error;
      const result = data as unknown as { export_id: string; count: number; data: Record<string, Record<string, unknown>[]> };
      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      const summary = workbook.addWorksheet('Export');
      summary.addRow(['Archived applicant export', new Date().toISOString()]);
      summary.addRow(['Applicants', result.count]);
      summary.addRow(['Export reference', result.export_id]);
      // Split large JSON values without silently truncating proof or form answers.
      for (const [name, rows] of Object.entries(result.data)) {
        const sheet = workbook.addWorksheet(name);
        sheet.addRow(['Record ID', 'Field', 'Part', 'Value']);
        for (const row of rows) for (const [key, value] of Object.entries(row)) {
          const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
          for (let start = 0; start < Math.max(text.length, 1); start += 30000) sheet.addRow([String(row.id ?? ''), key, start / 30000 + 1, text.slice(start, start + 30000)]);
        }
        sheet.columns = [{ width: 40 }, { width: 28 }, { width: 8 }, { width: 90 }];
        sheet.getRow(1).font = { bold: true, name: 'Arial' };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
      }
      const bytes = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `archived-applicants-${Date.now()}.xlsx`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setExportCount(result.count); setExportId(result.export_id); setConfirmation('');
      toast.success(`Exported ${result.count} archived applicants`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Export failed'); }
    finally { setExporting(false); }
  };
  const purge = useMutation({
    mutationFn: async () => {
      if (!exportId || confirmation !== 'PURGE') throw new Error('Export and confirm first');
      const { data, error } = await supabase.rpc('purge_archived_applicants', { p_export_id: exportId, p_confirmation: confirmation });
      if (error) throw error;
      return data;
    },
    onSuccess: count => { toast.success(`Purged ${count} archived applicants`); setExportId(null); setConfirmation(''); qc.invalidateQueries(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const preview = useQuery({
    queryKey: ["data-hygiene-preview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("data_hygiene_preview" as never);
      if (error) throw error;
      return data as unknown as Preview;
    },
  });
  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("data_hygiene_run" as never);
      if (error) throw error;
      return data as unknown as { archived_applicants: number; deactivated_personnel: number };
    },
    onSuccess: (r) => {
      toast.success(`Archived ${r.archived_applicants} applicants, deactivated ${r.deactivated_personnel} personnel`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const p = preview.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data hygiene</CardTitle>
        <CardDescription>
          Applicants idle 90+ days who never became personnel are archived; personnel with no assignments, punches or time in 120+ days are set Inactive. Nothing is deleted and both are reversible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {preview.isLoading ? (
          <p className="text-sm text-muted-foreground">Calculating…</p>
        ) : preview.error ? (
          <p className="text-sm text-destructive">{(preview.error as Error).message}</p>
        ) : p ? (
          <div className="text-sm space-y-1" data-testid="hygiene-preview">
            <p>Would archive <strong>{p.archive_applicants}</strong> applicants and deactivate <strong>{p.deactivate_personnel}</strong> personnel.</p>
            <p className="text-muted-foreground">Currently {p.archived_applicants} archived applicants, {p.inactive_personnel} inactive personnel.</p>
          </div>
        ) : null}
        <Button
          size="sm"
          disabled={run.isPending || !p || (p.archive_applicants === 0 && p.deactivate_personnel === 0)}
          onClick={() => { if (confirm("Archive/deactivate the listed records now? This is reversible.")) run.mutate(); }}
        >
          {run.isPending ? "Running…" : "Run now"}
        </Button>
        <div className="border-t pt-3 space-y-3">
          <p className="text-sm font-medium">Archived applicants</p>
          <Button variant="outline" size="sm" disabled={exporting || purge.isPending} onClick={exportArchived}>
            {exporting ? 'Exporting…' : 'Export archived XLSX'}
          </Button>
          {exportId && <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{exportCount} exported. Linked personnel and signed evidence are protected. Purging permanently removes applicant records, applications, messages and tags; stored files are retained.</p>
            <Label htmlFor="purge-confirmation">Confirm the XLSX is saved, then type PURGE</Label>
            <Input id="purge-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
            <Button size="sm" variant="destructive" disabled={!exportCount || confirmation !== 'PURGE' || purge.isPending}
              onClick={() => { if (confirm(`Permanently purge ${exportCount} exported archived applicants? This cannot be undone.`)) purge.mutate(); }}>
              {purge.isPending ? 'Purging…' : 'Purge archived'}
            </Button>
          </div>}
        </div>
        <div className="border-t pt-3 space-y-2">
          <p className="text-sm font-medium">Photo storage</p>
          <Button variant="outline" size="sm" disabled={compressing} onClick={async () => {
            setCompressing(true);
            try {
              const { data, error } = await supabase.functions.invoke('image-compression', { body: { limit: 10 } });
              if (error || data?.error) throw error ?? new Error(data.error);
              setCompression(data); qc.invalidateQueries({ queryKey: ['image-optimizations'] });
            } catch (error) { toast.error(error instanceof Error ? error.message : 'Compression failed'); }
            finally { setCompressing(false); }
          }}>{compressing ? 'Compressing…' : 'Compress sample batch'}</Button>
          {compression && <p data-testid="compression-result" className="text-sm">{compression.processed} images processed · net storage {compression.net_bytes_saved >= 0 ? 'saved' : 'added'} {Math.abs(compression.net_bytes_saved / 1024).toFixed(1)} KB · {compression.failures.length} failures</p>}
        </div>
      </CardContent>
    </Card>
  );
}
