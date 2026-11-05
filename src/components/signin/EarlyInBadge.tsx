import { Badge } from '@/components/ui/badge';
import { earlyApproval } from '@/lib/shiftDiscipline';
export function EarlyInBadge({ row }: { row: { early_in_reason?: string | null; offsite_approved_by?: string | null; offsite_approved_at?: string | null } }) {
  if (!row.early_in_reason) return null;
  return <Badge variant="outline" className="text-warning border-warning text-[10px]" title={`${row.early_in_reason} — ${earlyApproval(row.early_in_reason,row.offsite_approved_by,row.offsite_approved_at)}`}>early in</Badge>;
}