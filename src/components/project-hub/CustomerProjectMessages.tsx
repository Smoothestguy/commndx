import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/contexts/AuthContext';
import {useUserRole} from '@/hooks/useUserRole';
import {useCustomerProjectInvalidation} from '@/hooks/useCustomerProject';
import {CustomerThread} from '@/components/customer-portal/CustomerThread';
import {useCustomers} from '@/integrations/supabase/hooks/useCustomers';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Send,Loader2} from 'lucide-react';
import {toast} from 'sonner';
export function CustomerProjectMessages({projectId,customerId}:{projectId:string;customerId:string}){
 const {user}=useAuth(),{isAdmin,isManager}=useUserRole(),canWrite=isAdmin||isManager,invalidate=useCustomerProjectInvalidation(),{data:customers=[]}=useCustomers();const [customer,setCustomer]=useState(customerId),[body,setBody]=useState(''),[busy,setBusy]=useState(false);
 const messages=useQuery({queryKey:['project-customer-messages',projectId],refetchInterval:60000,queryFn:async()=>{const rows=[];for(let offset=0;;offset+=500){const {data,error}=await supabase.from('project_customer_messages').select('*').eq('project_id',projectId).order('created_at').order('id').range(offset,offset+499);if(error)throw error;rows.push(...data??[]);if((data??[]).length<500)break;}return rows;}});
 const profile=useQuery({queryKey:['customer-reply-name',user?.id],enabled:!!user&&canWrite,queryFn:async()=>{if(!user)return null;const {data,error}=await supabase.from('profiles').select('first_name,last_name').eq('id',user.id).single();if(error)throw error;return [data.first_name,data.last_name].filter(Boolean).join(' ')||'FRG';}});
 const unread=messages.data?.filter(m=>m.customer_id===customer&&m.sender==='customer'&&!m.read_at).map(m=>m.id).join(',')||'';
 useEffect(()=>{if(!canWrite||!unread)return;let live=true;const mark=async()=>{const {error}=await supabase.from('project_customer_messages').update({read_at:new Date().toISOString()}).eq('project_id',projectId).eq('sender','customer').is('read_at',null).in('id',unread.split(','));if(error){if(live)toast.error('Unable to mark customer messages read');return;}await invalidate();};void mark();return()=>{live=false;};},[unread,canWrite,projectId,customer]);
 const customerIds=[...new Set([customerId,...(messages.data??[]).map(m=>m.customer_id)])];
 return <section id="customer-messages" className="space-y-3"><h2 className="text-lg font-semibold">Customer messages</h2>{messages.isLoading?<Loader2 className="animate-spin"/>:messages.error?<p role="alert" className="text-destructive">Unable to load customer messages.</p>:<CustomerThread customerRight={false} messages={(messages.data??[]).filter(m=>m.customer_id===customer).map(m=>({...m,at:m.created_at}))}/>}<div className="max-w-sm"><Label htmlFor="reply-customer">Customer</Label><Select value={customer} onValueChange={setCustomer}><SelectTrigger id="reply-customer"><SelectValue placeholder="Customer"/></SelectTrigger><SelectContent>{customerIds.map(id=><SelectItem key={id} value={id}>{customers.find(c=>c.id===id)?.name||'Customer'}</SelectItem>)}</SelectContent></Select></div>{canWrite&&<form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(busy||!body.trim()||!profile.data)return;setBusy(true);try{const {error}=await supabase.from('project_customer_messages').insert({project_id:projectId,customer_id:customer,sender:'frg',sender_name:profile.data,body:body.trim()});if(error)throw error;setBody('');await invalidate();}catch{toast.error('Unable to confirm reply. Check the thread before retrying.');}finally{setBusy(false);}}}><Label htmlFor="frg-customer-reply">FRG reply</Label><Textarea id="frg-customer-reply" value={body} maxLength={4000} disabled={busy} onChange={e=>setBody(e.target.value)}/><Button type="submit" disabled={busy||!body.trim()||!profile.data}><Send className="h-4 w-4 mr-2"/>{busy?'Sending…':'Send reply'}</Button></form>}</section>;
}