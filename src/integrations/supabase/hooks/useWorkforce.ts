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
          "id, first_name, last_name, email, phone, photo_url, city, state, status, created_at, capabilities_classified_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: caps, error: capErr } = await supabase
        .from("applicant_capabilities")
        .select("id, applicant_id, category_id, years_experience, confidence, source, evidence");
      if (capErr) throw capErr;

      const { data: apps, error: appErr } = await supabase
        .from("applications")
        .select("applicant_id, created_at, job_postings ( project_task_orders ( title ) )")
        .order("created_at", { ascending: false });
      if (appErr) throw appErr;

      const tagsBy = new Map<string, CapabilityTag[]>();
      for (const c of caps ?? []) {
        const list = tagsBy.get(c.applicant_id) ?? [];
        list.push(c as CapabilityTag);
        tagsBy.set(c.applicant_id, list);
      }

      const lastApp = new Map<string, { at: string; title: string | null }>();
      for (const a of apps ?? []) {
        if (!a.applicant_id || lastApp.has(a.applicant_id)) continue;
        const title =
          (a as any).job_postings?.project_task_orders?.title ?? null;
        lastApp.set(a.applicant_id, { at: a.created_at as string, title });
      }

      return (applicants ?? []).map((a) => ({
        ...(a as any),
        tags: tagsBy.get(a.id) ?? [],
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
