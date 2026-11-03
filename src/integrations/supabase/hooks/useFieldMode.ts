import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { insertStatusRows } from "./usePersonnelStatus";

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
  notes: string | null;
  created_by: string | null;
}

export interface VisitPerson {
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
    .select("id, location_id, crew_id, check_in_at, check_out_at, notes, created_by")
    .in("location_id", locationIds)
    .gte("check_in_at", fromIso).lte("check_in_at", toIso)
    .order("check_in_at", { ascending: false });
  if (error) throw error;
  const vids = (visits ?? []).map((v: any) => v.id);
  if (!vids.length) return { visits: visits ?? [], people: [], purchases: [], photos: [] };

  const [ppl, pur, pho] = await Promise.all([
    db.from("visit_personnel").select("id, visit_id, personnel_id, signature_url, signed_at, checked_in_at, checked_out_at").in("visit_id", vids),
    db.from("visit_purchases").select("id, visit_id, amount, vendor, note, receipt_url, created_at").in("visit_id", vids),
    db.from("visit_photos").select("id, visit_id, photo_url, caption, taken_at").in("visit_id", vids),
  ]);
  if (ppl.error) throw ppl.error;
  if (pur.error) throw pur.error;
  if (pho.error) throw pho.error;

  const names = await fetchDirectoryNames((ppl.data ?? []).map((p: any) => p.personnel_id));
  const people = (ppl.data ?? []).map((p: any) => ({ ...p, personnel: names[p.personnel_id] ?? null })) as VisitPerson[];
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
    queryFn: () => fetchVisitBundle(ids, dayStart(day), dayEnd(day)),
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
    qc.invalidateQueries({ queryKey: ["visits-window"] });
    qc.invalidateQueries({ queryKey: ["personnel-current-status"] });
    qc.invalidateQueries({ queryKey: ["project-roster"] });
    qc.invalidateQueries({ queryKey: ["today-receipts"] });
    qc.invalidateQueries({ queryKey: ["on-site-now", projectId] });
    qc.invalidateQueries({ queryKey: ["personnel-trail", projectId] });
    if (locationId) {
      qc.invalidateQueries({ queryKey: ["location-attendance", locationId] });
      qc.invalidateQueries({ queryKey: ["location-attendance-batch"] });
    }
  };
}

/** Latest signature each person has recorded TODAY (any visit, this project). */
async function fetchTodaySignatures(locationIds: string[], personnelIds: string[]) {
  if (!locationIds.length || !personnelIds.length) return {} as Record<string, { signature_url: string; signed_at: string }>;
  const day = todayYmd();
  const { data: visits, error } = await db.from("location_visits")
    .select("id").in("location_id", locationIds).gte("check_in_at", dayStart(day)).lte("check_in_at", dayEnd(day));
  if (error) throw error;
  const vids = (visits ?? []).map((v: any) => v.id);
  if (!vids.length) return {};
  const { data, error: pErr } = await db.from("visit_personnel")
    .select("personnel_id, signature_url, signed_at")
    .in("visit_id", vids).in("personnel_id", personnelIds)
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

export function useCheckIn(projectId: string | undefined, locationIds: string[]) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ location_id, crew_id, memberIds, lat, lng }: {
      location_id: string; crew_id: string | null; memberIds: string[]; lat: number | null; lng: number | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: visit, error } = await db.from("location_visits")
        .insert({ location_id, crew_id, check_in_lat: lat, check_in_lng: lng, created_by: user?.id ?? null })
        .select("id").single();
      if (error) throw error;

      // Copy-forward: members who already signed today keep their signature — never ask twice.
      const signed = await fetchTodaySignatures(locationIds, memberIds);
      const now = new Date().toISOString();
      const rows = memberIds.map((pid) => ({
        visit_id: visit.id,
        personnel_id: pid,
        signature_url: signed[pid]?.signature_url ?? null,
        signed_at: signed[pid]?.signed_at ?? (signed[pid] ? now : null),
      }));
      if (rows.length) {
        const { error: pErr } = await db.from("visit_personnel").upsert(rows, { onConflict: "visit_id,personnel_id" });
        if (pErr) throw pErr;
      }
      await autoActivate(projectId, location_id, memberIds);
      return { visitId: visit.id as string, needsSignature: memberIds.filter((pid) => !signed[pid]) };
    },
    onSuccess: (_r, v) => inv(v.location_id),
    onError: (e: any) => toast.error(e?.message ?? "Check-in failed"),
  });
}

/** Save a drawn signature PNG and attach it to one visit_personnel row. */
export function useSaveSignature(projectId: string | undefined) {
  const inv = useInv(projectId);
  return useMutation({
    mutationFn: async ({ visit_id, personnel_id, blob }: { visit_id: string; personnel_id: string; blob: Blob }) => {
      const path = `signatures/${personnel_id}/${todayYmd()}.png`;
      const url = await uploadCapture(path, blob);
      const { error } = await db.from("visit_personnel")
        .update({ signature_url: url, signed_at: new Date().toISOString() })
        .eq("visit_id", visit_id).eq("personnel_id", personnel_id);
      if (error) throw error;
    },
    onSuccess: () => inv(),
    onError: (e: any) => toast.error(e?.message ?? "Failed to save signature"),
  });
}

/**
 * Recompute one day's attendance at a location from personnel_location_trail —
 * each person's real individual in/out times (their own or inherited from the visit), rounded to 0.1h.
 */
async function recomputeAttendanceFromVisits(locationId: string, day: string) {
  const { data, error } = await db.from("personnel_location_trail")
    .select("personnel_id, crew_id, in_at, out_at, hours")
    .eq("location_id", locationId).gte("in_at", dayStart(day)).lte("in_at", dayEnd(day));
  if (error) throw error;
  if (!data?.length) return;
  const hoursByPerson: Record<string, number> = {};
  const crewByPerson: Record<string, string | null> = {};
  for (const r of data as TrailRow[]) {
    const h = r.hours != null ? Number(r.hours)
      : Math.max(0, (Date.now() - new Date(r.in_at).getTime()) / 3_600_000);
    hoursByPerson[r.personnel_id] = (hoursByPerson[r.personnel_id] ?? 0) + h;
    crewByPerson[r.personnel_id] = r.crew_id ?? null;
  }
  const { data: { user } } = await supabase.auth.getUser();
  const rows = Object.entries(hoursByPerson).map(([pid, h]) => ({
    location_id: locationId,
    personnel_id: pid,
    att_date: day,
    status: "worked",
    hours: Math.round(h * 10) / 10,
    crew_id: crewByPerson[pid],
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
      const { error } = await db.from("location_visits")
        .update({ check_out_at: endedAt ?? new Date().toISOString(), check_out_lat: lat, check_out_lng: lng })
        .eq("id", visit.id);
      if (error) throw error;
      // Attendance grid fills itself from real times.
      await recomputeAttendanceFromVisits(visit.location_id, format(new Date(visit.check_in_at), "yyyy-MM-dd"));
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
      const { error } = await db.from("location_visits").update({ check_in_at, check_out_at }).eq("id", id);
      if (error) throw error;
      await recomputeAttendanceFromVisits(location_id, format(new Date(check_in_at), "yyyy-MM-dd"));
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
      const { error } = await db.from("location_visits").delete().eq("id", id);
      if (error) throw error;
      await recomputeAttendanceFromVisits(location_id, todayYmd());
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
        .eq("project_id", projectId).gte("in_at", dayStart(f.from)).lte("in_at", dayEnd(f.to));
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
      const { data: { user } } = await supabase.auth.getUser();
      const notes = i.note?.trim() ? `Manual entry — ${i.note.trim()}` : "Manual entry";
      const { data: v, error } = await db.from("location_visits").insert({
        location_id: i.location_id, check_in_at: i.in_at, check_out_at: i.out_at, notes, created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      const { error: pErr } = await db.from("visit_personnel").insert({
        visit_id: v.id, personnel_id: i.personnel_id, checked_in_at: i.in_at, checked_out_at: i.out_at, checked_in_by: user?.id ?? null,
      });
      if (pErr) throw pErr;
      await recomputeAttendanceFromVisits(i.location_id, i.day);
    },
    onSuccess: () => {
      inv();
      qc.invalidateQueries({ queryKey: ["personnel-trail"] });
      qc.invalidateQueries({ queryKey: ["project-roster"] });
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
      const { error } = await db.from("visit_personnel")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("visit_id", visit.id).eq("personnel_id", personnel_id);
      if (error) throw error;
      await recomputeAttendanceFromVisits(visit.location_id, format(new Date(visit.check_in_at), "yyyy-MM-dd"));
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
    mutationFn: async ({ visit, personnel_id }: { visit: VisitRow; personnel_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const signed = await fetchTodaySignatures(locationIds, [personnel_id]);
      const now = new Date().toISOString();
      const { error } = await db.from("visit_personnel").insert({
        visit_id: visit.id,
        personnel_id,
        checked_in_at: now,
        checked_in_by: user?.id ?? null,
        signature_url: signed[personnel_id]?.signature_url ?? null,
        signed_at: signed[personnel_id]?.signed_at ?? null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Already on this visit");
        throw error;
      }
      await autoActivate(projectId, visit.location_id, [personnel_id]);
      return { needsSignature: !signed[personnel_id], locationId: visit.location_id };
    },
    onSuccess: (r) => inv(r.locationId),
    onError: (e: any) => toast.error(e?.message ?? "Failed to add person"),
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
