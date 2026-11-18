import { format, formatDistanceToNow } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { US_STATE_CODES } from '@/lib/recruiting';
export function SubmittedTime({ value }: { value: string }) {
  const date = new Date(value);
  return <time dateTime={value} title={format(date, 'MMM d, yyyy HH:mm:ss xxx')} className="text-muted-foreground md:whitespace-nowrap">{formatDistanceToNow(date, { addSuffix: true })} · {format(date, 'MMM d, yyyy HH:mm')}</time>;
}
export function RecruitingStateFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label="Filter by state" className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All states</SelectItem><SelectItem value="unknown">Unknown state</SelectItem>{US_STATE_CODES.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select>;
}