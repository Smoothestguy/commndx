import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CertSummary = { count: number; types: string[]; forklift: boolean };
export type CertSummaryMap = Record<string, CertSummary>;

const empty: CertSummaryMap = {};

/** One batched certifications lookup per list view (chunked to keep URLs short). */
export function useApplicantCertSummary(applicantIds: (string | null | undefined)[]) {
  const ids = [...new Set(applicantIds.filter(Boolean) as string[])].sort();
  const { data = empty } = useQuery({
    queryKey: ["applicant-cert-summary", ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CertSummaryMap> => {
      const out: CertSummaryMap = {};
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error } = await supabase
          .from("applicant_certifications")
          .select("applicant_id, cert_type, other_label")
          .in("applicant_id", ids.slice(i, i + 150));
        if (error) throw error;
        for (const c of data ?? []) {
          if (!c.applicant_id) continue;
          const label = c.cert_type === "Other" && c.other_label ? c.other_label : c.cert_type;
          const cur = (out[c.applicant_id] ??= { count: 0, types: [], forklift: false });
          cur.count += 1;
          if (label && !cur.types.includes(label)) cur.types.push(label);
          if (/forklift/i.test(`${c.cert_type} ${c.other_label ?? ""}`)) cur.forklift = true;
        }
      }
      return out;
    },
  });
  return data;
}
