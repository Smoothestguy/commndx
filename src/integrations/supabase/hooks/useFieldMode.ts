import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { insertStatusRows } from "./usePersonnelStatus";
import { addDays as addCalendarDays, chicagoMidnight, splitAtMidnight } from "@/lib/shifts";
import { localDay, midnight, nextDay, rowsForDay, type SheetStay } from '@/lib/signinSheets';
import { staleVisitEnd } from '@/lib/deploymentFlow';
import { signatureImageUrl } from '@/utils/signedDocumentExport';
import { ensureSheetsOpen, guardVisitDates, guardStayWeeks } from '@/lib/sheetLocks';

const db = supabase as any;
const BUCKET = "field-captures";

export const todayYmd = () => format(new Date(), "yyyy-MM-dd");
const dayStart = (ymd: string) => new Date(ymd + "T00:00:00").toISOString();
const dayEnd = (ymd: string) => new Date(ymd + "T23:59:59.999").toISOString();

export interface VisitRow {
  id: string;
  location_id: string;
  crew_id: string | null;
  check_in_at: string;
  check_out_at: string | null;
  needs_review?: boolean;
  auto_closed?: boolean;
  notes: string | null;
  created_by: string | null;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
  check_out_lat?: number | null;
  check_out_lng?: number | null;
}

export interface VisitPerson {
  synced_late?: boolean;
  early_in_reason?: string | null;
  offsite_approved_by?: string | null;
  offsite_approved_at?: string | null;
  id: string;
  visit_id: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  personnel_id: string;
  signature_url: string | null;
  signed_at: string | null;
  personnel: { first_name: string | null; last_name: string | null } | null;
}

export interface VisitPurchase {
  id: string;
  visit_id: string;
  amount: number | null;
  vendor: string | null;
  note: string | null;
  receipt_url: string | null;
  created_at: string;
}

export interface VisitPhoto {
  id: string;
  visit_id: string;
  photo_url: string;
  caption: string | null;
  taken_at: string;
}

/** GPS that never blocks: 3s timeout, resolves nulls on deny/error. */
export function getCoords(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    const done = (lat: number | null, lng: number | null) => resolve({ lat, lng });
    if (!navigator.geolocation) return done(null, null);
    const t = setTimeout(() => done(null, null), 3000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); done(p.coords.latitude, p.coords.longitude); },
      () => { clearTimeout(t); done(null, null); },
      { timeout: 3000, maximumAge: 60_000 },
    );
  });
}

async function fetchDirectoryNames(personnelIds: string[]) {
  const ids = [...new Set(personnelIds)];
  if (!ids.length) return {} as Record<string, { first_name: string | null; last_name: string | null }>;
  const { data, error } = await db.from("personnel_directory").select("id, first_name, last_name").in("id", ids);
  if (error) throw error;
  const map: Record<string, { first_name: string | null; last_name: string | null }> = {};
  for (const r of data ?? []) map[r.id] = { first_name: r.first_name, last_name: r.last_name };
  return map;
}

/** Upload a file/blob to the public field-captures bucket, return its public URL. */
export async function uploadCapture(path: string, file: File | Blob): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

interface VisitBundle {
  visits: VisitRow[];
  people: VisitPerson[];
  purchases: VisitPurchase[];
  photos: VisitPhoto[];
}

async function fetchVisitBundle(locationIds: string[], fromIso: string, toIso: string): Promise<VisitBundle> {
  if (!locationIds.length) return { visits: [], people: [], purchases: [], photos: [] };
  const { data: visits, error } = await db.from("location_visits")
    .select("id, location_id, crew_id, check_in_at, check_out_at, needs_review, auto_closed, notes, created_by, check_in_lat, check_in_lng, check_out_lat, check_out_lng")
    .in("location_id", locationIds)
    .gte("check_in_at", fromIso).lte("check_in_at", toIso)
    .order("check_in_at", { ascending: false });
  if (error) throw error;
  const vids = (visits ?? []).map((v: any) => v.id);
  if (!vids.length) return { visits: visits ?? [], people: [], purchases: [], photos: [] };

  const [ppl, pur, pho] = await Promise.all([
    db.from("visit_personnel").select("id, visit_id, personnel_id, signature_url, signed_at, checked_in_at, checked_out_at, synced_late, early_in_reason, offsite_approved_by, offsite_approved_at").in("visit_id", vids),
    db.from("visit_purchases").select("id, visit_id, amount, vendor, note, receipt_url, created_at").in("visit_id", vids),
    db.from("visit_photos").select("id, visit_id, photo_url, caption, taken_at").in("visit_id", vids),
  ]);
  if (ppl.error) throw ppl.error;
  if (pur.error) throw pur.error;
  if (pho.error) throw pho.error;

  const names = await fetchDirectoryNames((ppl.data ?? []).map((p: any) => p.personnel_id));
  const urls = new Map<string, string>();
  await Promise.all([...new Set<string>((ppl.data ?? []).map((p: any) => p.signature_url).filter(Boolean))].map(async path => { urls.set(path, path.startsWith('http') ? path : await signatureImageUrl(path)); }));
  const people = (ppl.data ?? []).map((p: any) => ({ ...p, signature_url: p.signature_url ? urls.get(p.signature_url) : null, personnel: names[p.personnel_id] ?? null })) as VisitPerson[];
  return { visits: visits ?? [], people, purchases: pur.data ?? [], photos: pho.data ?? [] };
}

/** Today's visits across all of a project's locations — one batched load for the field page. */
export function useTodayVisits(projectId: string | undefined, locationIds: string[]) {
  const ids = [...locationIds].sort();
  const day = todayYmd();
  return useQuery({
    queryKey: ["today-visits", projectId, ids, day],
    enabled: !!projectId && ids.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: locations, error } = await db.from('project_locations').select('id,timezone').in('id',ids); if (error) throw error;
      const zones = new Map<string,string>((locations ?? []).map((l: any) => [l.id,l.timezone || 'America/Chicago']));
      const now = new Date().toISOString();
      const bundle = await fetchVisitBundle(ids,new Date(Date.now()-2*86400000).toISOString(),new Date(Date.now()+86400000).toISOString());
      const visits = bundle.visits.filter(v => { const zone=zones.get(v.location_id)||'America/Chicago';return localDay(v.check_in_at,zone)===localDay(now,zone); });
      const visitIds=new Set(visits.map(v=>v.id));
      return {visits,people:bundle.people.filter(p=>visitIds.has(p.visit_id)),purchases:bundle.purchases.filter(p=>visitIds.has(p.visit_id)),photos:bundle.photos.filter(p=>visitIds.has(p.visit_id))};
    },
  });
}

/** Admin window view of visits (any date range). */
export function useVisitsWindow(locationIds: string[], from: string, to: string) {
  const ids = [...locationIds].sort();
  return useQuery({
    queryKey: ["visits-window", ids, from, to],
    enabled: ids.length > 0,
    queryFn: () => fetchVisitBundle(ids, dayStart(from), dayEnd(to)),
  });
}

/** Today's receipts total across locations (for the admin summary strip). */
export function useTodayReceiptsTotal(locationIds: string[]) {
  const ids = [...locationIds].sort();
  const day = todayYmd();
  return useQuery({
    queryKey: ["today-receipts", ids, day],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data: visits, error } = await db.from("location_visits")
        .select("id").in("location_id", ids).gte("check_in_at", dayStart(day)).lte("check_in_at", dayEnd(day));
      if (error) throw error;
      const vids = (visits ?? []).map((v: any) => v.id);
      if (!vids.length) return 0;
      const { data, error: pErr } = await db.from("visit_purchases").select("amount").in("visit_id", vids);
      if (pErr) throw pErr;
      return (data ?? []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
    },
  });
}

function useInv(projectId: string | undefined) {
  const qc = useQueryClient();
  return (locationId?: string) => {
    qc.invalidateQueries({ queryKey: ["today-visits", projectId] });
    for (const key of ['time-entries','all-time-entries','deployment-hours','project-time-entries','on-site-now','personnel-assignment-counts']) qc.invalidateQueries({ queryKey: [key] });
    qc.invalidateQueries({ queryKey: ["visits-window"] });
    qc.invalidateQueries({ queryKey: ["personnel-current-status"] });
    qc.invalidateQueries({ queryKey: ["project-roster"] });
    qc.invalidateQueries({ queryKey: ["today-receipts"] });
    qc.invalidateQueries({ queryKey: ["on-site-now", projectId] });
    qc.invalidateQueries({ queryKey: ["personnel-trail", projectId] });
    qc.invalidateQueries({ queryKey: ["week-timesheet", projectId] });
    qc.invalidateQueries({ queryKey: ["location-attendance-batch"] });
    if (locationId) {
      qc.invalidateQueries({ queryKey: ["location-attendance", locationId] });
      qc.invalidateQueries({ queryKey: ["location-attendance-batch"] });
    }
  };
}

/** Latest signature each person has recorded TODAY (any visit, this project). */
export async function fetchTodaySignatures(locationIds: string[], personnelIds: string[], locationId?: string) {
  if (!personnelIds.length) return {} as Record<string, { signature_url: string; signed_at: string }>;
  const { data: location } = await db.from('project_locations').select('timezone').eq('id',locationId || locationIds[0]).single();
  const zone = location?.timezone || 'America/Chicago', day=localDay(new Date().toISOString(),zone);
  const { data, error: pErr } = await db.from("visit_personnel")
    .select("personnel_id, signature_url, signed_at")
    .in("personnel_id", personnelIds).gte('signed_at',new Date(midnight(day,zone)).toISOString()).lt('signed_at',new Date(midnight(nextDay(day),zone)).toISOString())
    .not("signature_url", "is", null)
    .order("signed_at", { ascending: false });
  if (pErr) throw pErr;
  const map: Record<string, { signature_url: string; signed_at: string }> = {};
  for (const r of data ?? []) if (!map[r.personnel_id]) map[r.personnel_id] = { signature_url: r.signature_url, signed_at: r.signed_at };
  return map;
}

/** Silent auto-activation: anyone checked in who isn't already ACTIVATED on this project gets an appended status row. */
async function autoActivate(projectId: string | undefined, locationId: string, personnelIds: string[]) {
  if (!projectId || !personnelIds.length) return;
  try {
    const [{ data: cur }, { data: loc }] = await Promise.all([
      db.from("personnel_current_status").select("personnel_id, status, project_id").in("personnel_id", personnelIds),
      db.from("project_locations").select("name").eq("id", locationId).maybeSingle(),
    ]);
    const already = new Set((cur ?? []).filter((r: any) => r.status === "activated" && r.project_id === projectId).map((r: any) => r.personnel_id));
    const ids = personnelIds.filter((id) => !already.has(id));
    if (ids.length) {
      await insertStatusRows(ids.map((pid) => ({ personnel_id: pid, status: "activated" as const, project_id: projectId, note: `Auto: checked in at ${loc?.name ?? "site"}` })));
    }
  } catch (e) {
    console.warn("Auto-activate failed", e); // never block check-in
  }
}

export async function uploadFieldSignature(personnelId: string, blob: Blob) {
  const path = `field-signatures/${personnelId}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from('project-documents').upload(path, blob, { contentType: 'image/png', upsert: false });
  if (error) throw error; return { signature_url: path, signed_at: new Date().toISOString() };
}
export function useCheckIn(projectId: string | undefined, locationIds: string[]) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ location_id, crew_id, memberIds, lat, lng, signatures = {}, earlyReason, lateReason, overrideReason }: {
      location_id: string; crew_id: string | null; memberIds: string[]; lat: number | null; lng: number | null; signatures?: Record<string, Blob>; earlyReason?: string; lateReason?: string; overrideReason?: string;
    }) => {
      if (!navigator.onLine) throw new Error("No signal — try again in coverage");
      const { data: { user } } = await supabase.auth.getUser();
      // Copy-forward: members who already signed today keep their signature — never ask twice.
      const signed = await fetchTodaySignatures(locationIds, memberIds,location_id);
      for (const pid of memberIds) { if (!signed[pid]) { if (!signatures[pid]) throw new Error('Signature required before check-in'); signed[pid]=await uploadFieldSignature(pid,signatures[pid]); } }
      let visitId = '';
      for (const pid of memberIds) {
        const {data,error}=await supabase.functions.invoke('shift-discipline',{body:{action:'field',location_id,personnel_id:pid,crew_id,lat,lng,...signed[pid],early_reason:earlyReason,late_reason:lateReason,override_reason:overrideReason}});
        if(error)throw new Error('Check-in unavailable');
        if(!data?.ok){const failure=new Error(data?.reason||'Check-in unavailable') as Error & {rejection?:any};failure.rejection=data;throw failure;}
        visitId=data.visit_id;
      }
      await autoActivate(projectId, location_id, memberIds);
      return { visitId, needsSignature: [] as string[] };
    },
    onSuccess: (_r, v) => inv(v.location_id),
    onError: (e: any) => { if (!e.rejection) toast.error(e?.message ?? "Check-in failed"); },
  });
}

/** Save a drawn signature PNG and attach it to one visit_personnel row. */
export function useSaveSignature(projectId: string | undefined) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ visit_id, personnel_id, blob }: { visit_id: string; personnel_id: string; blob: Blob }) => {
      const signature = await uploadFieldSignature(personnel_id, blob);
      const { error } = await db.from("visit_personnel")
        .update(signature)
        .eq("visit_id", visit_id).eq("personnel_id", personnel_id);
      if (error) throw error;
    },
    onSuccess: () => inv(),
    onError: (e: any) => toast.error(e?.message ?? "Failed to save signature"),
  });
}

/**
 * Recompute all touched Chicago dates, including stays that began on an earlier date.
 * Round only after summing each person's segments for the date.
 */
async function visitAttendanceDates(visitId: string): Promise<string[]> {
  const { data, error } = await db.from("personnel_location_trail").select("in_at, out_at,location_id").eq("visit_id", visitId);
  if (error) throw error;
  const {data:location}=await db.from('project_locations').select('timezone').eq('id',data?.[0]?.location_id).maybeSingle();const zone=location?.timezone||'America/Chicago';
  return [...new Set<string>((data??[]).flatMap((r:{in_at:string;out_at:string|null})=>{const dates:string[]=[];let d=localDay(r.in_at,zone);const end=localDay(r.out_at||new Date().toISOString(),zone);while(d<=end){dates.push(d);d=nextDay(d);}return dates;}))];
}

export async function recomputeAttendanceFromVisits(locationId: string, touchedDates: string[]) {
  const dates = [...new Set(touchedDates)].sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return;
  const {data:location}=await db.from('project_locations').select('timezone').eq('id',locationId).single();const zone=location?.timezone||'America/Chicago';
  const start = new Date(midnight(first,zone)).toISOString();
  const end = new Date(midnight(nextDay(last),zone)).toISOString();
  const { data, error } = await db.from("personnel_location_trail")
    .select("personnel_id, crew_id, in_at, out_at, hours")
    .eq("location_id", locationId).lt("in_at", end).or(`out_at.is.null,out_at.gte.${start}`);
  if (error) throw error;
  const totals = new Map<string, { personnel_id: string; att_date: string; hours: number; crew_id: string | null }>();
  // Existing worked totals must become zero if an edit/delete removed their last segment.
  const { data: prior, error: priorError } = await db.from("location_attendance")
    .select("personnel_id, att_date, crew_id").eq("location_id", locationId).in("att_date", dates).eq("status", "worked");
  if (priorError) throw priorError;
  for (const r of prior ?? []) totals.set(`${r.personnel_id}:${r.att_date}`, { ...r, hours: 0 });
  const included = new Set(dates);
  const now = new Date().toISOString();
  for (const r of (data ?? []) as TrailRow[]) {
    for (const date of included) {
      const row:SheetStay={id:r.visit_personnel_id||'',personnelId:r.personnel_id,locationId,name:'',position:'',inAt:r.in_at,outAt:r.out_at||now,signature:null,offsite:false};
      const s=rowsForDay([row],locationId,date,zone)[0];if(!s)continue;
      const key = `${r.personnel_id}:${date}`;
      const total = totals.get(key) ?? { personnel_id: r.personnel_id, att_date: date, hours: 0, crew_id: r.crew_id ?? null };
      total.hours += s.hours??0;
      total.crew_id = r.crew_id ?? null;
      totals.set(key, total);
    }
  }
  if (!totals.size) return;
  const { data: { user } } = await supabase.auth.getUser();
  const rows = [...totals.values()].map((r) => ({
    ...r,
    location_id: locationId,
    status: "worked",
    hours: Math.round(r.hours * 10) / 10,
    marked_by: user?.id ?? null,
  }));
  const { error: uErr } = await db.from("location_attendance").upsert(rows, { onConflict: "location_id,personnel_id,att_date" });
  if (uErr) throw uErr;
}

export function useCheckOut(projectId: string | undefined) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ visit, lat, lng, endedAt }: {
      visit: VisitRow; lat: number | null; lng: number | null; endedAt?: string;
    }) => {
      if (!navigator.onLine) throw new Error("No signal — try again in coverage");
      await guardVisitDates(visit.location_id, visit.check_in_at, endedAt ?? new Date().toISOString());
      const { error } = await db.from("location_visits")
        .update({ check_out_at: endedAt ?? new Date().toISOString(), check_out_lat: lat, check_out_lng: lng })
        .eq("id", visit.id);
      if (error) throw error;
      // Attendance grid fills itself from real times.
      // Live triggers own location-local attendance and canonical time entries.
      await recomputeAttendanceFromVisits(visit.location_id,await visitAttendanceDates(visit.id));
      return visit.location_id;
    },
    onSuccess: (locationId) => { inv(locationId); toast.success("Checked out"); },
    onError: (e: any) => toast.error(e?.message ?? "Check-out failed"),
  });
}

export function useAddPurchase(projectId: string | undefined) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ visit_id, file, amount, vendor, note }: {
      visit_id: string; file: File; amount: number | null; vendor: string | null; note?: string | null;
    }) => {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const url = await uploadCapture(`receipts/${visit_id}/${Date.now()}.${ext}`, file);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db.from("visit_purchases")
        .insert({ visit_id, amount, vendor: vendor || null, note: note || null, receipt_url: url, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Receipt saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save receipt"),
  });
}

export function useAddVisitPhoto(projectId: string | undefined) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ visit_id, file, caption, lat, lng }: {
      visit_id: string; file: File; caption: string | null; lat: number | null; lng: number | null;
    }) => {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const url = await uploadCapture(`photos/${visit_id}/${Date.now()}.${ext}`, file);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db.from("visit_photos")
        .insert({ visit_id, photo_url: url, caption: caption || null, lat, lng, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { inv(); toast.success("Photo saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save photo"),
  });
}

/** Manager edit of visit times. */
export function useUpdateVisit(projectId: string | undefined) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ id, check_in_at, check_out_at, location_id }: {
      id: string; check_in_at: string; check_out_at: string | null; location_id: string;
    }) => {
      const oldDates=await visitAttendanceDates(id);
      await guardVisitDates(location_id, check_in_at, check_out_at, oldDates);
      const { error } = await db.from("location_visits").update({ check_in_at, check_out_at, needs_review:false }).eq("id", id);
      if (error) throw error;
      await recomputeAttendanceFromVisits(location_id,[...oldDates,...await visitAttendanceDates(id)]);
      return location_id;
    },
    onSuccess: (lid) => { inv(lid); toast.success("Visit updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update visit"),
  });
}

export function useDeleteVisit(projectId: string | undefined) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ id, location_id }: { id: string; location_id: string }) => {
      const oldDates = await visitAttendanceDates(id);
      await ensureSheetsOpen([{ locationId: location_id, dates: oldDates }]);
      const { error } = await db.from("location_visits").delete().eq("id", id);
      if (error) throw error;
      await recomputeAttendanceFromVisits(location_id, oldDates);
      return location_id;
    },
    onSuccess: (lid) => { inv(lid); toast.success("Visit deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete visit"),
  });
}

// ---------- Per-person tracking (personnel_location_trail) ----------

export interface TrailRow {
  visit_personnel_id: string;
  personnel_id: string;
  first_name: string | null;
  last_name: string | null;
  visit_id: string;
  location_id: string;
  location_name: string | null;
  project_id: string;
  crew_id: string | null;
  in_at: string;
  out_at: string | null;
  hours: number | null;
  signature_url: string | null;
  checked_in_by: string | null;
}

const TRAIL_COLS = "visit_personnel_id, personnel_id, first_name, last_name, visit_id, location_id, location_name, project_id, crew_id, in_at, out_at, hours, signature_url, checked_in_by";

/** Who is on site right now across the project (out_at IS NULL). */
export function useOnSiteNow(projectId: string | undefined) {
  return useQuery({
    queryKey: ["on-site-now", projectId],
    enabled: !!projectId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("personnel_location_trail").select(TRAIL_COLS)
        .eq("project_id", projectId).is("out_at", null).order("in_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TrailRow[];
    },
  });
}

/** Movement trail for a project in a date window, newest first. */
export function useTrail(projectId: string | undefined, f: { personnelId?: string | null; locationId?: string | null; from: string; to: string }) {
  return useQuery({
    queryKey: ["personnel-trail", projectId, f.personnelId ?? null, f.locationId ?? null, f.from, f.to],
    enabled: !!projectId,
    queryFn: async () => {
      let q = db.from("personnel_location_trail").select(TRAIL_COLS)
        .eq("project_id", projectId).lt("in_at", chicagoMidnight(addCalendarDays(f.to, 1)))
        .or(`out_at.is.null,out_at.gte.${chicagoMidnight(f.from)}`);
      if (f.personnelId) q = q.eq("personnel_id", f.personnelId);
      if (f.locationId) q = q.eq("location_id", f.locationId);
      const { data, error } = await q.order("in_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as TrailRow[];
    },
  });
}

/** Batched visit notes for a set of visit ids (used to flag manual / self entries in the trail). */
export function useVisitNotes(visitIds: string[]) {
  const ids = [...new Set(visitIds)].sort();
  return useQuery({
    queryKey: ["visit-notes", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const map: Record<string, string | null> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await db.from("location_visits").select("id, notes").in("id", ids.slice(i, i + 200));
        if (error) throw error;
        for (const r of data ?? []) map[r.id] = r.notes;
      }
      return map;
    },
  });
}

/** Manager manual time entry: one visit + one visit_personnel row, then recompute attendance. */
export function useLogManualTime(projectId: string | undefined) {
  const inv = useInv(projectId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { personnel_id: string; location_id: string; day: string; in_at: string; out_at: string; note?: string }) => {
      if (!projectId || Date.parse(i.out_at) <= Date.parse(i.in_at)) throw new Error('Valid project and time out after time in required');
      const {data: location,error:locationError}=await supabase.from('project_locations').select('project_id,timezone').eq('id',i.location_id).single();
      if(locationError)throw locationError;
      if(location.project_id!==projectId)throw new Error('Location does not belong to this project');
      // Managers may add extra stays the same day; only overlapping stays (double-counted hours) are refused.
      const {data:overlap,error:overlapError}=await supabase.from('personnel_location_trail').select('visit_personnel_id,in_at,out_at').eq('personnel_id',i.personnel_id).lt('in_at',i.out_at).gt('in_at',new Date(Date.parse(i.in_at)-2*864e5).toISOString()).limit(50);
      if(overlapError)throw overlapError;
      if((overlap??[]).some(r=>r.out_at?Date.parse(r.out_at)>Date.parse(i.in_at):Date.parse(r.in_at!)>Date.parse(i.in_at)-16*3600e3))throw new Error('This overlaps another stay for this person. Pick times that do not overlap, or edit the existing stay.');
      await guardStayWeeks(projectId,[{id:crypto.randomUUID(),oldIn:i.in_at,oldOut:i.out_at,inAt:i.in_at,outAt:i.out_at,zone:location.timezone||'America/Chicago'}]);
      await guardVisitDates(i.location_id, i.in_at, i.out_at);
      const { data: { user } } = await supabase.auth.getUser();
      const notes = i.note?.trim() ? `Manual entry — ${i.note.trim()}` : "Manual entry";
      const { data: v, error } = await db.from("location_visits").insert({
        location_id: i.location_id, check_in_at: i.in_at, check_out_at: i.out_at, notes, created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      const { error: pErr } = await db.from("visit_personnel").insert({
        visit_id: v.id, personnel_id: i.personnel_id, checked_in_at: i.in_at, checked_out_at: i.out_at, checked_in_by: user?.id ?? null,
      });
      if (pErr) {
        // A failed personnel insert leaves no stay/evidence: remove only its empty shell.
        await db.from('location_visits').delete().eq('id',v.id);
        throw new Error(pErr.message || 'Unable to save manual stay');
      }
      await recomputeAttendanceFromVisits(i.location_id, await visitAttendanceDates(v.id));
    },
    onSuccess: () => {
      inv();
      qc.invalidateQueries({ queryKey: ["location-attendance"] });
      qc.invalidateQueries({ queryKey: ["personnel-trail"] });
      qc.invalidateQueries({ queryKey: ["project-roster"] });
      for(const key of ['attendance-roster','week-timesheet','signin-sheet-stays','signin-reconciliation'])qc.invalidateQueries({queryKey:[key]});
      toast.success("Time logged");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to log time"),
  });
}

/** One person leaves early: stamp their own checked_out_at. */
export function useCheckOutPerson(projectId: string | undefined) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ visit, personnel_id }: { visit: VisitRow; personnel_id: string }) => {
      if (!navigator.onLine) throw new Error("No signal — try again in coverage");
      await guardVisitDates(visit.location_id, visit.check_in_at, new Date().toISOString());
      const { error } = await db.from("visit_personnel")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("visit_id", visit.id).eq("personnel_id", personnel_id);
      if (error) throw error;
      // Checkout trigger owns attendance/time-entry writes in location timezone.
      await recomputeAttendanceFromVisits(visit.location_id,await visitAttendanceDates(visit.id));
      return visit.location_id;
    },
    onSuccess: (lid) => { inv(lid); toast.success("Checked out"); },
    onError: (e: any) => toast.error(e?.message ?? "Check-out failed"),
  });
}

/** Add someone mid-visit with their own check-in time; signature copied forward if signed today. */
export function useAddPersonToVisit(projectId: string | undefined, locationIds: string[]) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ visit, personnel_id, blob, earlyReason, lateReason, overrideReason }: { visit: VisitRow; personnel_id: string; blob?: Blob; earlyReason?: string; lateReason?: string; overrideReason?: string }) => {
      if(!navigator.onLine)throw new Error('No signal — try again in coverage');
      const signed = await fetchTodaySignatures(locationIds, [personnel_id],visit.location_id);
      if(!signed[personnel_id]&&!blob)throw new Error('Signature required before check-in');
      let signature=signed[personnel_id];if(!signature){if(!blob)throw new Error('Signature required');signature=await uploadFieldSignature(personnel_id,blob);}
      const {lat,lng}=await getCoords();
      const {data,error}=await supabase.functions.invoke('shift-discipline',{body:{action:'field',location_id:visit.location_id,personnel_id,lat,lng,...signature,early_reason:earlyReason,late_reason:lateReason,override_reason:overrideReason}});
      if(error)throw new Error('Check-in unavailable');if(!data?.ok){const failure=new Error(data?.reason||'Check-in unavailable') as Error & {rejection?:any};failure.rejection=data;throw failure;}
      await autoActivate(projectId, visit.location_id, [personnel_id]);
      return { needsSignature: false, locationId: visit.location_id };
    },
    onSuccess: (r) => inv(r.locationId),
    onError: (e: any) => { if (!e.rejection) toast.error(e?.message ?? "Failed to add person"); },
  });
}

/** Field-captured personnel expense (receipt → field-captures/receipts). Same insert path as staff-side expenses. */
export { useAddPersonnelExpense as useAddFieldExpense } from "./usePersonnelStatus";

/** Hours per person+location for a date range, one query. Key: `${personnel_id}:${location_id}` */
export function useTrailHoursByPersonLocation(projectId: string | undefined, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["personnel-trail", projectId, "hours-by-pl", from, to],
    enabled: !!projectId && enabled,
    queryFn: async () => {
      const { data, error } = await db.from("personnel_location_trail").select("personnel_id, location_id, hours")
        .eq("project_id", projectId).gte("in_at", dayStart(from)).lte("in_at", dayEnd(to)).limit(5000);
      if (error) throw error;
      const m: Record<string, number> = {};
      for (const r of data ?? []) { const k = `${r.personnel_id}:${r.location_id}`; m[k] = (m[k] ?? 0) + (Number(r.hours) || 0); }
      return m;
    },
  });
}
