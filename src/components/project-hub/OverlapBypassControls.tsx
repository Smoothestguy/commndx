import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { useOverlapBypass } from '@/hooks/useOverlapBypass';

const fmt = (iso: string, tz: string) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(new Date(iso)); } catch { return new Date(iso).toLocaleString(); } };

/** Admin/manager-only: amber banner while the 48h overlap bypass is active, or an activate button after an overlap error. */
export function OverlapBypassControls({ error, timezone, onActivated, disabled }: { error: string; timezone: string; onActivated: () => void; disabled?: boolean }) {
  const { isAdmin, isManager } = useUserRole();
  const allowed = isAdmin || !!isManager;
  const { until, set } = useOverlapBypass(allowed);
  if (!allowed) return null;
  if (until) return <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground"><span>Overlap check off until {fmt(until, timezone)}</span><span>·</span><button type="button" className="underline font-medium" disabled={set.isPending || disabled} onClick={() => set.mutate(false)}>Turn off</button></div>;
  if (!error.includes('overlaps another stay')) return null;
  return <Button type="button" size="sm" variant="outline" className="border-destructive text-destructive" disabled={set.isPending || disabled} onClick={async () => { await set.mutateAsync(true); onActivated(); }}>Allow overlapping entries for 48 hours</Button>;
}
