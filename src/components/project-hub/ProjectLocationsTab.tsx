import { Time24Input } from '@/components/ui/time24-input';
import { DailyTimesheetPanel } from '@/components/signin/DailyTimesheetPanel';
import { LocationTaskOrders } from './LocationTaskOrders';
import { AuthorizationBadge } from './AuthorizationBadge';
import { useLocationAuthorization } from '@/hooks/useLocationAuthorization';
import { ProjectJoinLinks } from './ProjectJoinLinks';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useNavigationValue } from '@/hooks/useNavigationValue';
import { useLocationScroll } from '@/hooks/useLocationScroll';
import { EntityContextMenu } from '@/components/shared/EntityContextMenu';
import { locationHref } from '@/lib/navigationState';
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useProjectDocuments } from "@/integrations/supabase/hooks/useProjectDocuments";
import { useDocumentSignatures } from "@/integrations/supabase/hooks/useDocumentSignatures";
import { LocationDocumentsLine } from "@/components/documents/LocationDocumentsLine";
import { LocationKioskActions } from '@/components/signin/LocationKioskActions';
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { LocationsGrid } from "./LocationsGrid";
import { LocationsCommandCenter } from "./LocationsCommandCenter";
import { List } from "lucide-react";
import { LocationAssets } from "./LocationAssets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MapPin, Pencil, Phone, Plus, Trash2, Mail, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  ProjectLocation, useAddProjectLocation, useDeleteProjectLocation, useProjectLocations, useUpdateProjectLocation,
} from "@/integrations/supabase/hooks/useProjectLocations";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ROLE_TAGS } from "@/lib/roleTags";
import {
  LocationRequirement, saveLocationRequirements, useLocationRequirements, useLocationStaffingSummary,
} from "@/integrations/supabase/hooks/useLocationStaffing";
import { LocationStaffing, RolePicker } from "./LocationStaffing";
import { LocationLodging } from "./LocationLodging";
import { useLastServiced } from "@/integrations/supabase/hooks/useDeployment";
import { formatLocalDate } from "@/lib/dateUtils";
import { useProject } from "@/integrations/supabase/hooks/useProjects";
import { useCustomers } from '@/integrations/supabase/hooks/useCustomers';
import { getCustomerDisplayName } from '@/utils/customerDisplayName';

type ReqRow = { key: string; id?: string; role_label: string; headcount: string; rate: string };
let rowSeq = 0;
const newRow = (r?: LocationRequirement): ReqRow => ({
  key: `r${++rowSeq}`, id: r?.id, role_label: r?.role_label ?? "",
  headcount: String(r?.headcount_needed ?? 1), rate: r?.bill_rate != null ? String(r.bill_rate) : "",
});

const EMPTY = {
  customer_id: '',
  name: "", project_number: "", scope: "", address: "", city: "", state: "", zip: "",
  poc_name: "", poc_phone: "", poc_email: "", status: "active", sort_order: "",
  housing_provided_by: "none", meals_provided: false as boolean, meals_notes: "", mobe_date: "", demobe_date: "",
  day_shift_start: "", night_shift_start: "", day_shift_end: "", night_shift_end: "", lat: "", lng: "", timezone: "", geofence_radius_m: "300",
};
type FormState = typeof EMPTY;

function ScopeText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 140;
  return (
    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
      {open || !long ? text : `${text.slice(0, 140)}…`}
      {long && (
        <button type="button" className="ml-1 text-primary text-xs underline" onClick={() => setOpen(!open)}>
          {open ? "Less" : "More"}
        </button>
      )}
    </p>
  );
}

export function ProjectLocationsTab({ projectId, projectName, deploymentMode = false, editTargetId, onEditClosed }: { projectId: string; projectName?: string; deploymentMode?: boolean; editTargetId?: string; onEditClosed?: () => void }) {
  const navigate = useNavigate();
  const { isAdmin, isManager } = useUserRole();
  const canWrite = isAdmin || isManager;
  const { data: project } = useProject(projectId);
  const customers=useCustomers();
  const { data: locations = [], isLoading } = useProjectLocations(projectId);
  const authorization = useLocationAuthorization(locations);
  const { data: documents = [] } = useProjectDocuments(projectId);
  const { data: signatures = [] } = useDocumentSignatures(projectId);
  const locationNames = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l.name])), [locations]);
  const add = useAddProjectLocation();
  const update = useUpdateProjectLocation();
  const del = useDeleteProjectLocation();
  const { data: staffing } = useLocationStaffingSummary(locations.map((l) => l.id));
  const { data: lastServiced } = useLastServiced(locations.map((l) => l.id), deploymentMode);

  const viewKey = `locations-view2:${projectId}`;
  type View = "list" | "cards" | "grid";
  const [view, setView] = useState<View>(() => {
    try { const v = localStorage.getItem(viewKey); return v === "cards" || v === "grid" ? v : "list"; } catch { return "list"; }
  });
  const [effectiveView, setUrlView] = useNavigationValue<View>("view", view, ["list", "cards", "grid"]);
  useLocationScroll(!isLoading && !editTargetId);
  const chooseView = (v: View) => { setView(v); setUrlView(v); try { localStorage.setItem(viewKey, v); } catch { /* ignore */ } };
  useEffect(() => { if (effectiveView === "grid") chooseView("list"); }, [effectiveView]);
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const [locationParams]=useSearchParams();
  const targetLocation=locationParams.get('location');
  useEffect(()=>{if(targetLocation&&locations.some(l=>l.id===targetLocation)){chooseView('cards');setScrollTo(targetLocation);}},[targetLocation,locations]);
  useEffect(() => {
    if (!scrollTo || effectiveView !== "cards") return;
    const el = document.getElementById(`location-card-${scrollTo}`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("ring-2", "ring-primary"); setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1600); }
    setScrollTo(null);
  }, [scrollTo, effectiveView]);

  const [editing, setEditing] = useState<ProjectLocation | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<ProjectLocation | null>(null);
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [savingReqs, setSavingReqs] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const qc = useQueryClient();
  const { data: existingReqs, isFetched: reqsFetched } = useLocationRequirements(open && editing ? editing.id : undefined);
  if (open && editing && reqsFetched && !seeded) {
    setRows((existingReqs ?? []).map(newRow));
    setSeeded(true);
  }

  const openNew = () => { setEditing(null); setForm({...EMPTY,customer_id:project?.customer_id||''}); setRows([newRow()]); setSeeded(true); setOpen(true); };
  useEffect(() => { if (locationParams.get('action') === 'new-location' && canWrite) openNew(); }, [canWrite, locationParams.get('action')]);
  const openEdit = (l: ProjectLocation) => {
    setEditing(l);
    setForm({
      customer_id:l.customer_id||project?.customer_id||'',
      lat: l.lat == null ? "" : String(l.lat), lng: l.lng == null ? "" : String(l.lng), timezone: l.timezone ?? "", geofence_radius_m: String(l.geofence_radius_m ?? 300),
      name: l.name, project_number: l.project_number ?? "", scope: l.scope ?? "", address: l.address ?? "",
      city: l.city ?? "", state: l.state ?? "", zip: l.zip ?? "", poc_name: l.poc_name ?? "",
      poc_phone: l.poc_phone ?? "", poc_email: l.poc_email ?? "", status: l.status || "active",
      sort_order: l.sort_order != null ? String(l.sort_order) : "",
      housing_provided_by: l.housing_provided_by || "none", meals_provided: !!l.meals_provided, meals_notes: l.meals_notes ?? "",
      mobe_date: l.mobe_date ?? "", demobe_date: l.demobe_date ?? "",
      day_shift_start: l.day_shift_start?.slice(0, 5) ?? "", night_shift_start: l.night_shift_start?.slice(0, 5) ?? "",
      day_shift_end: l.day_shift_end?.slice(0,5) ?? "", night_shift_end: l.night_shift_end?.slice(0,5) ?? "",
    });
    setRows([]); setSeeded(false);
    setOpen(true);
  };

  useEffect(() => {
    const target = locations.find(l => l.id === editTargetId);
    if (target && canWrite && !editing) openEdit(target);
  }, [editTargetId, canWrite, locations, editing]);

  const save = async () => {
    if (!form.name.trim()) return;
    if (form.poc_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.poc_email.trim())) { toast.error('Enter a valid POC email'); return; }
    const hasLat = !!form.lat.trim(), hasLng = !!form.lng.trim();
    if (hasLat !== hasLng || (hasLat && (!Number.isFinite(Number(form.lat)) || Math.abs(Number(form.lat)) > 90 || !Number.isFinite(Number(form.lng)) || Math.abs(Number(form.lng)) > 180)) || !Number.isFinite(Number(form.geofence_radius_m)) || Number(form.geofence_radius_m) <= 0) { toast.error('Enter valid coordinates and a positive radius'); return; }
    let timezone = form.timezone.trim() || null;
    if (hasLat) {
      const { data, error } = await supabase.functions.invoke('geocode-location', { body: { lat: Number(form.lat), lng: Number(form.lng) } });
      if (error) { toast.error('Could not resolve the location timezone. Location was not saved.'); return; }
      timezone = data.timezone;
    }
    const n = (v: string) => (v.trim() ? v.trim() : null);
    const payload = {
      customer_id:form.customer_id||null,
      lat: hasLat ? Number(form.lat) : null, lng: hasLng ? Number(form.lng) : null, timezone, geofence_radius_m: Number(form.geofence_radius_m),
      project_id: projectId, name: form.name.trim(), project_number: n(form.project_number), scope: n(form.scope),
      address: n(form.address), city: n(form.city), state: n(form.state), zip: n(form.zip),
      poc_name: n(form.poc_name), poc_phone: n(form.poc_phone), poc_email: n(form.poc_email),
      status: form.status, sort_order: form.sort_order.trim() ? Number(form.sort_order) : 0,
      housing_provided_by: form.housing_provided_by, meals_provided: form.meals_provided,
      meals_notes: form.meals_provided ? n(form.meals_notes) : null,
      day_shift_start: n(form.day_shift_start), night_shift_start: n(form.night_shift_start),
      day_shift_end: n(form.day_shift_end), night_shift_end: n(form.night_shift_end),
      ...(deploymentMode ? { mobe_date: form.mobe_date || null, demobe_date: form.demobe_date || null } : {}),
    };
    let locationId: string;
    if (editing) { await update.mutateAsync({ id: editing.id, ...payload }); locationId = editing.id; }
    else locationId = (await add.mutateAsync(payload)).id;
    const clean = rows.filter((r) => r.role_label.trim()).map((r) => ({
      id: r.id, role_label: r.role_label.trim(), headcount_needed: Math.max(0, parseInt(r.headcount) || 0),
      bill_rate: r.rate.trim() ? Number(r.rate) : null,
    }));
    setSavingReqs(true);
    try {
      await saveLocationRequirements(locationId, clean, editing ? existingReqs ?? [] : []);
    } catch (e: any) {
      toast.error(`Location saved, but positions failed: ${e?.message ?? e}`);
      return;
    } finally {
      setSavingReqs(false);
      qc.invalidateQueries({ queryKey: ["location-requirements", locationId] });
      qc.invalidateQueries({ queryKey: ["location-staffing-summary"] });
      for(const key of ["location-task-orders","location-task-orders-asof","location-authorization","customer-project-counts","deployment-alerts"])qc.invalidateQueries({queryKey:[key]});
    }
    setOpen(false);
    onEditClosed?.();
  };

  const geocode = async () => {
    setGeocoding(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode-location', { body: { address: [form.address, form.city, form.state, form.zip].filter(Boolean).join(', ') } });
      if (error) throw new Error(error instanceof FunctionsHttpError ? await error.context.text() : error.message);
      setForm(prev => ({ ...prev, lat: String(data.lat), lng: String(data.lng), timezone: data.timezone }));
      toast.success('Coordinates and timezone found');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Geocoding failed'); }
    finally { setGeocoding(false); }
  };
  const f = (k: keyof FormState) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }),
  });
  const saving = add.isPending || update.isPending || savingReqs;
  const setRow = (key: string, patch: Partial<ReqRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const roleOptions = [...ROLE_TAGS] as string[];

  return (
    <div className="space-y-3 min-[1180px]:space-y-2">
      {!editTargetId && <><div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Sites / Locations</h3>
        <div className="flex items-center gap-2">
          {locations.length > 0 && (
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="View">
              <Button size="sm" variant={effectiveView === "list" ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => chooseView("list")}><List className="h-3.5 w-3.5 mr-1" />List</Button>
              <Button size="sm" variant={effectiveView === "cards" ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => chooseView("cards")}><LayoutGrid className="h-3.5 w-3.5 mr-1" />Cards</Button>
              
            </div>
          )}
          {canWrite && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add location</Button>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : locations.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No locations yet.</CardContent></Card>
      ) : effectiveView === "list" ? (
        <LocationsCommandCenter projectId={projectId} locations={locations} staffing={staffing} canWrite={canWrite} />
      ) : effectiveView === "grid" ? (
        <LocationsGrid projectId={projectId} projectName={projectName} locations={locations} staffing={staffing} lastServiced={lastServiced}
          deploymentMode={deploymentMode} canWrite={canWrite} onOpenCard={(id) => navigate(locationHref(projectId,id))} onEditLocation={openEdit} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {locations.map((l) => (
            <EntityContextMenu key={l.id} href={locationHref(projectId,l.id)} actions={canWrite ? [
              {label:'Edit location',run:()=>openEdit(l)},
              {label:'Assign people',run:()=>navigate(`${locationHref(projectId,l.id)}?tab=staffing&action=assign`)},
              {label:'Send site text',run:()=>navigate(`${locationHref(projectId,l.id)}?tab=staffing&action=text`)},
              {label:'Kiosk link',run:()=>navigate(`${locationHref(projectId,l.id)}?action=kiosk`)},
              {label:'Daily timesheet PDF',run:()=>navigate(`${locationHref(projectId,l.id)}?tab=sheets&action=daily`)},
              {label:'Task orders',run:()=>navigate(locationHref(projectId,l.id,'taskorders'))},
            ] : [{label:'Daily timesheet PDF',run:()=>navigate(`${locationHref(projectId,l.id)}?tab=sheets&action=daily`)}]}>
            <Card id={`location-card-${l.id}`} className="scroll-mt-20 transition-shadow hover:shadow-md hover:border-primary/30 min-w-0">
              <CardContent className="p-3 sm:p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={locationHref(projectId,l.id)} className="font-semibold truncate hover:text-primary hover:underline underline-offset-2">{l.name}</Link>
                      {l.lat != null && l.lng != null ? <Badge variant="outline">📍 geofenced</Badge> : <Badge variant="outline" className="text-muted-foreground">No geofence set</Badge>}
                      {l.project_number && <Badge variant="outline">#{l.project_number}</Badge>}
                      <Badge variant={l.status === "active" ? "default" : "secondary"} className="capitalize">{l.status}</Badge>
                      {l.housing_provided_by === "customer" && <Badge variant="outline">Housing: Customer</Badge>}
                      {l.housing_provided_by === "frg" && <Badge variant="outline">Housing: FRG</Badge>}
                      {l.meals_provided && <Badge variant="outline" title={l.meals_notes ?? undefined}>Meals provided</Badge>}
                    </div>
                    {(l.city || l.state || l.address) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {[l.address, [l.city, l.state].filter(Boolean).join(", "), l.zip].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0">
                      <LocationTaskOrders projectId={projectId} locationId={l.id} locationName={l.name} timezone={l.timezone} iconOnly />
                      <ProjectJoinLinks projectId={projectId} locationId={l.id} iconOnly />
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(l)} aria-label="Edit location"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setToDelete(l)} aria-label="Delete location"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </div>
                {(l.poc_name || l.poc_phone || l.poc_email) && (
                  <div className="text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                    {l.poc_name && <span className="font-medium">{l.poc_name}</span>}
                    {l.poc_phone && <a href={`tel:${l.poc_phone}`} className="text-primary flex items-center gap-1"><Phone className="h-3 w-3" />{l.poc_phone}</a>}
                    {l.poc_email && <a href={`mailto:${l.poc_email}`} className="text-primary flex items-center gap-1"><Mail className="h-3 w-3" />{l.poc_email}</a>}
                  </div>
                )}
                {deploymentMode && (l.mobe_date || l.demobe_date || lastServiced?.[l.id]) && (
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                    {(l.mobe_date || l.demobe_date) && (
                      <span>Mobe {l.mobe_date ? formatLocalDate(l.mobe_date, "M/d") : "—"} → Demobe {l.demobe_date ? formatLocalDate(l.demobe_date, "M/d") : "—"}</span>
                    )}
                    {lastServiced?.[l.id] && <span>Last serviced {formatLocalDate(lastServiced[l.id], "M/d")}</span>}
                  </div>
                )}
                {l.scope && <ScopeText text={l.scope} />}
                <DailyTimesheetPanel projectId={projectId} projectName={project?.name || projectName || 'Project'} locationId={l.id} />
                <LocationDocumentsLine projectId={projectId} locationId={l.id} documents={documents} signatures={signatures} />
                {canWrite && <LocationKioskActions location={l} />}
                <AuthorizationBadge value={authorization.data?.[l.id]} />
                <LocationStaffing locationId={l.id} summary={staffing?.[l.id]} canWrite={canWrite} projectId={l.project_id} locationName={l.name} timezone={l.timezone} />
                <LocationAssets projectId={l.project_id} locationId={l.id} locationName={l.name} canWrite={canWrite} locationNames={locationNames} />
                <LocationLodging projectId={projectId} locationId={l.id} housingBy={l.housing_provided_by} canWrite={canWrite} />
              </CardContent>
            </Card></EntityContextMenu>
          ))}
        </div>
      )}

      </>}
      <Dialog open={open} onOpenChange={v=>{setOpen(v);if(!v)onEditClosed?.();}}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit location" : "Add location"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input {...f("name")} /></div>
            <div className="col-span-2"><Label>Customer</Label><Select value={form.customer_id||'none'} onValueChange={v=>setForm({...form,customer_id:v==='none'?'':v})}><SelectTrigger aria-label="Location customer"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">No customer</SelectItem>{customers.data?.map(c=><SelectItem key={c.id} value={c.id}>{getCustomerDisplayName(c)}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Project #</Label><Input {...f("project_number")} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Address</Label><Input {...f("address")} /></div>
            <div><Label>City</Label><Input {...f("city")} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>State</Label><Input {...f("state")} maxLength={2} /></div>
              <div><Label>ZIP</Label><Input {...f("zip")} /></div>
            </div>
            <div className="col-span-2"><Button type="button" variant="outline" disabled={geocoding || !form.address.trim()} onClick={geocode}>{geocoding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MapPin className="h-4 w-4 mr-1" />}Geocode from address</Button></div>
            <div><Label htmlFor="loc-lat">Latitude</Label><Input id="loc-lat" type="number" min={-90} max={90} step="any" {...f('lat')} /></div>
            <div><Label htmlFor="loc-lng">Longitude</Label><Input id="loc-lng" type="number" min={-180} max={180} step="any" {...f('lng')} /></div>
            <div><Label htmlFor="loc-radius">Geofence radius (m)</Label><Input id="loc-radius" type="number" min={1} {...f('geofence_radius_m')} /></div>
            <div><Label>Timezone</Label><Input value={form.timezone} readOnly /></div>
            <div><Label>POC name</Label><Input {...f("poc_name")} /></div>
            <div><Label>POC phone</Label><Input type="tel" {...f("poc_phone")} /></div>
            <div><Label htmlFor="location-poc-email">POC email</Label><Input id="location-poc-email" type="email" {...f("poc_email")} /></div>
            {deploymentMode && <div><Label>Mobe date</Label><Input type="date" {...f("mobe_date")} /></div>}
            {deploymentMode && <div><Label>Demobe date</Label><Input type="date" {...f("demobe_date")} /></div>}
            <div><Label>Sort order</Label><Input type="number" {...f("sort_order")} /></div>
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <h3 className="col-span-2 text-sm font-semibold">Shifts</h3>
              <div><Label htmlFor="location-day-shift">Day shift starts</Label><Time24Input id="location-day-shift"  {...f("day_shift_start")} placeholder={project?.day_shift_start?.slice(0, 5) ?? "06:00"} /><p className="text-xs text-muted-foreground mt-1">Inherit: {project?.day_shift_start?.slice(0, 5) ?? "06:00"}</p></div>
              <div><Label htmlFor="location-day-end">Day shift ends</Label><Time24Input id="location-day-end"  {...f('day_shift_end')} placeholder={(project?.day_shift_end || form.night_shift_start || project?.night_shift_start || '18:00').slice(0,5)}/><p className="text-xs text-muted-foreground mt-1">Default: {(project?.day_shift_end || form.night_shift_start || project?.night_shift_start || '18:00').slice(0,5)}</p></div>
              <div><Label htmlFor="location-night-shift">Night shift starts</Label><Time24Input id="location-night-shift"  {...f("night_shift_start")} placeholder={project?.night_shift_start?.slice(0, 5) ?? "18:00"} /><p className="text-xs text-muted-foreground mt-1">Inherit: {project?.night_shift_start?.slice(0, 5) ?? "18:00"}</p></div>
              <div><Label htmlFor="location-night-end">Night shift ends</Label><Time24Input id="location-night-end"  {...f('night_shift_end')} placeholder={(project?.night_shift_end || form.day_shift_start || project?.day_shift_start || '06:00').slice(0,5)}/><p className="text-xs text-muted-foreground mt-1">Default: {(project?.night_shift_end || form.day_shift_start || project?.day_shift_start || '06:00').slice(0,5)} next day</p></div>
            </div>
            <div className="col-span-2"><Label>Scope</Label><Textarea rows={4} {...f("scope")} /></div>
            <div className="col-span-2 space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label>Positions needed</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRows((rs) => [...rs, newRow()])}><Plus className="h-4 w-4 mr-1" />Add position</Button>
              </div>
              {editing && !seeded ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 && <p className="text-xs text-muted-foreground">No positions.</p>}
              {rows.map((r) => (
                <div key={r.key} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <div className="flex-1 min-w-[10rem] flex"><RolePicker value={r.role_label} onChange={(v) => setRow(r.key, { role_label: v })} options={roleOptions} /></div>
                  <Input type="number" min={0} aria-label="Headcount" value={r.headcount} onChange={(e) => setRow(r.key, { headcount: e.target.value })} className="h-9 w-16" />
                  <Input type="number" min={0} step="0.01" placeholder="Bill $/hr" aria-label="Customer bill rate" value={r.rate} onChange={(e) => setRow(r.key, { rate: e.target.value })} className="h-9 w-24" />
                  <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Remove position" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-3 border-t pt-3">
              <div><Label>Housing</Label>
                <Select value={form.housing_provided_by} onValueChange={(v) => setForm({ ...form, housing_provided_by: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not provided</SelectItem>
                    <SelectItem value="customer">Provided by customer</SelectItem>
                    <SelectItem value="frg">Provided by FRG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch id="meals" checked={form.meals_provided} onCheckedChange={(v) => setForm({ ...form, meals_provided: v })} />
                <Label htmlFor="meals">Meals provided</Label>
              </div>
              {form.meals_provided && <div className="col-span-2"><Label>Meals notes</Label><Input {...f("meals_notes")} placeholder="e.g. Lunch on site" /></div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {setOpen(false);onEditClosed?.();}}>Cancel</Button>
            <Button onClick={save} disabled={!form.name.trim() || saving || geocoding}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete location?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.name}" will be removed from this project.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (toDelete) del.mutate({ id: toDelete.id, project_id: projectId }); setToDelete(null); }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
