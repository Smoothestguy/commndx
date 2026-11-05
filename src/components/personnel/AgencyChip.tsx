import { Badge } from '@/components/ui/badge';
export function AgencyChip({ name }: {name?:string}) {
 return name ? <Badge variant="outline" title={name} className="font-normal text-muted-foreground text-[10px] max-w-[9rem] truncate inline-block align-middle px-1.5 py-0">{name}</Badge> : null;
}
