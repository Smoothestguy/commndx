import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useUserRole } from '@/hooks/useUserRole';
import { moveDefaultChoices, moveFieldLabel, type OnboardingChoice, type MoveOnboardingPreview } from '@/lib/moveOnboarding';
import { toast } from 'sonner';

export async function previewOnboardingMove(source: string, target: string): Promise<MoveOnboardingPreview> {
  const { data, error } = await supabase.rpc('preview_move_onboarding', {p_source:source,p_target:target});
  if (error) throw error;
  return data as unknown as MoveOnboardingPreview;
}
export function MoveOnboardingPair({ source, target }: {source:string;target:string}) {
  const { isAdmin } = useUserRole();
  const [open,setOpen] = useState(false);
  const preview = useQuery({queryKey:['move-onboarding-preview',source,target],queryFn:()=>previewOnboardingMove(source,target),enabled:isAdmin,staleTime:0,gcTime:0,retry:false});
  if (!isAdmin || !preview.data?.eligible) return null;
  return <>
    <Button size="sm" variant="outline" onClick={()=>setOpen(true)}>Move onboarding to {preview.data.target.personnel_number}</Button>
    {open && <MoveOnboardingDialog source={source} target={target} onClose={()=>setOpen(false)} />}
  </>;
}
function display(value: unknown): string { return value == null || value === '' ? '—' : value === true ? 'Yes' : value === false ? 'No' : String(value); }

export function MoveOnboardingDialog({ source,target,onClose }: {source:string;target:string;onClose:()=>void}) {
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [choices,setChoices] = useState<Record<string,OnboardingChoice>>({});
  const preview = useQuery({queryKey:['move-onboarding-confirm',source,target],queryFn:()=>previewOnboardingMove(source,target),enabled:isAdmin,staleTime:0,gcTime:0,retry:false});
  useEffect(()=>{if(preview.data) setChoices(moveDefaultChoices(preview.data.fields));},[preview.data]);
  const move = useMutation({
    mutationFn:async()=>{
      const {data,error} = await supabase.rpc('move_onboarding_to_personnel',{p_source:source,p_target:target,p_choices:choices});
      if(error) throw error;
      return data as unknown as {tables:Record<string,{moved:number;skipped:number}>};
    },
    onSuccess:async(data)=>{
      const skipped=Object.values(data.tables).reduce((n,t)=>n+t.skipped,0);
      toast.success(skipped ? `Onboarding moved · ${skipped} duplicate rows kept on source` : 'Onboarding moved');
      onClose();
      await Promise.all(['personnel-duplicate-groups','personnel-duplicate-history','personnel','personnel-detail','move-onboarding-preview','personnel-onboarding','personnel-documents'].map(key=>qc.invalidateQueries({queryKey:[key]})));
    },
    onError:(e:Error)=>{toast.error(e.message);qc.invalidateQueries({queryKey:['move-onboarding-preview']});},
  });
  const data=preview.data;
  if(!isAdmin) return null;
  return <Dialog open onOpenChange={open=>{if(!open&&!move.isPending) onClose();}}>
    <DialogContent className="sm:max-w-4xl max-h-[90dvh] flex flex-col overflow-hidden" onInteractOutside={e=>{if(move.isPending)e.preventDefault();}} onEscapeKeyDown={e=>{if(move.isPending)e.preventDefault();}}>
      <DialogHeader><DialogTitle>Move onboarding</DialogTitle><DialogDescription>Only use if both records are the same person.</DialogDescription></DialogHeader>
      <div className="min-h-0 overflow-y-auto space-y-4 pr-1">
        {preview.isLoading && <p>Checking records…</p>}
        {preview.isError && <p className="text-destructive">{preview.error.message}</p>}
        {data && <>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['source','target'] as const).map(side=><section key={side} className="min-w-0 space-y-1 text-sm">
              <p className="text-muted-foreground capitalize">{side === 'source' ? 'From · onboarding record' : 'To · working record'}</p>
              <p className="font-semibold break-words">{data[side].name} · {data[side].personnel_number}</p>
              <p>{data[side].phone ?? 'No phone'}</p>
              <p>SSN last four: {data[side].ssn_last4 ?? '—'} · Bank last four: {data[side].bank_last4 ?? '—'}</p>
            </section>)}
          </div>
          {!data.eligible && <div className="text-destructive text-sm">{data.reasons.join(' · ')}</div>}
          <section className="text-sm space-y-2"><h3 className="font-semibold">Onboarding evidence</h3>
            <div className="flex flex-wrap gap-2">{Object.entries(data.counts).filter(([,c])=>c.source>0).map(([table,c])=><Badge variant="secondary" key={table} className="whitespace-normal">{moveFieldLabel(table)}: {c.move} moving{c.skip>0?` · ${c.skip} kept on source`:''}</Badge>)}</div>
            <p>Onboarding completion: source → target{data.portal_login_action==='move' ? ' · Portal login moves to target' : ''}</p>
          </section>
          <section className="text-sm space-y-1"><h3 className="font-semibold">Target stays unchanged</h3>
            <p>{data.target_untouched.time_entries} time entries · {data.target_untouched.personnel_project_assignments} project assignments · {data.target_untouched.location_assignments} site assignments</p>
            <p>Clock-in link: {data.target_untouched.site_checkin_tokens>0?'preserved':'none'} · Attendance, stays and payments are not moved.</p>
          </section>
          <div className="space-y-2">
            {data.fields.map(f=><div key={f.field} className="grid gap-2 border-t border-border py-3 text-sm sm:grid-cols-[minmax(130px,1fr)_minmax(0,2fr)_minmax(150px,1fr)]">
              <div><p className="font-medium break-words">{moveFieldLabel(f.field)}</p><Badge variant={f.action==='conflict'?'outline':'secondary'}>{f.action}</Badge></div>
              <div className="min-w-0 break-words"><p><span className="text-muted-foreground">Source: </span>{display(f.source)}</p><p><span className="text-muted-foreground">Target: </span>{display(f.target)}</p>{f.note&&<p className="text-xs text-muted-foreground">{f.note}</p>}</div>
              {(f.action==='conflict'||f.mode==='contact') && <RadioGroup aria-label={moveFieldLabel(f.field)} value={choices[f.field]} disabled={move.isPending} onValueChange={v=>setChoices(c=>({...c,[f.field]:v as OnboardingChoice}))} className="flex gap-4 sm:flex-col sm:gap-2">
                {(['source','target'] as const).map(side=><div key={side} className="flex items-center gap-2"><RadioGroupItem id={`move-${f.field}-${side}`} value={side}/><Label htmlFor={`move-${f.field}-${side}`} className="capitalize">{side}</Label></div>)}
              </RadioGroup>}
            </div>)}
          </div>
        </>}
      </div>
      <DialogFooter><Button variant="outline" disabled={move.isPending} onClick={onClose}>Cancel</Button><Button disabled={!data?.eligible||move.isPending||preview.isFetching} onClick={()=>move.mutate()}>{move.isPending?'Moving…':'Confirm move'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}