import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SignaturePad } from '@/components/documents/SignaturePad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Loader2, PenLine } from 'lucide-react';

type Day = { date: string; stays: { in: string | null; out: string | null }[] };
type Items = { name: string; location: string; onboarding_pending: boolean; phone_last4: string | null; phone_confirmed: boolean; days: Day[] };
const call = async (body: Record<string, unknown>) => { const { data, error } = await supabase.functions.invoke('catchup-link', { body }); if (error || data?.error) throw new Error(data?.error || 'error'); return data; };
const mdy = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
const toB64 = (b: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(b); });

/** Public catch-up page: pick your name from this location, sign your open days, confirm your phone. */
export default function CatchupSign() {
  const { token } = useParams();
  const [q, setQ] = useState(''), [people, setPeople] = useState<{ id: string; name: string; needs_phone?: boolean }[]>([]), [loc, setLoc] = useState('');
  const [pid, setPid] = useState<string | null>(null), [items, setItems] = useState<Items | null>(null), [signed, setSigned] = useState<string[]>([]);
  const [ink, setInk] = useState<string | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [dead, setDead] = useState(false);
  const [phoneMode, setPhoneMode] = useState<'ask' | 'edit' | 'done'>('ask'), [phone, setPhone] = useState('');
  useEffect(() => { if (q.trim().length < 2) { setPeople([]); return; } const t = setTimeout(() => call({ action: 'search', token, q }).then(d => { setPeople(d.people); setLoc(d.location); }).catch(e => e.message === 'Inactive link' ? setDead(true) : setErr('Search failed / Error')), 300); return () => clearTimeout(t); }, [q, token]);
  const pick = async (id: string) => { setBusy(true); setErr(''); try { const d = await call({ action: 'items', token, personnel_id: id }); setPid(id); setItems(d); setSigned([]); setPhoneMode(d.phone_confirmed ? 'done' : 'ask'); } catch { setErr('Could not load / No se pudo cargar'); } setBusy(false); };
  const sign = async (date: string) => { if (!ink) return; setBusy(true); setErr(''); try { await call({ action: 'sign', token, personnel_id: pid, date, signature_png_base64: ink }); setSigned(s => [...s, date]); } catch (e) { setErr((e as Error).message === 'error' ? 'Could not save / No se pudo guardar' : (e as Error).message); } setBusy(false); };
  const savePhone = async (confirm: boolean) => { setBusy(true); setErr(''); try { await call({ action: 'phone', token, personnel_id: pid, ...(confirm ? { confirm: true } : { phone }) }); setPhoneMode('done'); } catch (e) { setErr((e as Error).message === 'error' ? 'Could not save / No se pudo guardar' : (e as Error).message); } setBusy(false); };
  if (dead) return <main className="min-h-dvh p-6 bg-background"><p role="alert">This link is no longer active. / Este enlace ya no está activo.</p></main>;
  const left = items?.days.filter(d => !signed.includes(d.date)) ?? [];
  return <main className="min-h-dvh bg-background p-4 flex justify-center"><div className="w-full max-w-md space-y-4">
    <h1 className="text-xl font-semibold">Catch up / Ponerse al día{loc && <span className="block text-sm font-normal text-muted-foreground">{loc}</span>}</h1>
    {err && <p role="alert" className="text-destructive text-sm">{err}</p>}
    {!items ? <>
      <Input autoFocus aria-label="Search your name" placeholder="Type your name / Escriba su nombre" value={q} onChange={e => setQ(e.target.value)} />
      <ul className="divide-y rounded-md border">{people.map(p => <li key={p.id}><button disabled={busy} className="w-full text-left p-3 min-h-11" onClick={() => void pick(p.id)}><span>{p.name}</span>{p.needs_phone && <span className="ml-2 rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive">No phone / Sin teléfono</span>}</button></li>)}
        {q.trim().length >= 2 && !people.length && <li className="p-3 text-sm text-muted-foreground">No match / Sin resultados</li>}</ul>
    </> : <>
      <div className="flex items-center justify-between rounded-md border p-3"><p className="font-medium">{items.name}</p><Button size="sm" variant="ghost" onClick={() => { setItems(null); setPid(null); setInk(null); setQ(''); }}>Not me / No soy yo</Button></div>
      <section className="space-y-2"><h2 className="font-medium">Phone / Teléfono</h2>
        {phoneMode === 'done' ? <p className="text-sm flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" />Phone confirmed / Confirmado</p>
          : phoneMode === 'ask' && items.phone_last4 ? <div className="space-y-2"><p className="text-sm">Is this your number? / ¿Es su número? <span className="font-mono">(***) ***-{items.phone_last4}</span></p>
            <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void savePhone(true)}>Yes, that's mine / Sí</Button><Button size="sm" variant="outline" onClick={() => setPhoneMode('edit')}>No, change / Cambiar</Button></div></div>
          : <div className="space-y-2">{!items.phone_last4 && <p className="text-sm">No phone number on file — add yours / No hay teléfono registrado — agregue el suyo</p>}<div className="flex gap-2"><Input inputMode="tel" aria-label="Your phone number" placeholder="10-digit number / Número" value={phone} onChange={e => setPhone(e.target.value)} /><Button disabled={busy || phone.replace(/\D/g, '').length < 10} onClick={() => void savePhone(false)}>Save / Guardar</Button></div></div>}
      </section>
      {items.onboarding_pending && <p className="rounded-md border p-3 text-sm">Your onboarding is not finished. Check your texts for the link or ask your supervisor. / Su registro no está completo; revise sus mensajes o pregunte a su supervisor.</p>}
      <section className="space-y-2"><h2 className="font-medium">Timesheets to sign / Hojas por firmar</h2>
        {!left.length ? <p className="text-sm flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" />Nothing left to sign. Thank you! / Nada pendiente, ¡gracias!</p> : <>
          {!ink ? <SignaturePad compact name={items.name} required saving={false} onSkip={() => {}} onSave={async b => setInk(await toB64(b))} description="Sign once, then confirm each day. / Firme una vez y confirme cada día." />
            : <div className="flex items-center justify-between gap-2 rounded-md border p-2"><img src={ink} alt="Your signature" className="h-12 max-w-[60%] object-contain" /><Button size="sm" variant="ghost" disabled={busy} onClick={() => setInk(null)}><PenLine className="h-4 w-4 mr-1" />Redraw / Rehacer</Button></div>}
          <ul className="divide-y rounded-md border">{left.map(d => <li key={d.date} className="flex items-center justify-between gap-2 p-3"><div><p className="font-medium tabular-nums">{mdy(d.date)}</p><p className="text-xs text-muted-foreground tabular-nums">{d.stays.map(s => `${s.in ?? '—'}–${s.out ?? '—'}`).join(', ')}</p></div>
            <Button size="sm" disabled={!ink || busy} aria-label={`Sign ${d.date}`} onClick={() => void sign(d.date)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign / Firmar'}</Button></li>)}</ul>
        </>}
      </section>
    </>}
  </div></main>;
}
