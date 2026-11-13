import { useMyDay } from '@/hooks/useMyDay';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, FileSignature, MapPin, Phone, ArrowRight, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { localTime } from '@/lib/signinSheets';
import { resolveShifts } from '@/lib/shifts';
import { formatLocalDate } from '@/lib/dateUtils';

/** No financial hooks or money fields are mounted in the field Home. */
export function MyDayHome() {
  const query=useMyDay();
  const data=query.data;
  return <div className="space-y-6" aria-label="My Day">
    <section className="space-y-3"><div className="flex justify-between items-center"><h2 className="text-xl font-semibold">My Day</h2><Button size="icon" variant="ghost" aria-label="Refresh My Day" onClick={()=>void query.refetch()}><RefreshCw className="h-4 w-4"/></Button></div>
      {query.isLoading&&<p role="status" className="text-sm text-muted-foreground">Loading your day…</p>}
      {query.error&&<p role="alert" className="text-sm text-destructive">Your day could not load. <Button variant="link" onClick={()=>void query.refetch()}>Retry</Button></p>}
      {data&&!data.sites.length&&<div className="border-y py-5 space-y-2"><p className="font-medium">No site assigned today</p><p className="text-sm text-muted-foreground">{data.linked?'Contact your supervisor for your next assignment.':'Your staff account is not linked to a worker profile. Ask your manager to link it.'}</p></div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{data?.sites.map(l=>{
        const address=[l.address,l.city,l.state,l.zip].filter(Boolean).join(', '), shift=resolveShifts(l,l.project);
        return <article key={l.id} className="border rounded-md p-4 space-y-4"><div><p className="text-xs text-muted-foreground mb-1">{l.project.name}</p><h3 className="font-semibold text-lg break-words">{l.name}</h3></div><Badge variant="outline" className={l.openAt?'text-success border-success/40':'text-muted-foreground'}>{l.openAt?`Checked in ${localTime(l.openAt,l.timezone||'America/Chicago')}`:'Not checked in'}</Badge><div className="space-y-2 text-sm"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address||l.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-primary min-h-11"><MapPin className="h-4 w-4 shrink-0 mt-0.5"/>{address||l.name}</a><p className="flex items-start gap-2"><Clock className="h-4 w-4 shrink-0 mt-0.5"/><span>Day {shift.day}–{shift.dayEnd}<br/>Night {shift.night}–{shift.nightEnd}</span></p></div><div className="border-t pt-3"><p className="text-xs text-muted-foreground mb-1">Site POC</p><p className="text-sm">{l.poc_name||'Not provided'}</p>{l.poc_phone&&<a href={`tel:${l.poc_phone}`} className="text-primary flex items-center gap-2 text-sm min-h-11"><Phone className="h-4 w-4"/>{l.poc_phone}</a>}</div>{l.punchLink?<Button asChild className="w-full h-12"><Link to={`/punch/${l.punchLink}`}><Clock className="h-4 w-4 mr-2"/>{l.openAt?'Clock Out':'Clock In'}</Link></Button>:<p className="text-sm text-muted-foreground">Ask your supervisor for a punch link.</p>}</article>;
      })}</div>
    </section>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><section aria-label="My week" className="border-y py-4"><div className="flex justify-between items-center gap-3"><div><h2 className="font-semibold">My week</h2><p className="text-xs text-muted-foreground mt-1">{data?`Week of ${formatLocalDate(data.week,'MM/dd')} · Chicago time`: 'Chicago time'}</p></div><p className="text-3xl font-semibold tabular-nums">{data?data.hours.toFixed(2):'—'} <span className="text-sm font-normal text-muted-foreground">h</span></p></div></section>
      <section aria-label="My signature requests"><h2 className="font-semibold flex items-center gap-2 border-b pb-2"><FileSignature className="h-4 w-4 text-primary"/>Pending signatures <Badge variant="secondary">{data?.requests.length??0}</Badge></h2><ul className="divide-y">{data?.requests.map(r=><li key={r.id}><Button asChild variant="ghost" className="w-full min-h-12 h-auto justify-between whitespace-normal text-left py-3"><Link to={`/timesheet-sign/${r.link}`}><span>{r.location}<span className="block text-xs text-muted-foreground">{formatLocalDate(r.date,'MM/dd/yyyy')}</span></span><ArrowRight className="h-4 w-4 shrink-0"/></Link></Button></li>)}</ul>{data&&!data.requests.length&&<p className="text-sm text-muted-foreground py-4">No pending signature requests.</p>}</section>
    </div>
  </div>;
}