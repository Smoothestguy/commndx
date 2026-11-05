import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
export function SaveCrewPrompt({ projectId, ids, visitId, onDone }: { projectId: string; ids: string[]; visitId: string; onDone: () => void }) {
  const [name,setName]=useState('');const qc=useQueryClient();
  const save=useMutation({mutationFn:async()=>{const {data:crew,error}=await supabase.from('crews').insert({project_id:projectId,name:name.trim()}).select('id').single();if(error)throw error;const {error:members}=await supabase.from('crew_members').insert([...new Set(ids)].map(personnel_id=>({crew_id:crew.id,personnel_id})));if(members)throw members;const {error:link}=await supabase.from('location_visits').update({crew_id:crew.id}).eq('id',visitId);if(link)throw link;},onSuccess:()=>{qc.invalidateQueries({queryKey:['crews',projectId]});qc.invalidateQueries({queryKey:['today-visits',projectId]});onDone();},onError:e=>toast.error(e.message)});
  return <div className="border border-border rounded-md p-4 space-y-3"><p className="font-semibold">Save these {ids.length} as a crew?</p><Input aria-label="Crew name" value={name} onChange={e=>setName(e.target.value)} /><div className="flex gap-2"><Button disabled={!name.trim()||save.isPending} onClick={()=>save.mutate()}>Save crew</Button><Button variant="ghost" disabled={save.isPending} onClick={onDone}>Dismiss</Button></div></div>;
}