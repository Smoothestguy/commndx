import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';
import type { ProjectDocument } from '@/integrations/supabase/hooks/useProjectDocuments';
import { loadDocumentFields } from '@/lib/documentSignFields';
import { linkTemplate, loadSheetSignature, loadSheetStays } from '@/lib/signinTemplateData';
import { generateSigninSheet, localDay, nextDay, rowsForDay, sheetFileName } from '@/lib/signinSheets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Loader2, PenLine } from 'lucide-react';
import { DocumentFieldPlacement } from './DocumentFieldPlacement';
import { toast } from 'sonner';

const save = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); };
export function SigninSheetsPanel({ doc, projectName }: { doc: ProjectDocument; projectName: string }) {
  const [open, setOpen] = useState(false), [placing, setPlacing] = useState(false), [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(() => localDay(new Date().toISOString(), 'America/Chicago')), [to, setTo] = useState(from);
  const { data: locations = [] } = useProjectLocations(doc.project_id);
  const [selected, setSelected] = useState<string[]>(doc.location_ids?.length ? doc.location_ids : doc.location_id ? [doc.location_id] : []);
  const qc = useQueryClient();
  const validRange = !!from && !!to && from <= to && Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`) <= 366 * 86400000;
  const { data: stays = [], isLoading, error } = useQuery({ queryKey: ['signin-sheet-stays', doc.project_id, from, to], enabled: open && validRange, queryFn: () => loadSheetStays(doc.project_id, locations, from, to) });
  const sheets = useMemo(() => {
    if (!validRange) return [];
    const out = [];
    for (const location of locations.filter(l => selected.includes(l.id))) {
      const zone = location.timezone || 'America/Chicago';
      for (let day = from; day <= to; day = nextDay(day)) { const rows = rowsForDay(stays, location.id, day, zone); if (rows.length) out.push({ location, zone, day, rows }); }
    }
    return out;
  }, [locations, selected, stays, from, to, validRange]);
  const download = async (items: typeof sheets, zipName?: string) => {
    if (busy || !items.length) return; setBusy(true);
    try {
      const [{ data, error }, fields] = await Promise.all([supabase.storage.from('project-documents').download(doc.file_path), loadDocumentFields(doc.id)]);
      if (error || !data) throw error || new Error('Template unavailable');
      const original = await data.arrayBuffer();
      const { default: JSZip } = await import('jszip'); const zip = new JSZip();
      for (const sheet of items) {
        const bytes = await generateSigninSheet(original, fields, sheet.rows, { rowsPerPage: doc.rows_per_page ?? 12, rowHeight: doc.row_height_pct ?? 0.045, zone: sheet.zone, day: sheet.day, project: projectName, mission: sheet.location.project_number || '', location: sheet.location.name, address: [sheet.location.address, sheet.location.city, sheet.location.state, sheet.location.zip].filter(Boolean).join(', ') }, loadSheetSignature);
        const filename = sheetFileName(sheet.location.name, sheet.day);
        if (!zipName) save(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), filename);
        else zip.file(`${sheet.location.id.slice(0, 8)}-${filename}`, bytes);
      }
      if (zipName) save(await zip.generateAsync({ type: 'blob' }), zipName);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Sheet generation failed'); } finally { setBusy(false); }
  };
  return <div className="border-t pt-2 space-y-2">
    <div className="flex flex-wrap gap-2"><Badge variant="outline">Sign-in sheet template</Badge><Button size="sm" variant="outline" onClick={() => setPlacing(true)}><PenLine className="h-4 w-4 mr-1" />Place signature fields</Button><Button size="sm" variant="outline" onClick={() => setOpen(true)}><Download className="h-4 w-4 mr-1" />Generate sheets</Button></div>
    {placing && <DocumentFieldPlacement doc={doc} onClose={() => setPlacing(false)} />}
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>Generate sheets — {doc.file_name}</DialogTitle></DialogHeader>
      <div className="flex flex-wrap gap-3"><div><Label htmlFor="sheet-from">From</Label><Input id="sheet-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div><div><Label htmlFor="sheet-to">To</Label><Input id="sheet-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div></div>
      {!validRange && <p role="alert" className="text-destructive">Select a date range of up to one year.</p>}
      <div className="flex flex-wrap gap-3">{locations.map(l => <label key={l.id} className="flex gap-2 items-center min-h-11"><Checkbox checked={selected.includes(l.id)} onCheckedChange={v => setSelected(prev => v ? [...prev, l.id] : prev.filter(id => id !== l.id))} />{l.name}</label>)}</div>
      <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await linkTemplate(doc.id, selected); qc.invalidateQueries({ queryKey: ['project-documents', doc.project_id] }); toast.success('Template locations saved'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to save locations'); } finally { setBusy(false); } }}>Save template locations</Button>
      {busy || isLoading ? <Loader2 aria-label="Preparing sheets" className="animate-spin" /> : error ? <p role="alert" className="text-destructive">Unable to load attendance: {error instanceof Error ? error.message : 'Access denied'}</p> : !sheets.length ? <p className="text-muted-foreground">No stays in the selected locations and dates.</p> : <>
        <div className="flex flex-wrap gap-2 border-b pb-3">{[...new Set(sheets.map(s => s.day))].map(day => <Button key={day} size="sm" variant="outline" onClick={() => download(sheets.filter(s => s.day === day), `signin-${day}.zip`)}>Download day (ZIP) · {day}</Button>)}</div>
        {locations.filter(l => selected.includes(l.id)).map(l => <section key={l.id} className="space-y-2 border-b pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{l.name}</h3><Button size="sm" variant="outline" disabled={!sheets.some(s => s.location.id === l.id)} onClick={() => download(sheets.filter(s => s.location.id === l.id), `${sheetFileName(l.name, from).replace(/\.pdf$/, '')}-to-${to}.zip`)}>Download location (ZIP)</Button></div>
          {sheets.filter(s => s.location.id === l.id).map(sheet => <div key={sheet.day} className="space-y-1"><div className="flex justify-between gap-2 items-center"><h4 className="text-sm font-medium">{sheet.day} · {sheet.zone}</h4><Button size="sm" variant="ghost" onClick={() => download([sheet])}><Download className="h-4 w-4 mr-1" />Download PDF</Button></div>{sheet.rows.map(row => <div key={row.id} className="flex flex-wrap gap-2 items-center text-sm"><span>{row.name}</span><span className="text-muted-foreground">{row.position}</span>{row.offsite && <Badge variant="outline" className="text-warning border-warning">Off-site</Badge>}<span className="ml-auto tabular-nums">{row.hours == null ? 'On site' : `${row.hours.toFixed(2)} h`}</span></div>)}</div>)}
        </section>)}
      </>}
    </DialogContent></Dialog>
  </div>;
}