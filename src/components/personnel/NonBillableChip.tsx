import { Badge } from '@/components/ui/badge';

/** Customer-employed people: customer name chip + visible "Non-billable" tag. */
export function NonBillableChip({ value, employer }: { value?: boolean; employer?: string }) {
  if (!value) return null;
  const customer = employer?.endsWith(' (customer)') ? employer.slice(0, -' (customer)'.length) : undefined;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {customer && <Badge variant="outline" title={customer} className="font-normal text-[10px] px-1.5 py-0 max-w-[10rem] truncate inline-block">{customer}</Badge>}
      <Badge variant="outline" title={`Non-billable${employer ? ` — ${employer}` : ''}`} className="font-normal text-muted-foreground text-[10px] px-1.5 py-0 border-dashed">Non-billable</Badge>
    </span>
  );
}
