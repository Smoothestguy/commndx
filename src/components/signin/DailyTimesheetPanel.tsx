import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProjectDocuments } from '@/integrations/supabase/hooks/useProjectDocuments';
import { useProjectLocations } from '@/integrations/supabase/hooks/useProjectLocations';
import { loadSheetStays, loadSheetSignature } from '@/lib/signinTemplateData';
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
      {isLoading || docsLoading ? <Loader2 className="animate-spin" /> : error || savedError || docsError ? <p role="alert" className="text-destructive">Unable to load sheets. Refresh to try again.</p> : selected.map(location => {
        const template = docs.find(d => d.is_signin_template && (d.location_id === location.id || d.location_ids?.includes(location.id)));
        if (template) return <section key={location.id}><h3 className="font-medium">{location.name}</h3><SigninSheetsPanel doc={template} projectName={projectName} initialSheet={{ location: location.id, day }} /></section>;
        const zone = location.timezone || 'America/Chicago', rows = rowsForDay(stays, location.id, day, zone);
        const sheet = saved.find(s => s.location_id === location.id && s.sheet_date === day);
        const generate = () => generateDailyTimesheet(rows, { day, zone, projectNumber: location.project_number || '', mission: projectName, location: location.name }, loadSheetSignature);
        return <section key={location.id} className="border-b pb-3 space-y-2"><h3 className="font-medium">{location.name} · {day}</h3><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || !day} onClick={async () => { setBusy(true); try {
          const name = sheetFileName(location.name, day);
          if (sheet?.status === 'locked' && sheet.pdf_url) await downloadStoredSheet(sheet.pdf_url, name);
          else { const bytes = await generate(); const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
        } catch (e) { toast.error(e instanceof Error ? e.message : 'PDF unavailable'); } finally { setBusy(false); } }}><Download className="h-4 w-4 mr-1" />Daily timesheet (PDF)</Button>
          {(isAdmin || isManager) && <CustomerSheetApproval documentId={null} location={location} day={day} sheet={sheet} generate={generate} hasOpenRows={rows.some(r => !r.outAt)} />}</div>
          {rows.map(row => <div className="flex justify-between gap-2 text-sm" key={row.id}><span>{row.name}</span><span>{row.hours == null ? 'On site' : `${row.hours.toFixed(2)} h`}</span></div>)}
        </section>;
      })}
    </DialogContent></Dialog>
  </>;
}