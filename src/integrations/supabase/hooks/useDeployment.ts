import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export type AttendanceStatus = "worked" | "standby" | "no_show";
export interface AttendanceRow {
  id: string;
  location_id: string;
  personnel_id: string;
  att_date: string;
  status: AttendanceStatus;
  hours: number | null;
  crew_id: string | null;
  personnel: { first_name: string | null; last_name: string | null } | null;
}

export interface MileageRow {
  id: string;
  crew_id: string;
  log_date: string;
  miles: number;
  notes: string | null;
}

export const markKey = (locationId: string, date: string) => `${locationId}|${date}`;

/** All service marks for a set of locations within [from, to] — one query per grid load. */
export function useServiceLog(locationIds: string[], from: string, to: string) {
  const ids = [...locationIds].sort();
  return useQuery({
    queryKey: ["service-log", ids, from, to],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("location_service_log")
        .select("id, location_id, service_date").in("location_id", ids)
        .gte("service_date", from).lte("service_date", to);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of data ?? []) map[markKey(r.location_id, r.service_date)] = r.id;
      return map;
    },
  });
}

export function useToggleServiceMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ location_id, service_date, existingId }: { location_id: string; service_date: string; existingId?: string }) => {
      if (existingId) {
        const { error } = await db.from("location_service_log").delete().eq("id", existingId);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await db.from("location_service_log").insert({ location_id, service_date, marked_by: user?.id ?? null });
        if (error && error.code !== "23505") throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-log"] });
      qc.invalidateQueries({ queryKey: ["last-serviced"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update service mark"),
  });
}

/** Latest service date per location (batched). */
export function useLastServiced(locationIds: string[], enabled: boolean) {
  const ids = [...locationIds].sort();
  return useQuery({
    queryKey: ["last-serviced", ids],
    enabled: enabled && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("location_service_log")
        .select("location_id, service_date").in("location_id", ids)
        .order("service_date", { ascending: false }).limit(2000);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const r of data ?? []) if (!out[r.location_id]) out[r.location_id] = r.service_date;
      return out;
    },
  });
}

export function useLocationAttendance(locationId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["location-attendance", locationId, from, to],
    enabled: !!locationId,
    queryFn: async () => {
      // personnel_directory (not personnel) so plain 'user' field staff can read names
      const { data, error } = await db.from("location_attendance")
        .select("id, location_id, personnel_id, att_date, status, hours, crew_id, personnel:personnel_id(first_name, last_name)")
        .eq("location_id", locationId).gte("att_date", from).lte("att_date", to);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });
}

/** All attendance rows for a set of locations in a window (one batch, for the summary strip). */
export function useLocationAttendanceBatch(locationIds: string[], from: string, to: string) {
  const ids = [...locationIds].sort();
  return useQuery({
    queryKey: ["location-attendance-batch", ids, from, to],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("location_attendance")
        .select("id, location_id, personnel_id, att_date, status, hours, crew_id")
        .in("location_id", ids).gte("att_date", from).lte("att_date", to);
      if (error) throw error;
      return (data ?? []) as Omit<AttendanceRow, "personnel">[];
    },
  });
}

/** Set (upsert) or clear (status=null) one attendance cell. */
export function useSetAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ location_id, personnel_id, att_date, status, hours, crew_id }: {
      location_id: string; personnel_id: string; att_date: string; status: AttendanceStatus | null; hours?: number | null; crew_id?: string | null;
    }) => {
      if (!status) {
        const { error } = await db.from("location_attendance").delete()
          .eq("location_id", location_id).eq("personnel_id", personnel_id).eq("att_date", att_date);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const row: Record<string, unknown> = { location_id, personnel_id, att_date, status, marked_by: user?.id ?? null };
        if (hours !== undefined) row.hours = hours;
        if (crew_id !== undefined) row.crew_id = crew_id;
        const { error } = await db.from("location_attendance").upsert(row, { onConflict: "location_id,personnel_id,att_date" });
        if (error) throw error;
      }
      return location_id;
    },
    onSuccess: (lid) => {
      qc.invalidateQueries({ queryKey: ["location-attendance", lid] });
      qc.invalidateQueries({ queryKey: ["location-attendance-batch"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update attendance"),
  });
}

/** One-tap: upsert one attendance row per crew member active on the given date. */
export function useMarkCrewAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ crew_id, location_id, att_date, status, defaultHours, memberIds }: {
      crew_id: string; location_id: string; att_date: string; status: AttendanceStatus; defaultHours: number; memberIds: string[];
    }) => {
      if (!memberIds.length) return { location_id, count: 0 };
      const { data: { user } } = await supabase.auth.getUser();
      const rows = memberIds.map((pid) => ({
        location_id, personnel_id: pid, att_date, status, crew_id,
        hours: status === "worked" ? defaultHours : null,
        marked_by: user?.id ?? null,
      }));
      const { error } = await db.from("location_attendance").upsert(rows, { onConflict: "location_id,personnel_id,att_date" });
      if (error) throw error;
      return { location_id, count: rows.length };
    },
    onSuccess: ({ location_id, count }) => {
      qc.invalidateQueries({ queryKey: ["location-attendance", location_id] });
      qc.invalidateQueries({ queryKey: ["location-attendance-batch"] });
      toast.success(`Marked ${count} crew member${count === 1 ? "" : "s"}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to mark crew"),
  });
}

/** Mileage rows for a set of crews within [from, to] — one batched query. */
export function useCrewMileage(crewIds: string[], from: string, to: string) {
  const ids = [...crewIds].sort();
  return useQuery({
    queryKey: ["crew-mileage", ids, from, to],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("crew_mileage_log")
        .select("id, crew_id, log_date, miles, notes").in("crew_id", ids)
        .gte("log_date", from).lte("log_date", to)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MileageRow[];
    },
  });
}

/** Upsert on UNIQUE(crew_id, log_date) — re-entering a day overwrites. */
export function useLogMileage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ crew_id, log_date, miles, notes }: { crew_id: string; log_date: string; miles: number; notes?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db.from("crew_mileage_log")
        .upsert({ crew_id, log_date, miles, notes: notes || null, logged_by: user?.id ?? null }, { onConflict: "crew_id,log_date" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crew-mileage"] }); toast.success("Miles logged"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to log miles"),
  });
}

export function useDeleteMileage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("crew_mileage_log").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crew-mileage"] }); toast.success("Mileage entry deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete mileage"),
  });
}
