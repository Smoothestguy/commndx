import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SignaturePad } from '@/components/documents/SignaturePad';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, PenLine } from 'lucide-react';

type Stay = { in: string | null; out: string | null };
type Day = { date: string; signed: boolean; stays: Stay[] };
type Info = { name: string; location: string; signed: boolean; days: Day[] };
const blobToBase64 = (b: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(b); });
const mdy = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;

/** One link, one or more dates: draw once, then tap to confirm each date (stored per date like single-day signing). */
export default function TimesheetSign() {
  const { token } = useParams();
  const [info, setInfo] = useState<Info | null>(null), [err, setErr] = useState(''), [saving, setSaving] = useState<string | null>(null);
  const [ink, setInk] = useState<string | null>(null);
  const load = useCallback(() => supabase.functions.invoke('timesheet-signature', { body: { action: 'info', token } }).then(({ data, error }) => error || data?.error ? setErr('This link is no longer active. / Este enlace ya no está activo.') : setInfo(data)), [token]);
  useEffect(() => { void load(); }, [load]);
  const sign = async (date: string) => {
    if (!ink) return;
    setSaving(date); setErr('');
    const { data, error } = await supabase.functions.invoke('timesheet-signature', { body: { action: 'sign', token, date, signature_png_base64: ink } });
    setSaving(null);
    if (error || data?.error) setErr('Could not save your signature. Try again. / No se pudo guardar.');
    else setInfo(i => i && { ...i, days: i.days.map(d => d.date === date ? { ...d, signed: true } : d) });
  };
  const left = info?.days.filter(d => !d.signed) ?? [];
  const allDone = !!info && left.length === 0;
  return <main className="min-h-dvh bg-background p-4 flex justify-center"><div className="w-full max-w-md landscape:max-w-none space-y-4">
    <h1 className="text-xl font-semibold">Timesheet signature / Firma de hoja de horas</h1>
    {err && <p role="alert" className="text-destructive">{err}</p>}
    {!info ? (!err && <Loader2 className="animate-spin" />) : <>
      <div className="rounded-md border p-3 text-sm"><p className="font-medium">{info.name}</p><p>{info.location}</p>
        {info.days.length > 1 && <p className="text-muted-foreground">{info.days.length - left.length} of {info.days.length} days signed / días firmados</p>}</div>
      {allDone ? <p className="flex items-center gap-2 text-primary"><CheckCircle2 className="h-5 w-5" />Signed. Thank you! / ¡Firmado, gracias!</p> : <>
        {!ink ? <SignaturePad compact name={info.name} onSave={async b => setInk(await blobToBase64(b))} onSkip={() => {}} saving={false} required description={left.length > 1 ? 'Sign once, then confirm each day below. / Firme una vez y confirme cada día.' : 'Sign to confirm your hours for this day. / Firme para confirmar sus horas.'} />
          : <div className="flex items-center justify-between gap-2 rounded-md border p-2"><img src={ink} alt="Your signature" className="h-12 max-w-[60%] object-contain" /><Button size="sm" variant="ghost" disabled={!!saving} onClick={() => setInk(null)}><PenLine className="h-4 w-4 mr-1" />Redraw / Rehacer</Button></div>}
      </>}
      <ul className="space-y-2" aria-label="Days to sign">{info.days.map(d => <li key={d.date} className="rounded-md border p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm"><p className="font-medium tabular-nums">{mdy(d.date)}</p>{d.stays.map((s, i) => <p key={i} className="tabular-nums text-muted-foreground">{s.in} – {s.out ?? '…'}</p>)}</div>
        {d.signed ? <span className="flex items-center gap-1 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />Signed / Firmado</span>
          : <Button size="sm" disabled={!ink || !!saving} aria-label={`Confirm and sign ${mdy(d.date)}`} onClick={() => void sign(d.date)}>{saving === d.date ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Confirm {mdy(d.date).slice(0, 5)} / Confirmar</>}</Button>}
      </li>)}</ul>
    </>}
  </div></main>;
}
