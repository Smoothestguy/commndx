import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KEYS = [
  ["applications"],
  ["staffing-applications"],
  ["applicants"],
  ["workforce-pool"],
  ["master-applicants"],
  ["project-applications"],
  ["application"],
];

export function useToggleApplicantStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ applicantId, starred }: { applicantId: string; starred: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("applicants")
        .update({
          starred_at: starred ? new Date().toISOString() : null,
          starred_by: starred ? auth.user?.id ?? null : null,
        } as any)
        .eq("id", applicantId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.starred ? "Starred" : "Unstarred");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update star"),
    onSettled: () => {
      // Broad invalidation: any query whose key mentions applicants/applications.
      qc.invalidateQueries({
        predicate: (q) =>
          KEYS.some((k) => q.queryKey[0] === k[0]) ||
          q.queryKey.some((p) => typeof p === "string" && /applica|applicant|workforce/i.test(p)),
      });
    },
  });
}
