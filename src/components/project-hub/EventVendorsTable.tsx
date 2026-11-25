import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, MoreHorizontal, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProjectVendors, useSetProjectVendor } from '@/integrations/supabase/hooks/useProjectVendors';
import { useDeploymentHours } from '@/hooks/useDeploymentHours';
import { useUserRole } from '@/hooks/useUserRole';
import type { ProjectLocation } from '@/integrations/supabase/hooks/useProjectLocations';
import { currentWeekStart, addDays } from '@/lib/shifts';
import { dedupeWeekEntries, groupVendors, insuranceWarning, normName, type VendorRow } from '@/lib/eventOverview';
import { AddProjectVendor } from './ProjectVendorPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type Person = { id: string; name: string; vendor_id: string };
const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const hrs = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function EventVendorsTable({ projectId, locations }: { projectId: string; locations: ProjectLocation[] }) {
  const vendors = useProjectVendors(projectId), save = useSetProjectVendor(projectId);
  const { isAdmin, isManager } = useUserRole(), canWrite = isAdmin || isManager;
  const from = currentWeekStart(), to = addDays(from, 6);
  const hours = useDeploymentHours(projectId, from, to);
  const ids = vendors.data.map(v => v.id), locIds = locations.map(l => l.id);
  const detail = useQuery({ queryKey: ['event-vendor-detail', projectId, ids.slice().sort(), locIds.slice().sort(), canWrite], enabled: ids.length > 0, queryFn: async () => {
    const [v, p] = await Promise.all([
      supabase.from('vendors').select('id,vendor_type,w9_on_file,insurance_expiry').in('id', ids),
      supabase.from('personnel').select('id,first_name,last_name,vendor_id').in('vendor_id', ids),
    ]);
    if (v.error) throw v.error; if (p.error) throw p.error;
    const people: Person[] = (p.data ?? []).map(x => ({ id: x.id, name: `${x.first_name ?? ''} ${x.last_name ?? ''}`.trim(), vendor_id: x.vendor_id as string }));
    const asg = locIds.length ? await supabase.from('location_assignments').select('personnel_id,location_id,role_label,status,unassigned_at').in('location_id', locIds) : { data: [], error: null };
    if (asg.error) throw asg.error;
    let rates: Record<string, number> = {};
    if (canWrite && locIds.length) { const r = await supabase.from('location_requirements').select('location_id,role_label,bill_rate').in('location_id', locIds); if (r.error) throw r.error; rates = Object.fromEntries((r.data ?? []).filter(x => x.bill_rate != null).map(x => [`${x.location_id}|${normName(x.role_label || '')}`, Number(x.bill_rate)])); }
    return { vendors: new Map((v.data ?? []).map(x => [x.id, x])), people, assignments: asg.data ?? [], rates };
  }});
  const [search, setSearch] = useState(''), [showInd, setShowInd] = useState(false), [expanded, setExpanded] = useState<Set<string>>(new Set());

  const model = useMemo(() => {
    if (!detail.data) return null;
    const now = Date.now(), d = detail.data;
    const active = new Set(d.assignments.filter(a => a.status === 'active' && (!a.unassigned_at || Date.parse(a.unassigned_at) > now)).map(a => a.personnel_id));
    const roleAt = new Map<string, string>(); for (const a of d.assignments) if (a.role_label && (a.status === 'active' || !roleAt.has(`${a.location_id}|${a.personnel_id}`))) roleAt.set(`${a.location_id}|${a.personnel_id}`, a.role_label);
    const ph = new Map<string, number>(), pb = new Map<string, number>();
    for (const e of dedupeWeekEntries(hours.data ?? []).rows) {
      if (!e.personnel_id || e.effHours <= 0) continue;
      ph.set(e.personnel_id, (ph.get(e.personnel_id) || 0) + e.effHours);
      const role = roleAt.get(`${e.location_id}|${e.personnel_id}`), rate = role ? d.rates[`${e.location_id}|${normName(role)}`] : undefined;
      if (e.billable !== false && rate) pb.set(e.personnel_id, (pb.get(e.personnel_id) || 0) + e.effHours * rate);
    }
    const byVendor = new Map<string, Person[]>(); for (const p of d.people) byVendor.set(p.vendor_id, [...(byVendor.get(p.vendor_id) || []), p]);
    const rows: (VendorRow & { people: Person[] })[] = vendors.data.map(v => { const people = byVendor.get(v.id) || [], meta = d.vendors.get(v.id); return { id: v.id, name: v.name, vendor_type: meta?.vendor_type, w9: meta?.w9_on_file, insurance_expiry: meta?.insurance_expiry, people, peopleTotal: people.length, onEventNow: people.filter(p => active.has(p.id)).length, hoursWeek: people.reduce((s, p) => s + (ph.get(p.id) || 0), 0), billWeek: people.reduce((s, p) => s + (pb.get(p.id) || 0), 0) }; });
    return { ...groupVendors(rows), active, ph, rows };
  }, [detail.data, hours.data, vendors.data]);

  const remove = async (id: string, name: string) => { try { await save.mutateAsync({ vendorId: id, active: false }); toast.success(`${name} removed from project; history retained`); } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to remove vendor'); } };
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());
  const match = (r: VendorRow) => !search.trim() || normName(r.name).includes(normName(search));
  const Menu = ({ r }: { r: VendorRow }) => <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Actions for ${r.name}`}><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link to={`/vendors/${r.id}`}>Open vendor</Link></DropdownMenuItem>{canWrite && <DropdownMenuItem className="text-destructive" disabled={save.isPending} onSelect={() => remove(r.id, r.name)}>Remove from project</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>;
  const Flags = ({ r }: { r: VendorRow }) => { const dup = model?.duplicateOf(r) ?? [], ins = insuranceWarning(r.insurance_expiry, today); return <>{dup.length > 0 && <Link to={`/vendors/${dup[0]}`} title="Same name as another vendor on this event — open the other record"><Badge variant="outline" className="border-warning text-warning whitespace-nowrap">Possible duplicate</Badge></Link>}{r.peopleTotal === 0 && <Badge variant="outline" className="whitespace-nowrap">No people linked</Badge>}{ins && <Badge variant="outline" className={`whitespace-nowrap ${ins === 'expired' ? 'border-destructive text-destructive' : 'border-warning text-warning'}`}>Insurance {ins === 'expired' ? 'expired' : 'expires'} {r.insurance_expiry}</Badge>}</>; };

  const agencies = model?.agencies.filter(match) ?? [], individuals = model?.individuals.filter(match) ?? [];
  const indOnEvent = model?.individuals.filter(r => r.onEventNow > 0).length ?? 0;
  return <section className="space-y-2 border-b pb-4" aria-label="Vendors and agencies">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Vendors &amp; agencies <span className="text-muted-foreground font-normal">· {model?.agencies.length ?? 0} agenc{(model?.agencies.length ?? 0) === 1 ? 'y' : 'ies'}, {model?.individuals.length ?? 0} individual{(model?.individuals.length ?? 0) === 1 ? '' : 's'}</span></h2><AddProjectVendor projectId={projectId}/></div>
    {vendors.isLoading || (ids.length > 0 && detail.isLoading) ? <p className="text-sm text-muted-foreground">Loading vendors…</p> : vendors.error || detail.error ? <p role="alert" className="text-sm text-destructive">Unable to load project vendors.</p> : !vendors.data.length ? <p className="text-sm text-muted-foreground">No vendors or agencies assigned</p> : <>
      {vendors.data.length > 8 && <Input aria-label="Search vendors" placeholder="Search vendors…" className="h-9" value={search} onChange={e => setSearch(e.target.value)}/>}
      <div><h3 className="text-xs font-medium uppercase text-muted-foreground mb-1">Agencies</h3>
        {!agencies.length ? <p className="text-sm text-muted-foreground">None</p> : <ul className="divide-y rounded-md border">{agencies.map(r => { const open = expanded.has(r.id); return <li key={r.id}>
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} people for ${r.name}`} onClick={() => setExpanded(s => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}>{open ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</Button>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1"><Link to={`/vendors/${r.id}`} className="font-medium truncate hover:underline">{r.name}</Link><Flags r={r}/></div>
              <div className="text-xs text-muted-foreground"><span title="People from this agency actively assigned to an event location / all people linked">{r.onEventNow} on event / {r.peopleTotal} people</span> · <span title="Counted hours this week (Crew-view rules)">{hrs(r.hoursWeek)} h this week</span>{canWrite && <> · <span title="Est. billable this week from site role bill rates; rate-less hours not counted">{money(r.billWeek)} est.</span></>}</div></div>
            <Menu r={r}/></div>
          {open && <ul className="pl-12 pr-2 pb-2 text-sm space-y-0.5">{[...(r as VendorRow & { people: Person[] }).people].sort((a, b) => Number(model!.active.has(b.id)) - Number(model!.active.has(a.id)) || (model!.ph.get(b.id) || 0) - (model!.ph.get(a.id) || 0)).map(p => <li key={p.id} className="flex justify-between gap-2"><Link to={`/personnel/${p.id}`} className="truncate hover:underline">{p.name || 'Unnamed'}</Link><span className="shrink-0 text-xs text-muted-foreground">{model!.active.has(p.id) ? 'On event' : 'Not on event'} · {hrs(model!.ph.get(p.id) || 0)} h</span></li>)}</ul>}
        </li>; })}</ul>}
      </div>
      <div><button type="button" className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground min-h-8" aria-expanded={showInd || !!search.trim()} onClick={() => setShowInd(v => !v)}>{showInd || search.trim() ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}Individual contractors (1099) · {model?.individuals.length ?? 0} ({indOnEvent} on event now)</button>
        {(showInd || !!search.trim()) && (!individuals.length ? <p className="text-sm text-muted-foreground">None</p> : <ul className="divide-y rounded-md border">{individuals.map(r => <li key={r.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1"><Link to={`/vendors/${r.id}`} className="truncate hover:underline">{r.name}</Link><Flags r={r}/></div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">{r.onEventNow > 0 ? <span className="text-success">✓ On event now</span> : <span>Not on event</span>}<span>{hrs(r.hoursWeek)} h this week</span><span className="inline-flex items-center gap-0.5">W-9 {r.w9 ? <Check className="h-3 w-3 text-success" aria-label="on file"/> : <X className="h-3 w-3 text-destructive" aria-label="missing"/>}</span></div></div>
          <Menu r={r}/></li>)}</ul>)}
      </div>
    </>}
  </section>;
}
