import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PenLine, Type, CalendarDays, X, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ProjectDocument } from '@/integrations/supabase/hooks/useProjectDocuments';
import { loadDocumentFields, saveDocumentFields } from '@/lib/documentSignFields';
import { newSignField, type SignField, type SignFieldKind } from '@/lib/documentStamp';
import { toast } from 'sonner';
import { SIGN_BINDINGS } from '@/lib/documentStamp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';

function PlacementPage({ page, fields, kind, disabled, onAdd, onMove, onDelete, onResize, selected, onSelect, ghostCount, rowHeight }: { onResize: (id: string, w: number, h: number) => void; selected: string | null; onSelect: (id: string) => void; ghostCount: number; rowHeight: number; page: PDFPageProxy; fields: SignField[]; kind: SignFieldKind; disabled: boolean; onAdd: (f: SignField) => void; onMove: (id: string, x: number, y: number) => void; onDelete: (id: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0), [error, setError] = useState('');
  const viewport = page.getViewport({ scale: 1 });
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!element || !width) return;
    const context = element.getContext('2d'); if (!context) return;
    const view = page.getViewport({ scale: width / viewport.width * Math.min(window.devicePixelRatio || 1, 2) });
    element.width = view.width; element.height = view.height;
    const task = page.render({ canvasContext: context, viewport: view });
    task.promise.catch(e => { if (e.name !== 'RenderingCancelledException') setError('Unable to render this page'); });
    return () => task.cancel();
  }, [page, width, viewport.width]);
  const drag = useRef<{ id: string; dx: number; dy: number; resize?: boolean; w?: number; h?: number } | null>(null);
  return <section className="mx-auto w-full max-w-4xl space-y-1">
    <p className="text-xs text-muted-foreground">Page {page.pageNumber}</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div ref={container} data-placement-page={page.pageNumber} className="relative w-full border bg-muted" style={{ aspectRatio: `${viewport.width}/${viewport.height}` }} onClick={e => {
      if (disabled || e.target !== canvas.current) return;
      const bounds = e.currentTarget.getBoundingClientRect();
      onAdd(newSignField(page.pageNumber, e.clientX - bounds.left, e.clientY - bounds.top, bounds.width, bounds.height, kind));
    }}>
      <canvas ref={canvas} className="block w-full h-full" />
      {fields.filter(f => f.scope === 'row').flatMap(f => Array.from({ length: Math.max(0, ghostCount - 1) }, (_, i) => ({ ...f, ghostY: f.y_pct + (i + 1) * rowHeight, ghostIndex: i }))).filter(f => f.ghostY + (f.h_pct ?? rowHeight) <= 1).map(f => <div key={`${f.id}-ghost-${f.ghostIndex}`} className="absolute border border-dashed border-primary/30 bg-primary/5 pointer-events-none" style={{ left: `${f.x_pct * 100}%`, top: `${f.ghostY * 100}%`, width: `${f.w_pct * 100}%`, height: `${(f.h_pct ?? rowHeight) * 100}%` }} />)}
      {fields.map(f => <div key={f.id} role="group" aria-label={`${f.kind} field on page ${page.pageNumber}`} className="absolute border-2 border-primary bg-primary/15 text-primary cursor-move touch-none select-none flex items-center justify-center" style={{ left: `${f.x_pct * 100}%`, top: `${f.y_pct * 100}%`, width: `${f.w_pct * 100}%`, height: f.h_pct ? `${f.h_pct * 100}%` : undefined, aspectRatio: f.h_pct ? undefined : '3/1' }} onPointerDown={e => {
        if (disabled || (e.target as HTMLElement).closest('button')) return;
        onSelect(f.id);
        const bounds = e.currentTarget.parentElement?.getBoundingClientRect(); if (!bounds) return;
        drag.current = { id: f.id, dx: e.clientX - bounds.left - f.x_pct * bounds.width, dy: e.clientY - bounds.top - f.y_pct * bounds.height };
        e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation();
      }} onPointerMove={e => {
        const active = drag.current; if (!active || active.id !== f.id) return;
        const bounds = e.currentTarget.parentElement?.getBoundingClientRect(); if (!bounds) return;
        if (active.resize) { onResize(f.id, Math.max(0.02, Math.min(1 - f.x_pct, (active.w ?? f.w_pct) + (e.clientX - active.dx) / bounds.width)), Math.max(0.01, Math.min(1 - f.y_pct, (active.h ?? 0.04) + (e.clientY - active.dy) / bounds.height))); return; }
        onMove(f.id, Math.max(0, Math.min(1 - f.w_pct, (e.clientX - bounds.left - active.dx) / bounds.width)), Math.max(0, Math.min(1 - (f.h_pct ?? f.w_pct * bounds.width / (3 * bounds.height)), (e.clientY - bounds.top - active.dy) / bounds.height)));
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <span className="text-xs font-medium truncate px-1">{(f.binding || f.kind).replaceAll('_', ' ')}</span>
        <Button type="button" size="icon" variant="outline" className="absolute -right-1 -bottom-1 h-8 w-8 touch-none" aria-label={`Resize ${f.binding || f.kind} field`} onPointerDown={e => { e.stopPropagation(); onSelect(f.id); drag.current = { id: f.id, resize: true, dx: e.clientX, dy: e.clientY, w: f.w_pct, h: f.h_pct ?? f.w_pct * viewport.width / (3 * viewport.height) }; e.currentTarget.parentElement?.setPointerCapture(e.pointerId); }}><span aria-hidden>↘</span></Button>
        <Button type="button" size="icon" variant="secondary" className="absolute -right-2 -top-2 h-6 w-6" title="Delete field" aria-label={`Delete ${f.kind} field`} disabled={disabled} onClick={e => { e.stopPropagation(); onDelete(f.id); }}><X className="h-3 w-3" /></Button>
      </div>)}
    </div>
  </section>;
}

export function DocumentFieldPlacement({ doc, onClose }: { doc: ProjectDocument; onClose: () => void }) {
  const [pages, setPages] = useState<PDFPageProxy[]>([]), [fields, setFields] = useState<SignField[]>([]), [kind, setKind] = useState<SignFieldKind>('signature');
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null), [binding, setBinding] = useState('signature'), [scope, setScope] = useState('header');
  const [rowMode, setRowMode] = useState(!!doc.is_signin_template), [rowCount, setRowCount] = useState(doc.rows_per_page ?? 12), [rowHeight, setRowHeight] = useState(doc.row_height_pct ?? 0.045);
  const activeField = fields.find(f => f.id === selected);
  const patchActive = (patch: Partial<SignField>) => setFields(prev => prev.map(f => f.id === selected ? { ...f, ...patch } : f));
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true; let pdf: PDFDocumentProxy | undefined;
    (async () => {
      const [pdfjs, saved, file] = await Promise.all([import('pdfjs-dist'), loadDocumentFields(doc.id), supabase.storage.from('project-documents').download(doc.file_path)]);
      if (file.error || !file.data) throw file.error || new Error('PDF unavailable');
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      pdf = await pdfjs.getDocument({ data: await file.data.arrayBuffer(), isEvalSupported: false }).promise;
      const loaded = await Promise.all(Array.from({ length: pdf.numPages }, (_, i) => pdf?.getPage(i + 1)));
      if (active) { setPages(loaded.filter((p): p is PDFPageProxy => !!p)); setFields(saved); }
      else await pdf.destroy();
    })().catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load PDF'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; void pdf?.destroy(); };
  }, [doc.id, doc.file_path]);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (rowMode && (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 100 || rowHeight <= 0 || rowHeight > 1 || fields.some(f => f.scope === 'row' && f.y_pct + (rowCount - 1) * rowHeight + (f.h_pct ?? rowHeight) > 1.00001))) throw new Error('Row bands extend beyond the page. Reduce rows or row height.');
      await saveDocumentFields(doc.id, fields);
      const { error } = await supabase.from('project_documents').update({ rows_per_page: rowCount, row_height_pct: rowHeight }).eq('id', doc.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['project-documents', doc.project_id] }); toast.success('Signature fields saved'); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to save fields'); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="w-screen max-w-none h-[100dvh] rounded-none p-0 gap-0 flex flex-col" onEscapeKeyDown={e => { if (saving) e.preventDefault(); }} onInteractOutside={e => e.preventDefault()}>
    <DialogHeader className="px-4 py-4 pr-12 border-b"><DialogTitle className="break-words">Place signature fields — {doc.file_name}</DialogTitle><DialogDescription>Tap where each person should sign</DialogDescription></DialogHeader>
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b">
      {([{ value: 'signature', label: 'Signature', Icon: PenLine }, { value: 'name', label: 'Name', Icon: Type }, { value: 'date', label: 'Date', Icon: CalendarDays }] as const).map(({ value, label, Icon }) => <Button key={value} size="sm" variant={kind === value ? 'default' : 'outline'} aria-pressed={kind === value} disabled={saving} onClick={() => setKind(value)}><Icon className="h-4 w-4 mr-1" />{label}</Button>)}
      <Button className="ml-auto" size="sm" disabled={loading || !!error || saving} onClick={save}>{saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Save</Button>
    </div>
    <div className="flex flex-wrap gap-3 px-4 py-2 border-b items-end">
      <div className="w-48"><Label>Binding</Label><Select value={activeField?.binding || binding} onValueChange={v => { setBinding(v); const k = v === 'signature' ? 'signature' : v === 'date' ? 'date' : 'name'; setKind(k); patchActive({ binding: v, kind: k }); }}><SelectTrigger aria-label="Field binding"><SelectValue /></SelectTrigger><SelectContent>{SIGN_BINDINGS.map(v => <SelectItem key={v} value={v}>{v.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Scope</Label><div className="flex">{['header', 'row'].map(v => <Button key={v} size="sm" variant={(activeField?.scope || scope) === v ? 'default' : 'outline'} onClick={() => { setScope(v); patchActive({ scope: v }); }}>{v === 'header' ? 'Header' : 'Row'}</Button>)}</div></div>
      <Button size="sm" variant={rowMode ? 'default' : 'outline'} aria-pressed={rowMode} onClick={() => { setRowMode(!rowMode); setScope('row'); }}>Row band</Button>
      {rowMode && <><div className="w-24"><Label>Rows/page</Label><Input aria-label="Rows per page" type="number" min={1} max={100} value={rowCount} onChange={e => setRowCount(Number(e.target.value))} /></div><div className="w-32"><Label>Row height (%)</Label><Input aria-label="Row height percent" type="number" min={0.1} max={100} step={0.1} value={Number((rowHeight * 100).toFixed(3))} onChange={e => setRowHeight(Number(e.target.value) / 100)} /></div></>}
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
      {loading ? <Loader2 aria-label="Loading PDF" className="animate-spin mx-auto" /> : error ? <p role="alert" className="text-destructive">{error}</p> : pages.map(page => <PlacementPage key={page.pageNumber} page={page} fields={fields.filter(f => f.page === page.pageNumber)} kind={kind} disabled={saving} selected={selected} onSelect={setSelected} ghostCount={rowMode ? rowCount : 1} rowHeight={rowHeight} onResize={(id, w, h) => setFields(prev => prev.map(f => f.id === id ? { ...f, w_pct: w, h_pct: h } : f))} onAdd={f => { const next = { ...f, binding, scope, h_pct: rowMode ? rowHeight * 0.8 : f.w_pct * page.getViewport({ scale: 1 }).width / (3 * page.getViewport({ scale: 1 }).height) }; setFields(prev => [...prev, next]); setSelected(next.id); }} onMove={(id, x, y) => setFields(prev => prev.map(f => f.id === id ? { ...f, x_pct: x, y_pct: y } : f))} onDelete={id => setFields(prev => prev.filter(f => f.id !== id))} />)}
    </div>
  </DialogContent></Dialog>;
}