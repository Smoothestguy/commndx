import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ForceDarkTheme } from "@/components/ForceDarkTheme";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2, MapPin } from "lucide-react";

type Info = { valid: boolean; reason?: string; first_name?: string; location_name?: string; address?: string | null; report_at?: string | null; on_site_since?: string | null };
type Done = { action: "in" | "out"; at: string } | null;

const OFFICE_PHONE = "(281) 748-3832";

function getPos(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    const t = setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { clearTimeout(t); resolve(null); },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 },
    );
  });
}

export default function SitePunch() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return setInfo({ valid: false });
      const { data, error } = await supabase.rpc("get_site_checkin_info", { p_token: token });
      setInfo(error || !data ? { valid: false } : (data as unknown as Info));
    })();
  }, [token]);

  const punch = async () => {
    if (!token || busy) return;
    setBusy(true); setError(null);
    const pos = await getPos();
    const { data, error } = await supabase.rpc("site_punch", { p_token: token, p_lat: pos?.lat ?? undefined, p_lng: pos?.lng ?? undefined } as any);
    const res = data as any;
    setBusy(false);
    if (error || !res?.ok) { setError("Something went wrong — tap again. / Inténtalo de nuevo."); return; }
    setDone({ action: res.action, at: res.at });
    setInfo((i) => i ? { ...i, on_site_since: res.action === "in" ? res.at : null } : i);
  };

  const t = (iso: string) => format(new Date(iso), "HH:mm");
  const onSite = !!info?.on_site_since;
  const mapsHref = info?.address ? `https://maps.google.com/?q=${encodeURIComponent(info.address)}` : null;

  const BigBtn = ({ kind }: { kind: "in" | "out" }) => (
    <Button onClick={punch} disabled={busy}
      className={kind === "in"
        ? "w-full h-28 text-2xl font-bold bg-success text-success-foreground hover:bg-success/90"
        : "w-full h-28 text-2xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"}>
      {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : kind === "in" ? "I'M HERE — CHECK IN" : "CHECK OUT"}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-5">
      <ForceDarkTheme />
      <div className="w-full max-w-md text-center space-y-6">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Fairfield Response Group</p>
        {!info && <Loader2 className="h-10 w-10 animate-spin mx-auto" />}
        {info && !info.valid && (
          <div className="space-y-3">
            <AlertCircle className="h-14 w-14 mx-auto text-destructive" />
            <h1 className="text-3xl font-bold">This link isn't active</h1>
            <p className="text-lg text-muted-foreground">Please call the office: <a className="underline" href={`tel:${OFFICE_PHONE.replace(/\D/g, "")}`}>{OFFICE_PHONE}</a></p>
            <p className="text-base text-muted-foreground">Este enlace no está activo. Llama a la oficina.</p>
          </div>
        )}
        {info?.valid && (
          <>
            {done ? (
              <div className="space-y-2">
                <CheckCircle2 className="h-16 w-16 mx-auto text-success" />
                <h1 className="text-3xl font-bold">{done.action === "in" ? "Checked in" : "Checked out"} {t(done.at)} ✓</h1>
                <p className="text-xl">{info.location_name}</p>
                {done.action === "out" && <p className="text-lg text-muted-foreground">Total today shows on your supervisor's board.</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <h1 className="text-4xl font-bold">Hi {info.first_name}!</h1>
                <p className="text-2xl font-semibold">{info.location_name}</p>
                {info.address && (
                  <a href={mapsHref!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-lg text-primary underline">
                    <MapPin className="h-5 w-5" />{info.address}
                  </a>
                )}
                {info.report_at && !onSite && <p className="text-lg text-muted-foreground">Report: {format(new Date(info.report_at), "EEE M/d HH:mm")}</p>}
                {onSite && <p className="text-xl">On site since {t(info.on_site_since!)}</p>}
              </div>
            )}
            {(!done || done.action === "in") && <BigBtn kind={onSite ? "out" : "in"} />}
            {error && <p className="text-lg text-destructive">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
