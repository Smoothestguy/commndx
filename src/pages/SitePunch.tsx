import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { localStamp } from "../../supabase/functions/_shared/locationTime";
import { supabase } from "@/integrations/supabase/client";
import { ForceDarkTheme } from "@/components/ForceDarkTheme";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2, MapPin, WifiOff } from "lucide-react";
import { clearPunch, isNetworkError, readPunch, savePunch, withPunchLock, type PunchIntent } from "@/lib/punchQueue";
import { Textarea } from "@/components/ui/textarea";
import { registerPunchOffline } from "@/lib/punchOffline";
import { SignaturePad } from '@/components/documents/SignaturePad';
import { LateCheckIn } from '@/components/signin/LateCheckIn';
import { EarlyCheckIn } from '@/components/signin/EarlyCheckIn';
import { ShiftExtensionRequest } from '@/components/signin/ShiftExtensionRequest';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { agencyLogo } from '@/lib/agencyPortal';
import { LangSwitcher, usePublicLang } from '@/lib/publicLang';

type Info = { valid: boolean; reason?: string; first_name?: string; location_name?: string; address?: string | null; report_at?: string | null; on_site_since?: string | null; timezone?: string; agency_name?: string | null; agency_logo_url?: string | null };
type Done = { action: "in" | "out"; at: string; geo: boolean; offsite: boolean; early?: boolean; lateMinutes?: number } | null;
type Rejection = { reason: string; distance_m?: number; radius_m?: number; in_at?: string; out_at?: string; timezone?: string; shift_start?: string; early_minutes?: number; minutes_late?: number; grace_minutes?: number };
const OFFICE_PHONE = "(281) 748-3832";
const infoKey = (token: string) => `site-punch-info:${token}`;
function cachedInfo(token: string): Info | null {
  try { return JSON.parse(localStorage.getItem(infoKey(token)) ?? "null"); } catch { return null; }
}
function getPos(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    const t = setTimeout(() => resolve(null), 8000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      () => { clearTimeout(t); resolve(null); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

export default function SitePunch() {
  const { token } = useParams<{ token: string }>();
  const { tr } = usePublicLang();
  const trRef = useRef(tr); trRef.current = tr;
  const [info, setInfo] = useState<Info | null>(() => token ? cachedInfo(token) : null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const [pending, setPending] = useState<PunchIntent | null>(() => token ? readPunch(token) : null);
  const [error, setError] = useState<string | null>(null);
  const [logoFailed,setLogoFailed]=useState(false);
  const tapping = useRef(false);
  const blocked = useRef(false);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [signing,setSigning]=useState<PunchIntent|null>(null);
  const prepare=async(intent:PunchIntent)=>{if(!navigator.onLine){setSigning(intent);return false;}const {data,error}=await supabase.functions.invoke('punch-signature',{body:{action:'prepare',token:intent.token,at:intent.at,lat:intent.lat,lng:intent.lng,override_reason:intent.overrideReason}});if(error)throw new Error(error instanceof FunctionsHttpError?await error.context.text():error.message);if(!data.ok){savePunch(intent);setPending(intent);setRejection(data);blocked.current=true;return false;}if(!data.has_signature&&!intent.signatureBase64){setSigning(intent);return false;}return true;};

  const updateInfo = useCallback((value: Info) => {
    setInfo(value);
    if (token) { try { localStorage.setItem(infoKey(token), JSON.stringify(value)); } catch { /* Punch storage errors are handled separately. */ } }
  }, [token]);

  const confirm = useCallback((intent: PunchIntent, action: "in" | "out") => {
    clearPunch(intent.token);
    setPending(null); setError(null);
    setRejection(null);
    setDone({ action, at: intent.effectiveAt || intent.at, geo: intent.lat != null && intent.lng != null, offsite: !!intent.overrideReason, early: intent.earlyFlagged, lateMinutes: intent.lateMinutes });
    setInfo((i) => {
      const next = i ? { ...i, on_site_since: action === "in" ? intent.effectiveAt || intent.at : null } : i;
      if (next) { try { localStorage.setItem(infoKey(intent.token), JSON.stringify(next)); } catch { /* Best effort info cache. */ } }
      return next;
    });
  }, []);

  const flush = useCallback(async () => {
    if (!token || !navigator.onLine || blocked.current) return;
    await withPunchLock(token, async () => {
      const intent = readPunch(token);
      if (!intent) { setPending(null); return; }
      setBusy(true);
      try {
        const finish=async(current:PunchIntent)=>{if(current.action==='in'){const committed={...current,committed:true};savePunch(committed);setPending(committed);const {data,error}=await supabase.functions.invoke('punch-signature',{body:{action:'save',token:current.token,at:current.effectiveAt||current.at,signature_png_base64:current.signatureBase64}});if(error||!data?.ok){setError('Check-in recorded; signature still needs saving. Keep this page open to retry.');return;} }confirm(current,current.action);};
        if(intent.committed){await finish(intent);return;}
        // A response can be lost after the toggle committed. Check server state before retrying.
        if (intent.tries > 0) {
          const { data, error } = await supabase.rpc("get_site_checkin_info", { p_token: token });
          if (error) { if (!isNetworkError(error)) setError("Could not verify the saved punch. / No se pudo verificar el registro guardado."); return; }
          const current = data as unknown as Info;
          if (current?.valid && ((intent.action === "in" && current.on_site_since && Date.parse(current.on_site_since) >= Date.parse(intent.at) - 1000) || (intent.action === "out" && !current.on_site_since))) {
            await finish({...intent,effectiveAt:intent.action==='in'?current.on_site_since||intent.at:intent.at}); return;
          }
          if (!current?.valid || (intent.action === "in" && current.on_site_since) || (intent.action === "out" && current.on_site_since && Date.parse(current.on_site_since) > Date.parse(intent.at))) {
            blocked.current = true;
            setError("Your site status changed. Call the office before retrying. / Tu estado cambió. Llama a la oficina antes de reintentar.");
            return;
          }
        }
        if(intent.action==='in'&&!intent.signatureBase64){
          const {data:preflight,error:preflightError}=await supabase.functions.invoke('punch-signature',{body:{action:'prepare',token:intent.token,at:intent.at,lat:intent.lat,lng:intent.lng,override_reason:intent.overrideReason}});
          if(preflightError){setError('Could not verify the saved signature. Keep this page open to retry.');return;}
          if(!preflight?.ok){blocked.current=true;setRejection(preflight);return;}
          if(!preflight.has_signature){setSigning(intent);return;}
        }
        const attempt = { ...intent, tries: intent.tries + 1 };
        savePunch(attempt); setPending(attempt);
        const { data, error } = await supabase.rpc("site_punch", {
          p_token: token, p_lat: intent.lat ?? undefined, p_lng: intent.lng ?? undefined, p_at: intent.at, p_accuracy: intent.accuracy ?? undefined, p_override_reason: intent.overrideReason, p_early_reason: intent.earlyReason, p_late_reason: intent.lateReason,
        });
        if (error) {
          if (!isNetworkError(error)) { blocked.current = true; setError("Punch not accepted — call the office. Your saved punch is kept. / Registro no aceptado; llama a la oficina. Se conserva el registro."); }
          return;
        }
        const result = data as ({ ok?: boolean; action?: "in" | "out"; at?: string; early_flagged?: boolean; late_minutes?: number; minutes_late?: number } & Rejection) | null;
        if (!result?.ok || !result.action) {
          blocked.current = true;
          if (result && ['out_of_range', 'no_gps', 'already_signed_today', 'before_shift', 'late'].includes(result.reason)) {
            setRejection(result); setError(null); savePunch({ ...intent, tries: 0 });
            if (result.reason === 'already_signed_today') {
              clearPunch(token); setPending(null);
              const { data: history, error: historyError } = await supabase.functions.invoke('site-punch-history', { body: { token, at: intent.at } });
              if (!historyError && history) setRejection({ ...result, ...history });
            }
            return;
          }
          setError("Punch not accepted — call the office. Your saved punch is kept. / Registro no aceptado; llama a la oficina. Se conserva el registro.");
          return;
        }
        await finish({...intent,action:result.action,effectiveAt:result.at,earlyFlagged:result.early_flagged,lateMinutes:result.late_minutes??result.minutes_late});
      } catch (e) {
        if (!isNetworkError(e)) setError(trRef.current("Could not send the saved punch.", "No se pudo enviar el registro guardado."));
      } finally { setBusy(false); }
    });
  }, [token, confirm]);

  useEffect(() => {
    void registerPunchOffline().catch(() => {});
    blocked.current = false;
    if (!token) { setInfo({ valid: false }); return; }
    setInfo(cachedInfo(token)); setPending(readPunch(token)); setDone(null);
    let active = true;
    const load = async () => {
      if (!navigator.onLine) return;
      const { data, error } = await supabase.rpc("get_site_checkin_info", { p_token: token });
      if (!active) return;
      if (!error && data) { const value=data as unknown as Info; if(value.valid){const {data:shift}=await supabase.functions.invoke('shift-discipline',{body:{action:'info',token}});if(active)updateInfo({...value,timezone:shift?.timezone || value.timezone});}else updateInfo(value); }
      else if (!isNetworkError(error)) updateInfo({ valid: false });
    };
    void load().then(flush);
    const online = () => { void flush().then(load); };
    const storage = (e: StorageEvent) => { if (e.key === `site-punch-pending:${token}`) { setPending(readPunch(token)); void load(); } };
    window.addEventListener("online", online);
    window.addEventListener("storage", storage);
    const interval = setInterval(() => { void flush(); }, 60_000);
    return () => { active = false; clearInterval(interval); window.removeEventListener("online", online); window.removeEventListener("storage", storage); };
  }, [token, flush, updateInfo]);

  const punch = async () => {
    if (!token || busy || tapping.current || readPunch(token)) return;
    tapping.current = true; setBusy(true); setError(null);
    const at = new Date().toISOString(); // Tap time, before GPS wait or any network work.
    try {
      const pos = await getPos();
      if (readPunch(token)) { setPending(readPunch(token)); return; }
      const intent: PunchIntent = { token, lat: pos?.lat ?? null, lng: pos?.lng ?? null, accuracy: pos?.accuracy ?? null, at, tries: 0, action: info?.on_site_since ? "out" : "in" };
      if(intent.action==='in'&&!await prepare(intent))return;
      savePunch(intent); setPending(intent); // Write ahead: reloads cannot lose an in-flight punch.
      await flush();
    } catch {
      setError(tr("This phone couldn't save your punch. Keep this page open and try in coverage, or call the office.", "No se pudo guardar; intenta con señal o llama a la oficina."));
    } finally { tapping.current = false; setBusy(false); }
  };
  const override = async () => {
    if (!token || !overrideReason.trim() || busy) return;
    const intent = readPunch(token); if (!intent) return;
    const next={ ...intent, overrideReason: overrideReason.trim(), tries: 0 };
    blocked.current = false; setRejection(null); setOverriding(false);
    try{if(!await prepare(next))return;savePunch(next);await flush();}catch(e){setError(e instanceof Error?e.message:'Check-in unavailable');}
  };
  const t = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: rejection?.timezone || info?.timezone || 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  const onSite = !!info?.on_site_since;
  const mapsHref = info?.address ? `https://maps.google.com/?q=${encodeURIComponent(info.address)}` : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-5">
      <ForceDarkTheme /><LangSwitcher />
      {signing ? <div className="w-full max-w-md h-[85dvh]"><SignaturePad name={info?.first_name||'You'} required description={tr("Sign to check in", "Firma para registrar tu entrada")} saving={busy} onSkip={()=>{}} onSave={async blob=>{const intent=signing;setBusy(true);try{const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});savePunch({...intent,signatureBase64:base64});setSigning(null);setPending(readPunch(intent.token));blocked.current=false;await flush();}catch{setError(tr('Could not save your signature. Please try again.', 'No se pudo guardar tu firma. Intenta otra vez.'));}finally{setBusy(false);}}}/></div> : <div className="w-full max-w-md text-center space-y-6">
        {info?.valid&&info.agency_name?<div className="space-y-2">{agencyLogo.parse(info.agency_logo_url)&&!logoFailed?<img src={agencyLogo.parse(info.agency_logo_url)||undefined} alt={`${info.agency_name} logo`} referrerPolicy="no-referrer" onError={()=>setLogoFailed(true)} className="max-h-12 max-w-56 object-contain mx-auto"/>:<p className="text-xl font-semibold">{info.agency_name}</p>}<p className="text-xs text-muted-foreground">{tr("for Fairfield Response Group", "para Fairfield Response Group")}</p></div>:<p className="text-sm uppercase tracking-widest text-muted-foreground">Fairfield Response Group</p>}
        {pending && !rejection && <div role="status" className="border-2 border-warning bg-warning/15 text-warning rounded-md p-5 space-y-3">
          <WifiOff className="h-12 w-12 mx-auto" />
          <h1 className="text-2xl font-bold">{pending.committed?tr('Signature pending — check-in recorded','Firma pendiente — entrada registrada'):error?tr('Punch not accepted — saved for review','Registro no aceptado — guardado para revisión'):navigator.onLine?tr('Sending saved punch','Enviando registro guardado'):tr('No signal — punch saved','Sin señal — registro guardado')} {t(pending.at)}</h1>
          <p className="text-lg">{error?tr('Keep this page open and call the office.','Mantén esta página abierta y llama a la oficina.'):tr("It will send automatically when you're back in coverage. Keep this page open or revisit the link.","Se enviará al volver la señal. Mantén esta página abierta o vuelve a abrir el enlace.")}</p>
          {busy && <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
        </div>}
        {!info && !pending && <><Loader2 className="h-10 w-10 animate-spin mx-auto" /><p className="text-muted-foreground">{tr('Waiting for signal…', 'Esperando señal…')}</p></>}
        {info && !info.valid && !pending && <div className="space-y-3">
          <AlertCircle className="h-14 w-14 mx-auto text-destructive" />
          <h1 className="text-3xl font-bold">{tr("This link isn't active", "Este enlace no está activo")}</h1>
          <p className="text-lg text-muted-foreground">{tr("Please call the office:", "Llama a la oficina:")} <a className="underline" href={`tel:${OFFICE_PHONE.replace(/\D/g, "")}`}>{OFFICE_PHONE}</a></p>
        </div>}
        {info?.valid && !pending && !rejection && <>
          {done ? <div className="space-y-2">
            <CheckCircle2 className="h-16 w-16 mx-auto text-success" />
            <h1 className="text-3xl font-bold">{done.action === "in" ? tr("Checked in", "Entrada registrada") : tr("Checked out", "Salida registrada")} {t(done.at)} ✓</h1>
            <p className="text-xl">{info.location_name}</p>
            <p className="text-xs text-muted-foreground">{done.geo ? tr("📍 location tagged", "📍 ubicación registrada") : tr("no GPS", "sin GPS")}</p>
            {!!done.lateMinutes && <p className="text-sm text-destructive">{tr(`Marked ${done.lateMinutes} min late`, `Marcado ${done.lateMinutes} min tarde`)}</p>}
            {done.early && <p className="text-warning">{tr("Early check-in — pending supervisor approval", "Entrada temprana — pendiente de aprobación del supervisor")}</p>}
            {done.offsite && <p className="text-warning">{tr("Recorded as off-site — supervisor will review", "Registrado fuera del sitio — el supervisor lo revisará")}</p>}
            {done.action === "out" && <p className="text-lg text-muted-foreground">{tr("Total today shows on your supervisor's board.", "El total de hoy aparece en el tablero de tu supervisor.")}</p>}
          </div> : <div className="space-y-2">
            <h1 className="text-4xl font-bold">{tr(`Hi ${info.first_name}!`, `¡Hola ${info.first_name}!`)}</h1>
            <p className="text-2xl font-semibold">{info.location_name}</p>
            {mapsHref && <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-lg text-primary underline"><MapPin className="h-5 w-5" />{info.address}</a>}
            {info.report_at && !onSite && <p className="text-lg text-muted-foreground">{tr("Report:", "Presentarse:")} {localStamp(info.report_at,info.timezone || 'America/Chicago')}</p>}
            {info.on_site_since && <p className="text-xl">{tr("On site since", "En el sitio desde")} {t(info.on_site_since)}</p>}
          </div>}
          {(!done || done.action === "in") && <Button onClick={punch} disabled={busy} className={`w-full h-28 text-2xl font-bold ${onSite ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-success text-success-foreground hover:bg-success/90"}`}>
            {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : onSite ? tr("CHECK OUT", "REGISTRAR SALIDA") : tr("I'M HERE — CHECK IN", "YA LLEGUÉ — REGISTRAR ENTRADA")}
          </Button>}
          {onSite && token && <ShiftExtensionRequest token={token} />}
        </>}
        {rejection?.reason === 'late' ? <LateCheckIn rejection={rejection} timezone={rejection.timezone||info?.timezone} busy={busy} onSubmit={async reason => { if (!token || busy) return; const intent=readPunch(token); if (!intent) return; savePunch({...intent,lateReason:reason,tries:0});setRejection(null);blocked.current=false;await flush(); }} /> : rejection?.reason === 'before_shift' ? <EarlyCheckIn rejection={rejection} timezone={rejection.timezone||info?.timezone} busy={busy} onSubmit={async reason => { if (!token || busy) return; const intent=readPunch(token); if (!intent) return; savePunch({...intent,earlyReason:reason,tries:0});setRejection(null);blocked.current=false;await flush(); }} /> : rejection && <div role="status" className={`rounded-md border-2 p-5 space-y-4 ${rejection.reason === 'already_signed_today' ? 'border-success text-success' : 'border-warning text-warning'}`}>
          <h1 className="text-2xl font-bold">{rejection.reason === 'out_of_range' ? tr(`You're ${Math.round(rejection.distance_m ?? 0)}m from ${info?.location_name || 'the site'} (allowed ${rejection.radius_m ?? 300}m)`, `Estás a ${Math.round(rejection.distance_m ?? 0)} m de ${info?.location_name || 'el sitio'} (permitido ${rejection.radius_m ?? 300} m)`) : rejection.reason === 'no_gps' ? tr("Couldn't get your location", "No se pudo obtener tu ubicación") : tr('Already signed in today at this site', 'Ya registraste tu entrada hoy en este sitio')}</h1>
          {rejection.reason === 'already_signed_today' ? <p>{rejection.in_at && `${tr('In','Entrada')} ${t(rejection.in_at)}`} {rejection.out_at && `${tr('Out','Salida')} ${t(rejection.out_at)}`}</p> : overriding ? <>
            <Textarea aria-label={tr("Off-site reason", "Motivo fuera del sitio")} placeholder={tr("Reason (required)", "Motivo (obligatorio)")} value={overrideReason} maxLength={1000} onChange={e => setOverrideReason(e.target.value)} />
            <Button className="w-full min-h-14" disabled={!overrideReason.trim() || busy} onClick={override}>{tr("Record check-in", "Registrar entrada")}</Button>
          </> : <Button className="w-full h-20 text-xl" onClick={() => setOverriding(true)}>{tr("I'M ON SITE ANYWAY", "ESTOY EN EL SITIO DE TODAS FORMAS")}</Button>}
        </div>}
        {error && <p role="alert" className="text-lg text-destructive">{error} <a className="underline" href={`tel:${OFFICE_PHONE.replace(/\D/g, "")}`}>{OFFICE_PHONE}</a></p>}
      </div>}
    </div>
  );
}
