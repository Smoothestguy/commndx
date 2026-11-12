import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {midnight,nextDay} from '@/lib/signinSheets';
import {attendanceEligible} from '@/lib/attendanceEligibility';
import {fetchDemobilizedKeys} from '@/integrations/supabase/hooks/useLocationStaffing';
async function all<T>(q:(offset:number)=>PromiseLike<{data:T[]|null;error:unknown}>){const rows:T[]=[];for(let o=0;;o+=500){const r=await q(o);if(r.error)throw r.error;rows.push(...r.data??[]);if((r.data??[]).length<500)return rows;}}
/** Strict project/location IDs; attendance eligibility is historical, not the live operational roster. */
export function useAttendanceRoster(projectId:string,locationId:string|undefined,day:string,zone:string,enabled=true){
 return useQuery({queryKey:['attendance-roster',projectId,locationId,day,zone],enabled:enabled&&!!locationId&&!!day,queryFn:async()=>{
  if(!locationId)return [];
  const start=new Date(midnight(day,zone)).toISOString(),end=new Date(midnight(nextDay(day),zone)).toISOString();
  const {data:location,error:le}=await supabase.from('project_locations').select('id').eq('id',locationId).eq('project_id',projectId).single();if(le||!location)throw le||new Error('Location unavailable');
  const [assignments,stays,entries,membership]=await Promise.all([
   all(o=>supabase.from('location_assignments').select('personnel_id,role_label,assigned_at,unassigned_at').eq('location_id',locationId).lt('assigned_at',end).or(`unassigned_at.is.null,unassigned_at.gt.${start}`).order('id').range(o,o+499)),
   all(o=>supabase.from('personnel_location_trail').select('personnel_id').eq('project_id',projectId).eq('location_id',locationId).lt('in_at',end).or(`out_at.is.null,out_at.gt.${start}`).order('visit_personnel_id').range(o,o+499)),
   all(o=>supabase.from('time_entries').select('personnel_id').eq('project_id',projectId).eq('location_id',locationId).eq('entry_date',day).order('id').range(o,o+499)),
   supabase.rpc('project_personnel_roster',{p_project:projectId}).then(r=>{if(r.error)throw r.error;return r.data;})
  ]);
  const eligibleAssignments=assignments.filter(a=>membership?.some(p=>p.id===a.personnel_id));
  const ids=[...new Set([...eligibleAssignments,...stays,...entries].flatMap(r=>r.personnel_id?[r.personnel_id]:[]))];
  const names=[];for(let o=0;o<ids.length;o+=200){const r=await supabase.from('personnel_directory').select('id,first_name,last_name').in('id',ids.slice(o,o+200));if(r.error)throw r.error;names.push(...r.data??[]);}
  const demob=await fetchDemobilizedKeys(ids);
  return ids.filter(id=>attendanceEligible(assignments.some(a=>a.personnel_id===id),stays.some(a=>a.personnel_id===id),entries.some(a=>a.personnel_id===id))).map(id=>({personnel_id:id,role_label:assignments.find(a=>a.personnel_id===id)?.role_label??null,assignedOnDay:assignments.some(a=>a.personnel_id===id),demobilized:demob.has(`${id}:${projectId}`),personnel:names.find(n=>n.id===id)??null}));
 }});
}