import { useQuery } from '@tanstack/react-query';
import { loadMobeRows, travelLabel, dayHeadcount } from '@/lib/mobeRows';

export const useMobeRows = (locationId: string, day: string, enabled = true) =>
  useQuery({ queryKey: ['mobe-rows', locationId, day], enabled: enabled && !!day, queryFn: () => loadMobeRows(locationId, day) });

/** MOBE/DEMOBE list for a location day plus the day headcount (onsite + MOBE). */
export function MobeSection({ locationId, day, onsite }: { locationId: string; day: string; onsite: number }) {
  const { data = [], error } = useMobeRows(locationId, day);
  return <section aria-label="MOBE" className="space-y-1 text-sm">
    <p className="font-medium">Day total: {onsite} worked + {data.length} MOBE = {dayHeadcount(onsite, data.length)}</p>
    {error ? <p role="alert" className="text-destructive">MOBE rows could not be loaded.</p> : data.length > 0 && <div className="rounded-md border">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-2 py-1 text-xs font-medium text-muted-foreground border-b"><span>MOBE · Name</span><span>Origin</span><span>Travel h</span></div>
      {data.map(r => <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 px-2 py-1 border-b last:border-0"><span className="truncate">{r.name}{r.kind === 'demobe' ? ' (DEMOBE)' : ''}</span><span className="truncate">{r.origin}</span><span className="text-right">{travelLabel(r.travelHours)}</span></div>)}
    </div>}
  </section>;
}
