import { useState } from 'react';
import { loadLocationAuthorization } from '@/hooks/useLocationAuthorization';
import { authorizedTotal } from '@/lib/locationAuthorization';
import { useQuery } from '@tanstack/react-query';
import { useProjectDocuments } from '@/integrations/supabase/hooks/useProjectDocuments';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';
import { loadSheetStays, loadSheetSignature } from '@/lib/signinTemplateData';
import { supabase } from '@/integrations/supabase/client';
import { rowsForDay, localDay, sheetFileName } from '@/lib/signinSheets';
import { generateDailyTimesheet } from '@/lib/dailyTimesheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSheetDays } from './SigninStatusBoard';
import { CustomerSheetApproval, downloadStoredSheet } from './CustomerSheetApproval';
import { SigninSheetsPanel } from '@/components/documents/SigninSheetsPanel';
import { useUserRole } from '@/hooks/useUserRole';
import { useEffect } from 'react';

export function DailyTimesheetPanel({ projectId, projectName, locationId, initialSheet }: { projectId: string; projectName: string; locationId?: string; initialSheet?: { location: string; day: string } }) {
  const { isAdmin, isManager } = useUserRole();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const { data: locations = [] } = useProjectLocations(projectId);
  const { data: docs = [], isLoading: docsLoading, error: docsError } = useProjectDocuments(projectId);
  const [day, setDay] = useState(() => localDay(new Date().toISOString(), 'America/Chicago'));
  const [picked, setPicked] = useState(locationId || '');
  useEffect(() => { if (initialSheet) { setDay(initialSheet.day); setPicked(initialSheet.location); setOpen(true); } }, [initialSheet]);
  const selected = locations.filter(l => l.id === (locationId || picked) || !(locationId || picked));
  const { data: stays = [], isLoading, error } = useQuery({ queryKey: ['signin-sheet-stays', projectId, day, day], enabled: open && !!day, queryFn: () => loadSheetStays(projectId, locations, day, day) });
  const { data: saved = [], error: savedError } = useSheetDays(selected.map(l => l.id), day, day, open && !!day);
  return <>
    <Button size="sm" variant="outline" onClick={() => { const l = locations.find(l => l.id === locationId); if (l) setDay(localDay(new Date().toISOString(), l.timezone || 'America/Chicago')); setOpen(true); }}><Download className="h-4 w-4 mr-1" />Daily timesheet (PDF)</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Daily Timesheet Report</DialogTitle></DialogHeader>
      <Label htmlFor={`daily-day-${locationId || projectId}`}>Date</Label><Input id={`daily-day-${locationId || projectId}`} type="date" value={day} onChange={e => setDay(e.target.value)} />
      {!day ? <p className="text-muted-foreground">Select a date.</p> : isLoading || docsLoading ? <Loader2 className="animate-spin" /> : error || savedError || docsError ? <p role="alert" className="text-destructive">Unable to load sheets. Refresh to try again.</p> : selected.map(location => {
        const template = docs.find(d => d.is_signin_template && (d.location_id === location.id || d.location_ids?.includes(location.id)));
        const zone = location.timezone || 'America/Chicago', rows = rowsForDay(stays, location.id, day, zone);
        const sheet = saved.find(s => s.location_id === location.id && s.sheet_date === day);
        const generate = async () => {const levels=await loadLocationAuthorization(location.id,day);const approval=sheet?.status==='locked'&&sheet.countersign_url?{name:sheet.countersign_name,signature:sheet.countersign_url,at:sheet.countersigned_at}:undefined;return generateDailyTimesheet(rows, { day, zone, projectNumber: location.project_number || '', mission: projectName, location: location.name, authorized: levels===null?undefined:authorizedTotal(levels,'position'), approval }, loadSheetSignature);};
        return <section key={location.id} className="border-b pb-3 space-y-2"><h3 className="font-medium">{location.name} · {day}</h3>{template&&<SigninSheetsPanel doc={template} projectName={projectName}/>}<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || !day} onClick={async () => { setBusy(true); try {
          const name = `FRG-${sheetFileName(location.name, day)}`;
          if (!template && sheet?.status === 'locked' && sheet.pdf_url) await downloadStoredSheet(sheet.pdf_url, name);
          else { const bytes = await generate(); const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
        } catch (e) { toast.error(e instanceof Error ? e.message : 'PDF unavailable'); } finally { setBusy(false); } }}><Download className="h-4 w-4 mr-1" />FRG daily report</Button>
          {template&&<Button size="sm" variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{const {generateSigninSheet}=await import('@/lib/signinSheets');const {loadDocumentFields}=await import('@/lib/documentSignFields');const name=`Customer-${sheetFileName(location.name,day)}`;if(sheet?.status==='locked'&&sheet.pdf_url){await downloadStoredSheet(sheet.pdf_url,name);}else{const {data,error}=await supabase.storage.from('project-documents').download(template.file_path);if(error||!data)throw error||new Error('Template unavailable');const bytes=await generateSigninSheet(await data.arrayBuffer(),await loadDocumentFields(template.id),rows,{rowsPerPage:template.rows_per_page??12,rowHeight:template.row_height_pct??0.045,zone,day,project:projectName,mission:location.project_number||'',location:location.name,address:[location.address,location.city,location.state,location.zip].filter(Boolean).join(', ')},loadSheetSignature);const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}}catch(e){toast.error(e instanceof Error?e.message:'Template unavailable');}finally{setBusy(false);}}}><Download className="h-4 w-4 mr-1"/>Customer sheet (template)</Button>}
          {!template&&(isAdmin || isManager) && <CustomerSheetApproval documentId={null} location={location} day={day} sheet={sheet} generate={generate} hasOpenRows={rows.some(r => !r.outAt)} />}</div>
          {rows.map(row => <div className="flex justify-between gap-2 text-sm" key={row.id}><span>{row.name}</span><span>{row.hours == null ? 'On site' : `${row.hours.toFixed(2)} h`}</span></div>)}
        </section>;
      })}
    </DialogContent></Dialog>
  </>;
}