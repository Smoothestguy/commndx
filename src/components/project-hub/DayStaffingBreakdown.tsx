import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLocationRequirements } from '@/integrations/supabase/hooks/useLocationStaffing';
import { dailyStaffingBreakdown, fmtDiff } from '@/lib/staffingBreakdown';
import type { ExpectedDay } from '@/lib/locationExpected';

type Row = { id: string; name: string; role: string | null; stays: unknown[]; demobilized?: boolean };
const tone = (n: number) => n < 0 ? 'text-destructive' : n > 0 ? 'text-info' : 'text-muted-foreground';

export function DayStaffingBreakdown({ locationId, day, zone, rows, expected, requiredEditor, siteEditor, mobeCount = 0, demobeCount = 0, expectedDay, ignoredShort = [], overlaps = [] }: { expectedDay?: string | null; ignoredShort?: string[]; overlaps?: { id: string; name: string; sites: { name: string; range: string }[] }[]; locationId: string; day: string; zone: string; rows: Row[]; expected?: ExpectedDay | null; requiredEditor?: (source: 'site' | 'customer' | null) => React.ReactNode; siteEditor?: React.ReactNode; mobeCount?: number; demobeCount?: number }) {
  const reqs = useLocationRequirements(locationId);
  const data = useMemo(() => dailyStaffingBreakdown(reqs.data ?? [], rows.map(r => ({ id: r.id, role: r.role, present: r.stays.length > 0 })), expected), [reqs.data, rows, expected]);
  const title = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: '2-digit', day: '2-digit' }).replace(',', '');
  return <div className="rounded-md border p-2 text-xs max-w-md" aria-label="Staffing breakdown" data-zone={zone}>
    <div className="flex items-center justify-between gap-2"><p className="font-medium">Staffing · {title}</p>{siteEditor}</div>
    {data.hasRequired && <p className="text-muted-foreground mb-1">Required from {data.source === 'site' ? 'site requirements' : `customer sheet${expectedDay ? ` (${expectedDay.slice(5, 7)}/${expectedDay.slice(8, 10)})` : ''}`}</p>}
    {reqs.error ? <p role="alert" className="text-destructive">Requirements could not be loaded.</p> :
    <table className="w-full"><thead><tr className="text-muted-foreground"><th className="text-left font-normal">Role</th>{data.hasRequired && <th className="text-right font-normal">Required</th>}<th className="text-right font-normal">Present</th>{data.hasRequired && <th className="text-right font-normal">+/-</th>}</tr></thead>
      <tbody>{data.rows.map(r => <tr key={r.role}><td className="pr-2">{r.role}</td>{data.hasRequired && <td className="text-right">{r.required}</td>}<td className="text-right">{r.present}</td>{data.hasRequired && <td className={`text-right ${tone(r.diff)}`}>{fmtDiff(r.diff)}</td>}</tr>)}
        <tr className="border-t font-medium"><td>Total</td>{data.hasRequired && <td className="text-right">{data.total.required}</td>}<td className="text-right">{data.total.present}</td>{data.hasRequired && <td className={`text-right ${tone(data.total.diff)}`}>{fmtDiff(data.total.diff)}</td>}</tr></tbody></table>}
    {overlaps.length > 0 && <p className="mt-1 text-warning">⚠ Counted at another site at the same time: {overlaps.map((o, i) => <span key={o.id}>{i > 0 && ', '}<Link to={`/personnel/${o.id}`} className="underline">{o.name}</Link> ({o.sites.map(x => o.sites.length === 1 ? `${x.name} ${x.range}` : x.name).join(', ')})</span>)}</p>}
    {ignoredShort.length > 0 && <p className="mt-1 text-muted-foreground">Ignored {ignoredShort.length} {ignoredShort.length === 1 ? 'entry' : 'entries'} under 5 min: {ignoredShort.join(', ')}</p>}
    {!reqs.isLoading && !reqs.error && requiredEditor?.(data.hasRequired ? data.source : null)}
    {(mobeCount > 0 || demobeCount > 0) && <p className="mt-1 text-muted-foreground">MOBE {mobeCount} · Demobe {demobeCount}</p>}
  </div>;
}
