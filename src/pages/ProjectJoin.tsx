import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { joinFormSchema, joinInfoSchema, joinResultSchema, joinToken } from '@/lib/projectJoin';
import { ForceDarkTheme } from '@/components/ForceDarkTheme';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LangSwitcher, usePublicLang } from '@/lib/publicLang';
import { AlertCircle, CheckCircle2, Loader2, Phone, UserPlus } from 'lucide-react';

export default function ProjectJoin() {
  const { token = '' } = useParams();
  // Keying the experience resets person-specific success if the URL changes.
  return <JoinExperience key={token} token={token} />;
}
function JoinExperience({ token }: { token: string }) {
  const { tr, pick } = usePublicLang();
  const validToken = joinToken.safeParse(token).success;
  const info = useQuery({ queryKey: ['public-join', token], enabled: validToken, retry: 1, refetchOnWindowFocus: true, queryFn: async () => {
    const { data, error } = await supabase.rpc('get_join_info', { p_token: token });
    if (error) throw error;
    return joinInfoSchema.parse(data);
  } });
  const [form, setForm] = useState({ first: '', last: '', phone: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false), [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState<ReturnType<typeof joinResultSchema.parse> | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const agency = info.data?.valid ? info.data.agency_name?.trim() : undefined;
  const site = info.data?.location_name?.trim() || info.data?.project_name;
  const secondaryProject = info.data?.location_name?.trim() ? info.data.project_name : undefined;
  const submitting = useRef(false);
  const field = (key: keyof typeof form, value: string) => { setForm(v => ({ ...v, [key]: value })); setErrors(e => ({ ...e, [key]: '' })); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (submitting.current) return;
    const parsed = joinFormSchema.safeParse(form);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), pick(i.message)]))); return; }
    submitting.current = true; setBusy(true); setErrors({});
    try {
      const { data, error } = await supabase.rpc('join_project', { p_token: token, p_first: parsed.data.first, p_last: parsed.data.last, p_phone: parsed.data.phone, ...(parsed.data.email ? { p_email: parsed.data.email } : {}) });
      if (error) throw error;
      const result = joinResultSchema.parse(data);
      if (!result.ok) {
        if (result.reason === 'invalid') setInvalid(true);
        else if (result.reason === 'already_on_project') setDone(result);
        else if (result.reason === 'phone_required') setErrors({ phone: pick('Enter a 10-digit mobile number / Escribe un número móvil de 10 dígitos') });
        else if (result.reason === 'name_required') setErrors({ first: pick('First and last name required / Nombre y apellido obligatorios'), last: pick('First and last name required / Nombre y apellido obligatorios') });
        else setErrors({ form: pick('Unable to register. Call the office. / No se pudo registrar. Llama a la oficina.') });
      } else setDone(result);
    } catch { setErrors({ form: tr('Unable to register. Check your connection and try again.', 'No se pudo registrar. Revisa tu conexión e intenta otra vez.') }); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <main className="min-h-dvh bg-background text-foreground px-5 py-10 flex flex-col items-center justify-center">
    <ForceDarkTheme /><LangSwitcher /><SEO title="Join project" description="Register for your Fairfield Response Group project." noIndex />
    <div className="w-full max-w-md space-y-7">
      {agency ? <header className="space-y-3">
        {info.data?.agency_logo_url && !logoFailed && <img src={info.data.agency_logo_url} alt={`${agency} logo`} referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} className="max-h-16 max-w-56 object-contain" />}
        <h1 className="text-2xl font-semibold break-words">{agency} — {tr('Register to work:', 'Regístrate para trabajar:')} {site}</h1>
        {secondaryProject && <p className="text-sm text-muted-foreground break-words">{secondaryProject}</p>}
      </header> : !info.isLoading && <p className="text-sm font-semibold text-muted-foreground">FAIRFIELD RESPONSE GROUP</p>}
      {!agency && info.data?.valid && !invalid && <header className="space-y-2"><h1 className="text-2xl font-semibold break-words">{site}</h1>{secondaryProject && <p className="text-sm text-muted-foreground break-words">{secondaryProject}</p>}</header>}
      {!validToken || invalid || (info.data && !info.data.valid) ? <div className="space-y-5 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-warning" /><h1 className="text-2xl font-semibold">{tr('Link expired or unavailable', 'Enlace vencido o no disponible')}</h1><p className="text-muted-foreground">{tr('Call the office.', 'Llama a la oficina.')}</p><Button asChild size="lg" className="w-full min-h-14"><a href="tel:+12817483832"><Phone className="h-5 w-5 mr-2" />(281) 748-3832</a></Button>
      </div> : info.isLoading ? <div role="status" className="flex items-center justify-center gap-2 py-12"><Loader2 className="h-6 w-6 animate-spin" />{tr('Loading…', 'Cargando…')}</div> : info.error ? <div role="alert" className="space-y-4"><p>{tr('Unable to load this project.', 'No se pudo cargar el proyecto.')}</p><Button variant="outline" onClick={() => info.refetch()}>{tr('Try again', 'Reintentar')}</Button></div> : done ? <div role="status" className="space-y-5 text-center">
        <CheckCircle2 className="h-14 w-14 mx-auto text-success" />{done.reason === 'already_on_project' ? <><h1 className="text-2xl font-semibold">{tr("You're already registered on this project.", 'Ya estás registrado en este proyecto.')}</h1><p className="text-muted-foreground">{tr('Use the check-in link we texted you, or ask your supervisor to resend it.', 'Usa el enlace de entrada que te enviamos por mensaje o pide a tu supervisor que lo reenvíe.')}</p></> : <><h1 className="text-2xl font-semibold">{tr('Request submitted ✓', 'Solicitud enviada ✓')}</h1><p className="text-muted-foreground">{tr("Your supervisor will approve you. You'll get a text with your check-in link.", 'Tu supervisor aprobará tu solicitud. Recibirás un mensaje con tu enlace de entrada.')}</p></>}
      </div> : <><header className="space-y-2">{!agency && <p className="text-muted-foreground">{tr('Register to work this project', 'Regístrate para trabajar en este proyecto')}</p>}{info.data?.role_label && <p className="text-sm">{info.data.role_label}</p>}</header>
        <form onSubmit={submit} noValidate className="space-y-5">
          {(['first', 'last', 'phone', 'email'] as const).map(key => <div key={key} className="space-y-2"><Label htmlFor={`join-${key}`}>{pick(({ first: 'First name / Nombre', last: 'Last name / Apellido', phone: 'Mobile phone / Teléfono móvil', email: 'Email (optional) / Correo (opcional)' })[key])}{key !== 'email' ? ' *' : ''}</Label><Input id={`join-${key}`} type={key === 'phone' ? 'tel' : key === 'email' ? 'email' : 'text'} inputMode={key === 'phone' ? 'numeric' : key === 'email' ? 'email' : 'text'} autoComplete={key === 'first' ? 'given-name' : key === 'last' ? 'family-name' : key === 'phone' ? 'tel' : 'email'} required={key !== 'email'} maxLength={key === 'email' ? 120 : key === 'phone' ? 25 : 60} value={form[key]} disabled={busy} onChange={e => field(key, e.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `join-${key}-error` : undefined} className="h-12 text-base" />{errors[key] && <p id={`join-${key}-error`} role="alert" className="text-sm text-destructive">{errors[key]}</p>}</div>)}
          {errors.form && <p role="alert" className="text-sm text-destructive">{errors.form}</p>}
          <Button type="submit" size="lg" disabled={busy} className="w-full min-h-16 text-lg">{busy ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <UserPlus className="h-5 w-5 mr-2" />}{tr('JOIN', 'UNIRME')}</Button>
        </form></>}
      {agency && <footer className="text-xs text-muted-foreground text-center">{tr('Powered by', 'Con tecnología de')} Fairfield Response Group / Command X</footer>}
    </div>
  </main>;
}