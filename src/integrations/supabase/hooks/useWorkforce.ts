import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CapabilityCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  aliases: string[];
  sort_order: number;
  is_active: boolean;
};

export type CapabilityTag = {
  id: string;
  applicant_id: string;
  category_id: string;
  years_experience: number | null;
  confidence: number | null;
  source: "ai" | "self" | "admin" | "verified";
  evidence: string | null;
};

export type WorkforceApplicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  city: string | null;
  state: string | null;
  status: string;
  created_at: string;
  capabilities_classified_at: string | null;
  do_not_rehire: boolean;
  do_not_rehire_reason: string | null;
  sms_opted_out: boolean;
  availability_status: string;
  available_from: string | null;
  home_lat: number | null;
  home_lng: number | null;
  has_sms_consent: boolean;
  applied_posting_ids: string[];
  tags: CapabilityTag[];
  last_application_at: string | null;
  last_application_title: string | null;
};

export const useCapabilityCategories = () =>
  useQuery({
    queryKey: ["capability-categories"],
    queryFn: async (): Promise<CapabilityCategory[]> => {
      const { data, error } = await supabase
        .from("capability_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CapabilityCategory[];
    },
  });

export const useWorkforcePool = () =>
  useQuery({
    queryKey: ["workforce-pool"],
    queryFn: async (): Promise<WorkforceApplicant[]> => {
      const { data: applicants, error } = await supabase
        .from("applicants")
        .select(
          "id, first_name, last_name, email, phone, photo_url, city, state, status, created_at, capabilities_classified_at, do_not_rehire, do_not_rehire_reason, sms_opted_out, availability_status, available_from, home_lat, home_lng"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: caps, error: capErr } = await supabase
        .from("applicant_capabilities")
        .select("id, applicant_id, category_id, years_experience, confidence, source, evidence");
      if (capErr) throw capErr;

      const { data: apps, error: appErr } = await supabase
        .from("applications")
        .select(
          "applicant_id, created_at, job_posting_id, sms_consent, job_postings ( project_task_orders ( title ) )"
        )
        .order("created_at", { ascending: false });
      if (appErr) throw appErr;

      const tagsBy = new Map<string, CapabilityTag[]>();
      for (const c of caps ?? []) {
        const list = tagsBy.get(c.applicant_id) ?? [];
        list.push(c as CapabilityTag);
        tagsBy.set(c.applicant_id, list);
      }

      const lastApp = new Map<string, { at: string; title: string | null }>();
      const consent = new Set<string>();
      const postingsBy = new Map<string, string[]>();
      for (const a of apps ?? []) {
        if (!a.applicant_id) continue;
        if (!lastApp.has(a.applicant_id)) {
          const title = (a as any).job_postings?.project_task_orders?.title ?? null;
          lastApp.set(a.applicant_id, { at: a.created_at as string, title });
        }
        if ((a as any).sms_consent) consent.add(a.applicant_id);
        if (a.job_posting_id) {
          const list = postingsBy.get(a.applicant_id) ?? [];
          list.push(a.job_posting_id);
          postingsBy.set(a.applicant_id, list);
        }
      }

      return (applicants ?? []).map((a) => ({
        ...(a as any),
        tags: tagsBy.get(a.id) ?? [],
        has_sms_consent: consent.has(a.id),
        applied_posting_ids: postingsBy.get(a.id) ?? [],
        last_application_at: lastApp.get(a.id)?.at ?? null,
        last_application_title: lastApp.get(a.id)?.title ?? null,
      })) as WorkforceApplicant[];
    },
  });

export const useAddCapabilityTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      applicant_id: string;
      category_id: string;
      years_experience?: number | null;
      evidence?: string | null;
    }) => {
      const { error } = await supabase.from("applicant_capabilities").upsert(
        {
          applicant_id: payload.applicant_id,
          category_id: payload.category_id,
          years_experience: payload.years_experience ?? null,
          evidence: payload.evidence ?? null,
          confidence: null,
          source: "admin",
        },
        { onConflict: "applicant_id,category_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workforce-pool"] });
      toast.success("Category added");
    },
    onError: (e: Error) => toast.error(`Failed to add category: ${e.message}`),
  });
};

export const useRemoveCapabilityTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("applicant_capabilities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workforce-pool"] });
      toast.success("Tag removed");
    },
    onError: (e: Error) => toast.error(`Failed to remove tag: ${e.message}`),
  });
};

export const useClassifyApplicants = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      batch_size?: number;
      chain?: boolean;
      applicant_ids?: string[];
      force_reclassify?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("classify-applicants", {
        body: { batch_size: 15, chain: true, ...payload },
      });
      if (error) throw error;
      return data as {
        processed: number;
        tagged_rows: number;
        remaining: number;
        paused?: boolean;
        reason?: string;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workforce-pool"] });
    },
    onError: (e: Error) => toast.error(`Classification failed: ${e.message}`),
  });
};

/* ------------------------------------------------------------------ */
/* Phase 2: work history, ratings, messages, invites                    */
/* ------------------------------------------------------------------ */

export type WorkforceHistoryEntry = {
  assignment_id: string;
  personnel_id: string;
  project_id: string | null;
  project_name: string | null;
  assigned_at: string | null;
  unassigned_at: string | null;
  status: string | null;
  pay_rate: number | null;
  work_classification: string | null;
};

export type WorkforcePersonnelLink = {
  personnel_id: string;
  applicant_id: string;
  rating: number | null;
  projects_worked: number;
  last_project_name: string | null;
  last_project_at: string | null;
};

/** Personnel links + assignment history for every applicant that has worked with FRG. */
export const useWorkforceHistory = () =>
  useQuery({
    queryKey: ["workforce-history"],
    queryFn: async () => {
      const { data: personnel, error } = await supabase
        .from("personnel")
        .select("id, applicant_id, rating")
        .not("applicant_id", "is", null);
      if (error) throw error;

      const personnelIds = (personnel ?? []).map((p) => p.id);
      let assignments: any[] = [];
      if (personnelIds.length) {
        const { data, error: aErr } = await supabase
          .from("personnel_project_assignments")
          .select(
            "id, personnel_id, project_id, assigned_at, unassigned_at, status, pay_rate, work_classification, projects ( name )"
          )
          .in("personnel_id", personnelIds)
          .order("assigned_at", { ascending: false });
        if (aErr) throw aErr;
        assignments = data ?? [];
      }

      const byPersonnel = new Map<string, WorkforceHistoryEntry[]>();
      for (const a of assignments) {
        const entry: WorkforceHistoryEntry = {
          assignment_id: a.id,
          personnel_id: a.personnel_id,
          project_id: a.project_id,
          project_name: a.projects?.name ?? null,
          assigned_at: a.assigned_at,
          unassigned_at: a.unassigned_at,
          status: a.status,
          pay_rate: a.pay_rate,
          work_classification: a.work_classification,
        };
        const list = byPersonnel.get(a.personnel_id) ?? [];
        list.push(entry);
        byPersonnel.set(a.personnel_id, list);
      }

      const links = new Map<string, WorkforcePersonnelLink>();
      const historyByApplicant = new Map<string, WorkforceHistoryEntry[]>();
      for (const p of personnel ?? []) {
        const hist = byPersonnel.get(p.id) ?? [];
        const distinctProjects = new Set(hist.map((h) => h.project_id).filter(Boolean));
        links.set(p.applicant_id as string, {
          personnel_id: p.id,
          applicant_id: p.applicant_id as string,
          rating: p.rating != null ? Number(p.rating) : null,
          projects_worked: distinctProjects.size,
          last_project_name: hist[0]?.project_name ?? null,
          last_project_at: hist[0]?.assigned_at ?? null,
        });
        historyByApplicant.set(p.applicant_id as string, hist);
      }

      return { links, historyByApplicant };
    },
  });

export type AssignmentRating = {
  id: string;
  personnel_id: string;
  project_id: string | null;
  assignment_id: string | null;
  rated_by: string | null;
  overall: number;
  reliability: number | null;
  skill: number | null;
  attitude: number | null;
  would_rehire: boolean;
  notes: string | null;
  created_at: string;
};

export const usePersonnelRatings = (personnelId: string | undefined) =>
  useQuery({
    queryKey: ["personnel-ratings", personnelId],
    enabled: !!personnelId,
    queryFn: async (): Promise<AssignmentRating[]> => {
      const { data, error } = await supabase
        .from("personnel_assignment_ratings")
        .select("*")
        .eq("personnel_id", personnelId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssignmentRating[];
    },
  });

/**
 * Saves a rating and, for a positive rating, promotes the matching capability
 * categories to source='verified' for the linked applicant.
 */
export const useSaveRating = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      personnel_id: string;
      project_id?: string | null;
      assignment_id?: string | null;
      overall: number;
      reliability?: number | null;
      skill?: number | null;
      attitude?: number | null;
      would_rehire: boolean;
      notes?: string | null;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("personnel_assignment_ratings").insert({
        ...payload,
        rated_by: userRes.user?.id ?? null,
      });
      if (error) throw error;

      if (payload.overall >= 3 && payload.project_id) {
        await verifyCapabilitiesForProject(
          payload.personnel_id,
          payload.project_id,
          payload.overall
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workforce-pool"] });
      qc.invalidateQueries({ queryKey: ["workforce-history"] });
      qc.invalidateQueries({ queryKey: ["personnel-ratings"] });
      toast.success("Rating saved");
    },
    onError: (e: Error) => toast.error(`Failed to save rating: ${e.message}`),
  });
};

async function verifyCapabilitiesForProject(
  personnelId: string,
  projectId: string,
  overall: number
) {
  const { data: person } = await supabase
    .from("personnel")
    .select("applicant_id")
    .eq("id", personnelId)
    .maybeSingle();
  if (!person?.applicant_id) return;

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();

  const { data: taskOrders } = await supabase
    .from("project_task_orders")
    .select("id, task_order_positions ( position_label )")
    .eq("project_id", projectId);
  const { data: brackets } = await supabase
    .from("project_rate_brackets")
    .select("name")
    .eq("project_id", projectId);

  const labels = [
    ...(taskOrders ?? []).flatMap((t: any) =>
      (t.task_order_positions ?? []).map((p: any) => p.position_label as string)
    ),
    ...(brackets ?? []).map((b: any) => b.name as string),
  ]
    .filter(Boolean)
    .map((l) => l.trim().toLowerCase());
  if (!labels.length) return;

  const { data: categories } = await supabase
    .from("capability_categories")
    .select("id, name, aliases")
    .eq("is_active", true);

  const matched = (categories ?? []).filter((c: any) => {
    const names = [c.name, ...(c.aliases ?? [])].map((n: string) => n.trim().toLowerCase());
    return labels.some((l) => names.some((n) => n === l || l.includes(n) || n.includes(l)));
  });
  if (!matched.length) return;

  await supabase.from("applicant_capabilities").upsert(
    matched.map((c: any) => ({
      applicant_id: person.applicant_id as string,
      category_id: c.id,
      source: "verified",
      confidence: 1.0,
      evidence: `Rated ${overall}/5 on ${project?.name ?? "a project"}`,
    })),
    { onConflict: "applicant_id,category_id" }
  );
}

export const useUpdateApplicantFlags = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      do_not_rehire?: boolean;
      do_not_rehire_reason?: string | null;
      availability_status?: string;
      available_from?: string | null;
    }) => {
      const { id, ...rest } = payload;
      const { error } = await supabase.from("applicants").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workforce-pool"] });
      toast.success("Applicant updated");
    },
    onError: (e: Error) => toast.error(`Update failed: ${e.message}`),
  });
};

export type ApplicantMessage = {
  id: string;
  applicant_id: string;
  job_posting_id: string | null;
  channel: string;
  body: string | null;
  subject: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

export const useApplicantMessages = (applicantId: string | undefined) =>
  useQuery({
    queryKey: ["applicant-messages", applicantId],
    enabled: !!applicantId,
    queryFn: async (): Promise<ApplicantMessage[]> => {
      const { data, error } = await supabase
        .from("applicant_messages")
        .select("*")
        .eq("applicant_id", applicantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApplicantMessage[];
    },
  });

export type ApplicantInvite = {
  id: string;
  job_posting_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  used_at: string | null;
};

export const useApplicantInvites = (applicantId: string | undefined) =>
  useQuery({
    queryKey: ["applicant-invites", applicantId],
    enabled: !!applicantId,
    queryFn: async (): Promise<ApplicantInvite[]> => {
      const { data, error } = await supabase
        .from("quick_apply_invites")
        .select("id, job_posting_id, sent_at, opened_at, used_at")
        .eq("applicant_id", applicantId!)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApplicantInvite[];
    },
  });

export type ApplicantApplication = {
  id: string;
  created_at: string;
  status: string;
  job_posting_id: string | null;
  title: string | null;
};

export const useApplicantApplications = (applicantId: string | undefined) =>
  useQuery({
    queryKey: ["applicant-applications", applicantId],
    enabled: !!applicantId,
    queryFn: async (): Promise<ApplicantApplication[]> => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, created_at, status, job_posting_id, job_postings ( project_task_orders ( title ) )")
        .eq("applicant_id", applicantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((a: any) => ({
        id: a.id,
        created_at: a.created_at,
        status: a.status,
        job_posting_id: a.job_posting_id,
        title: a.job_postings?.project_task_orders?.title ?? null,
      }));
    },
  });

/** Invite funnel counters for a posting: invited / opened / applied. */
export const useInviteFunnel = (jobPostingId: string | undefined) =>
  useQuery({
    queryKey: ["invite-funnel", jobPostingId],
    enabled: !!jobPostingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_apply_invites")
        .select("id, opened_at, used_at")
        .eq("job_posting_id", jobPostingId!);
      if (error) throw error;
      const rows = data ?? [];
      return {
        invited: rows.length,
        opened: rows.filter((r) => r.opened_at || r.used_at).length,
        applied: rows.filter((r) => r.used_at).length,
      };
    },
  });

export const useSendWorkforceInvites = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      job_posting_id?: string | null;
      applicant_ids: string[];
      channel: "sms" | "email" | "both";
      sms_text?: string;
      email_subject?: string;
      email_body?: string;
      options?: Record<string, boolean>;
      dry_run?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-workforce-invites", {
        body: payload,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        sent?: number;
        failed?: number;
        skipped?: number;
        eligible?: number;
        dry_run?: boolean;
        results: Array<Record<string, any>>;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invite-funnel"] });
      qc.invalidateQueries({ queryKey: ["applicant-messages"] });
    },
    onError: (e: Error) => toast.error(`Send failed: ${e.message}`),
  });
};
