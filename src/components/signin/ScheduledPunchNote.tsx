import { usePublicLang } from '@/lib/publicLang';
import { localTime } from '@/lib/signinSheets';
export function ScheduledPunchNote({ start, end, zone, missingTimezone }: { start?: string | null; end?: string | null; zone?: string; missingTimezone?: boolean }) {
  const { tr } = usePublicLang();
  if (!start || !end) return null;
  const timezone = zone || 'America/Chicago', begins = localTime(start, timezone), ends = localTime(end, timezone);
  return <div className="text-sm text-muted-foreground space-y-1" role="note">
    <p>{tr(`Shift ${begins}–${ends} — early taps count from ${begins}`, `Turno ${begins}–${ends} — las entradas tempranas cuentan desde ${begins}`)}</p>
    <p>{tr(`Late checkout counts through ${ends} unless extra time is approved.`, `La salida tardía cuenta hasta ${ends}, salvo aprobación de tiempo extra.`)}</p>
    {missingTimezone && <p className="text-warning">{tr(`Location timezone missing; using ${timezone}.`, `Falta la zona horaria del sitio; se usa ${timezone}.`)}</p>}
  </div>;
}
