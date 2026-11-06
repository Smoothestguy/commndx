import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type LateInfo } from '@/lib/lateAttendance';
export function LateBadge({ row }: { row: LateInfo }) {
  if (!(row.late_minutes && row.late_minutes > 0)) return null;
  return <TooltipProvider><Tooltip><TooltipTrigger asChild><Badge variant="outline" className="text-destructive border-destructive/40 bg-destructive/10 text-[10px] ml-1 whitespace-nowrap" tabIndex={0}>LATE {row.late_minutes}m</Badge></TooltipTrigger><TooltipContent>{row.late_reason || `Marked ${row.late_minutes} min late`}</TooltipContent></Tooltip></TooltipProvider>;
}