import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export function AgencyFilter({ value, onChange, vendors }: {value:string;onChange:(v:string)=>void;vendors:{id:string;name:string}[]}) {
 return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label="Agency" className="h-8 w-full sm:w-44"><SelectValue placeholder="All agencies" /></SelectTrigger><SelectContent><SelectItem value="all">All agencies</SelectItem>{vendors.map(v=><SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>;
}
