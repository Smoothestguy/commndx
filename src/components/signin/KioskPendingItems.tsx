import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SignaturePad } from '@/components/documents/SignaturePad';
import { localTime } from '@/lib/signinSheets';
import { locationTimeIso } from '@/lib/manualTime';
import { Loader2 } from 'lucide-react';
import { usePublicLang } from '@/lib/publicLang';
type Item = { id: string; type: 'signature' | 'checkout' | 'late'; date: string; in_at: string; out_at: string | null; requested?: boolean };
export function KioskPendingItems({ token, proof, zone, onDone }: { token: string; proof: string; zone: string; onDone: () => void }) {
  const { tr } = usePublicLang();
  const [items, setItems] = useState<Item[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selected, setSelected] = useState<Item | null>(null), [date, setDate] = useState(''), [time, setTime] = useState(''), [reason, setReason] = useState('');
  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('kiosk-signature', { body: { token, proof, ...body } });
    if (error) { const response = 'context' in error ? error.context as Response : null; const detail = await response?.json().catch(() => null); throw new Error(detail?.error || tr('Could not load or save items. Ask your supervisor.', 'No se pudo cargar o guardar. Consulta al supervisor.')); }
    if (!data?.ok) throw new Error(data?.error || 'Unavailable'); return data;
  };
  const load = async () => { const data = await invoke({ action: 'pending' }); setItems(data.items); if (!data.items.length) onDone(); };
  useEffect(() => { let active = true; void load().catch(e => active && setError(e.message)).finally(() => active && setLoading(false)); const timer = setTimeout(onDone, 60000); return () => { active = false; clearTimeout(timer); }; }, [proof]);
  const select = (item: Item) => { setSelected(item); setDate(item.date); setTime(''); setReason(''); setError(''); };
  const save = async (blob?: Blob) => {
    if (!selected || busy) return; setBusy(true); setError('');
    try {
      const signature = blob ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); }) : undefined;
      await invoke({ action: 'complete', kind: selected.type, stay_id: selected.id, signature, reason: reason.trim() || undefined, out_at: selected.type === 'checkout' ? locationTimeIso(date, time, zone) : undefined, confirm: selected.type === 'checkout' });
      setSelected(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  return <section aria-label="Pending items" className="space-y-4 mt-6 border-t pt-6">
    <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-semibold">{tr('You still need to…', 'Todavía necesitas…')}</h2><Button variant="outline" disabled={busy} onClick={onDone}>{tr('Skip', 'Omitir')}</Button></div>
    {loading ? <Loader2 className="animate-spin" /> : selected ? <>
      <Button variant="ghost" disabled={busy} onClick={() => setSelected(null)}>{tr('Back to items', 'Volver')}</Button>
      <h3 className="font-medium">{selected.date} · {localTime(selected.in_at, zone)}</h3>
      {selected.type === 'signature' ? <SignaturePad compact name={selected.date} description={tr('Sign this day’s timesheet', 'Firma la hoja de este día')} required saving={busy} onSkip={onDone} onSave={blob => void save(blob)} /> : <div className="space-y-3">
        {selected.type === 'checkout' && <><div><Label htmlFor="pending-out-day">{tr('Check-out date', 'Fecha de salida')}</Label><Input id="pending-out-day" type="date" value={date} min={selected.date} onChange={e => setDate(e.target.value)} /></div><div><Label htmlFor="pending-out-time">{tr('Check-out time', 'Hora de salida')}</Label><Input id="pending-out-time" type="time" value={time} onChange={e => setTime(e.target.value)} /></div><p className="text-sm text-warning">{tr('Confirm your actual check-out. Supervisor review required.', 'Confirma tu salida real. Requiere revisión del supervisor.')}</p></>}
        <Label htmlFor="pending-reason">{selected.type === 'late' ? tr('Late reason', 'Motivo de llegada tarde') : tr('Correction reason', 'Motivo de corrección')}</Label><Textarea id="pending-reason" maxLength={200} value={reason} onChange={e => setReason(e.target.value)} />
        <Button disabled={busy || !reason.trim() || (selected.type === 'checkout' && !locationTimeIso(date, time, zone))} onClick={() => void save()}>{selected.type === 'checkout' ? tr('Confirm check-out', 'Confirmar salida') : tr('Save reason', 'Guardar motivo')}</Button>
      </div>}
    </> : <ul className="divide-y">{items.map(item => <li key={`${item.type}:${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{item.date} · {item.type === 'signature' ? tr(item.requested ? 'Pending signature request' : 'Sign this day', item.requested ? 'Solicitud de firma pendiente' : 'Firma este día') : item.type === 'checkout' ? tr('Forgotten check-out', 'Salida olvidada') : tr('Add late reason', 'Añade motivo de llegada tarde')}</span><Button variant="outline" onClick={() => select(item)}>{item.type === 'signature' ? tr('Sign now', 'Firmar ahora') : tr('Complete', 'Completar')}</Button></li>)}</ul>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}