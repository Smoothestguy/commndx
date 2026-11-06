import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SignaturePad } from '@/components/documents/SignaturePad';
import { CheckCircle2, Loader2 } from 'lucide-react';

type Info = { name: string; location: string; date: string; signed: boolean; stays: { in: string | null; out: string | null }[] };
const blobToBase64 = (b: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(b); });

export default function TimesheetSign() {
  const { token } = useParams();
  const [info, setInfo] = useState<Info | null>(null), [err, setErr] = useState(''), [saving, setSaving] = useState(false), [done, setDone] = useState(false);
  useEffect(() => { supabase.functions.invoke('timesheet-signature', { body: { action: 'info', token } }).then(({ data, error }) => error || data?.error ? setErr('This link is no longer active. / Este enlace ya no está activo.') : setInfo(data)); }, [token]);
  const save = async (blob: Blob) => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('timesheet-signature', { body: { action: 'sign', token, signature_png_base64: await blobToBase64(blob) } });
    setSaving(false);
    if (error || data?.error) setErr('Could not save your signature. Try again. / No se pudo guardar.'); else setDone(true);
  };
  const [y, m, d] = (info?.date || '--').split('-');
  return <main className="min-h-dvh bg-background p-4 flex justify-center"><div className="w-full max-w-md space-y-4">
    <h1 className="text-xl font-semibold">Timesheet signature / Firma de hoja de horas</h1>
    {err ? <p role="alert" className="text-destructive">{err}</p> : !info ? <Loader2 className="animate-spin" /> : done || info.signed ? <p className="flex items-center gap-2 text-primary"><CheckCircle2 className="h-5 w-5" />Signed. Thank you! / ¡Firmado, gracias!</p> : <>
      <div className="rounded-md border p-3 text-sm space-y-1">
        <p className="font-medium">{info.name}</p><p>{info.location}</p><p>{m}/{d}/{y}</p>
        {info.stays.map((s, i) => <p key={i} className="tabular-nums text-muted-foreground">{s.in} – {s.out ?? '…'}</p>)}
      </div>
      <SignaturePad name={info.name} onSave={save} onSkip={() => {}} saving={saving} required description="Sign to confirm your hours for this day. / Firme para confirmar sus horas." />
    </>}
  </div></main>;
}
