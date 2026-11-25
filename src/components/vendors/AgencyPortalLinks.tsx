import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/contexts/AuthContext';
import {useUserRole} from '@/hooks/useUserRole';
import {agencyExpiry,agencyUrl} from '@/lib/agencyPortal';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Plus,Loader2,Link2} from 'lucide-react';
import {LinkRow,LinkSection} from '@/components/links/LinkList';
import {toast} from 'sonner';

export function AgencyPortalLinks({vendorId,compact=false}:{vendorId:string;compact?:boolean}) {
 const {isAdmin,isManager}=useUserRole();const [open,setOpen]=useState(false);
 if(!isAdmin&&!isManager)return null;
 return <div onClick={e=>e.stopPropagation()}><Button type="button" variant="outline" size={compact?'icon':'default'} title="Agency portal link" aria-label="Agency portal link" onClick={()=>setOpen(true)}><Link2 className="h-4 w-4"/>{!compact&&<span className="ml-2">Agency portal link</span>}</Button>{open&&<AgencyLinksDialog vendorId={vendorId} open={open} onOpenChange={setOpen}/>}</div>;
}
function AgencyLinksDialog({vendorId,open,onOpenChange}:{vendorId:string;open:boolean;onOpenChange:(value:boolean)=>void}) {
 const {user}=useAuth(),[label,setLabel]=useState(''),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false);
 const links=useQuery({queryKey:['agency-portal-links',vendorId],enabled:open,queryFn:async()=>{const {data,error}=await supabase.from('agency_portal_tokens').select('id,label,expires_at').eq('vendor_id',vendorId).eq('active',true).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false});if(error)throw error;return data||[];}});
 const url=selected?agencyUrl(selected):'';
 return <Dialog open={open} onOpenChange={v=>{if(!busy)onOpenChange(v);}}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Agency portal links</DialogTitle><DialogDescription>Links expire after 120 days. Share only with this agency.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(busy||!user)return;setBusy(true);try{const {data,error}=await supabase.from('agency_portal_tokens').insert({vendor_id:vendorId,label:label.trim()||null,created_by:user.id,expires_at:agencyExpiry()}).select('id').single();if(error)throw error;setSelected(data.id);await links.refetch();toast.success('Agency portal link created');}catch{toast.error('Unable to create portal link');}finally{setBusy(false);}}}><Label htmlFor="agency-link-label">Label (optional)</Label><Input id="agency-link-label" value={label} maxLength={100} disabled={busy} onChange={e=>setLabel(e.target.value)}/><Button disabled={busy} type="submit">{busy?<Loader2 className="h-4 w-4 mr-2 animate-spin"/>:<Plus className="h-4 w-4 mr-2"/>}Create portal link</Button></form>{url&&<LinkRow highlight label={label.trim()||'New portal link'} meta="Just created" url={url} qrTitle="Agency portal link"/>}<LinkSection storageKey={`agency:${vendorId}`} title="Agency portal links" count={links.data?.length}>{links.isLoading?<Loader2 className="animate-spin my-2"/>:links.error?<div role="alert"><p>Unable to load links.</p><Button variant="outline" onClick={()=>links.refetch()}>Try again</Button></div>:links.data?.map(link=><LinkRow key={link.id} highlight={selected===link.id} label={link.label||'Agency portal'} meta={`Expires ${new Date(link.expires_at).toLocaleDateString()}`} url={agencyUrl(link.id)} qrTitle="Agency portal link" busy={busy} revokeLabel="Revoke agency portal link" onRevoke={async()=>{setBusy(true);try{const {error}=await supabase.from('agency_portal_tokens').update({active:false}).eq('id',link.id).eq('vendor_id',vendorId).select('id').single();if(error)throw error;if(selected===link.id)setSelected('');await links.refetch();toast.success('Portal link revoked');}catch{toast.error('Unable to revoke link');}finally{setBusy(false);}}}/>)}{links.data?.length===0&&<p className="text-sm text-muted-foreground py-2">No active links.</p>}</LinkSection></DialogContent></Dialog>;
}