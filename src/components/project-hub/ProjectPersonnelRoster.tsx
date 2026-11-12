import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProjectPersonnelRoster,useSetProjectPersonnelRoster } from '@/integrations/supabase/hooks/useProjectPersonnelRoster';
import { useActivePersonnelLite } from '@/integrations/supabase/hooks/useLocationStaffing';
import { useProjectVendors } from '@/integrations/supabase/hooks/useProjectVendors';
import { AddProjectVendor } from './ProjectVendorPicker';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { BenchStar } from '@/components/personnel/PersonnelTags';
import { SEGMENT_LABEL,personnelSegment,pickerCompare } from '@/lib/personnelSegment';
import { Plus,X } from 'lucide-react';
import { toast } from 'sonner';
export function AddToProject({projectId,onAdded}:{projectId:string;onAdded?:(id:string)=>void}) {
  const {isAdmin,isManager}=useUserRole(),[open,setOpen]=useState(false),[search,setSearch]=useState('');
  const roster=useProjectPersonnelRoster(projectId),vendors=useProjectVendors(projectId),save=useSetProjectPersonnelRoster(projectId);
  const directory=useQuery({queryKey:['project-personnel-directory',search],enabled:open&&(isAdmin||isManager),queryFn:async()=>{const {data,error}=await supabase.rpc('project_personnel_directory',{p_search:search.trim()});if(error)throw error;return data;}});
  if(!isAdmin&&!isManager)return null;
  const list=(directory.data??[]).filter(p=>!roster.data?.some(r=>r.id===p.id)&&`${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())).sort(pickerCompare).slice(0,150);
  return <><Button type="button" variant="ghost" size="sm" onClick={()=>setOpen(true)}><Plus className="h-4 w-4 mr-1"/>Add to project</Button><Dialog open={open} onOpenChange={v=>{if(!save.isPending)setOpen(v);}}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Add to project</DialogTitle></DialogHeader><Input aria-label="Search personnel directory" placeholder="Search name…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="max-h-96 overflow-y-auto">{directory.isLoading?<p>Loading personnel…</p>:directory.error?<p role="alert">Unable to load personnel.</p>:!list.length?<p className="text-sm text-muted-foreground">No matching personnel.</p>:list.map((p,i)=>{const segment=personnelSegment(p),missingVendor=!!p.vendor_id&&!vendors.data?.some(v=>v.id===p.vendor_id);return <div key={p.id}>{(i===0||personnelSegment(list[i-1])!==segment)&&<h3 className="text-xs uppercase text-muted-foreground mt-3 mb-1">{SEGMENT_LABEL[segment]}</h3>}<div className="flex items-center gap-2"><Button type="button" variant="ghost" className="flex-1 justify-start min-w-0" disabled={save.isPending||missingVendor} onClick={async()=>{try{await save.mutateAsync({personnelId:p.id,active:true});onAdded?.(p.id);setOpen(false);toast.success('Person added to project');}catch(e){toast.error((e as {message?:string})?.message??'Unable to add person');}}}><BenchStar on={p.on_bench}/><span className="truncate">{p.first_name} {p.last_name}</span><Plus className="ml-auto h-4 w-4 shrink-0"/></Button>{missingVendor&&<AddProjectVendor projectId={projectId}/>}</div></div>;})}</div></DialogContent></Dialog></>;
}
export function ProjectPersonnelRosterSection({projectId}:{projectId:string}) {
  const roster=useProjectPersonnelRoster(projectId),save=useSetProjectPersonnelRoster(projectId),{isAdmin,isManager}=useUserRole();
  return <section className="border-b pb-4 space-y-2"><div className="flex justify-between items-center"><h2 className="text-base font-semibold">Project roster <span className="text-muted-foreground">({roster.data?.length??0})</span></h2><AddToProject projectId={projectId}/></div>{roster.isLoading?<p>Loading personnel…</p>:roster.error?<p role="alert">Unable to load project roster.</p>:!roster.data?.length?<p className="text-sm text-muted-foreground">No personnel on this project yet</p>:<div className="max-h-64 overflow-y-auto grid sm:grid-cols-2 gap-x-6">{roster.data.map(p=><div key={p.id} className="flex items-center gap-2 py-1 text-sm"><BenchStar on={p.on_bench}/><span className="truncate" title={`${p.first_name} ${p.last_name}`}>{p.first_name} {p.last_name}</span>{(isAdmin||isManager)&&<Button type="button" size="icon" variant="ghost" className="h-8 w-8 ml-auto shrink-0" aria-label={`Remove ${p.first_name} ${p.last_name} from project`} disabled={save.isPending} onClick={async()=>{try{await save.mutateAsync({personnelId:p.id,active:false});toast.success('Removed from project roster; history retained');}catch(e){toast.error((e as {message?:string})?.message??'Unable to remove person');}}}><X className="h-4 w-4"/></Button>}</div>)}</div>}</section>;
}