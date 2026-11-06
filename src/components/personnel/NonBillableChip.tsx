import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
export function NonBillableChip({ value, agency }: { value?: boolean; agency?: string }) {
  return value ? <Tooltip><TooltipTrigger asChild><Badge variant="outline" className="text-muted-foreground font-normal text-[10px] px-1.5 py-0">NB</Badge></TooltipTrigger><TooltipContent>Non-billable{agency ? ` — ${agency}` : ''}</TooltipContent></Tooltip> : null;
}