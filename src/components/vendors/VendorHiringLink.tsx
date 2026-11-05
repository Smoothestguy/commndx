import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Link2 } from 'lucide-react';
import { toast } from 'sonner';
export function VendorHiringLink({ vendorId }: { vendorId: string }) {
  const [postingId,setPostingId]=useState('');
  const {data}=useQuery({queryKey:['vendor-hiring-link',vendorId],queryFn:async()=>{const [v,p]=await Promise.all([supabase.from('vendors').select('signup_token').eq('id',vendorId).single(),supabase.from('job_postings').select('id,public_token,project_task_orders(title)').eq('is_open',true)]);if(v.error||p.error)throw v.error||p.error;return {token:v.data.signup_token,postings:p.data};}});
  const posting=data?.postings.find(p=>p.id===(postingId||data.postings[0]?.id));
  const origin=window.location.hostname==='localhost'||window.location.hostname.includes('lovable.app')?'https://fairfieldrg.com':window.location.origin;
  const link=data?.token&&posting?`${origin}/apply/${posting.public_token}?agency=${data.token}`:'';
  return <section className="border-y py-4 space-y-3"><h2 className="font-semibold flex gap-2 items-center"><Link2 className="h-4 w-4"/>Hiring link</h2><Select value={posting?.id||''} onValueChange={setPostingId}><SelectTrigger aria-label="Hiring link posting"><SelectValue placeholder="Choose an open posting"/></SelectTrigger><SelectContent>{data?.postings.map(p=><SelectItem key={p.id} value={p.id}>{p.project_task_orders?.title||'Open posting'}</SelectItem>)}</SelectContent></Select><div className="flex gap-2"><Input aria-label="Agency hiring URL" readOnly value={link}/><Button aria-label="Copy hiring link" disabled={!link} onClick={()=>void navigator.clipboard.writeText(link).then(()=>toast.success('Hiring link copied')).catch(()=>toast.error('Select and copy the link'))}><Copy className="h-4 w-4"/></Button></div>{data&&!data.postings.length&&<p className="text-sm text-muted-foreground">No open postings</p>}</section>;
}