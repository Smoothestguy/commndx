import { useMemo } from 'react';
import { useLocationRequirements } from '@/integrations/supabase/hooks/useLocationStaffing';
import { staffingBreakdown, fmtDiff } from '@/lib/staffingBreakdown';

type Row = { id: string; name: string; role: string | null; stays: unknown[]; demobilized?: boolean };
const tone = (n: number) => n < 0 ? 'text-destructive' : n > 0 ? 'text-info' : 'text-muted-foreground';

export function DayStaffingBreakdown({ locationId, day, zone, rows, mobeCount = 0, demobeCount = 0 }: { locationId: string; day: string; zone: string; rows: Row[]; mobeCount?: number; demobeCount?: number }) {
  const reqs = useLocationRequirements(locationId);
  const data = useMemo(() => staffingBreakdown(reqs.data ?? [], rows.map(r => ({ id: r.id, role: r.role, present: r.stays.length > 0 }))), [reqs.data, rows]);
  const title = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: '2-digit', day: '2-digit' }).replace(',', '');
  return <div className="rounded-md border p-2 text-xs max-w-md" aria-label="Staffing breakdown" data-zone={zone}>
    <p className="font-medium mb-1">Staffing · {title}</p>
    {reqs.error ? <p role="alert" className="text-destructive">Requirements could not be loaded.</p> :
    <table className="w-full"><thead><tr className="text-muted-foreground"><th className="text-left font-normal">Role</th><th className="text-right font-normal">Required</th><th className="text-right font-normal">Present</th><th className="text-right font-normal">+/-</th></tr></thead>
      <tbody>{data.rows.map(r => <tr key={r.role}><td className="pr-2">{r.role}</td><td className="text-right">{r.required}</td><td className="text-right">{r.present}</td><td className={`text-right ${tone(r.diff)}`}>{fmtDiff(r.diff)}</td></tr>)}
        <tr className="border-t font-medium"><td>Total</td><td className="text-right">{data.total.required}</td><td className="text-right">{data.total.present}</td><td className={`text-right ${tone(data.total.diff)}`}>{fmtDiff(data.total.diff)}</td></tr></tbody></table>}
    <p className="mt-1 text-muted-foreground">MOBE {mobeCount} · Demobe {demobeCount}</p>
  </div>;
}
