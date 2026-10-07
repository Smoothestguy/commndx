import { useQuery } from "@tanstack/react-query";
import { Award, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/utils/signedUrlUtils";
import { formatLocalDate, parseLocalDate } from "@/lib/dateUtils";
import { CERT_BUCKET } from "./CertificationsFormSection";

export function useApplicationCertifications(applicationId?: string) {
  return useQuery({
    queryKey: ["applicant-certifications", applicationId],
    enabled: !!applicationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_certifications")
        .select("*")
        .eq("application_id", applicationId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function ApplicationCertifications({ applicationId }: { applicationId?: string }) {
  const { data: certs = [], isLoading } = useApplicationCertifications(applicationId);
  if (isLoading || certs.length === 0) return null;

  const open = async (path: string) => {
    const win = window.open("", "_blank");
    const url = await getSignedUrl(CERT_BUCKET, path);
    if (url && win) win.location.href = url;
    else win?.close();
  };
  const today = new Date();

  return (
    <div className="space-y-2">
      <h3 className="font-semibold flex items-center gap-2">
        <Award className="h-4 w-4" /> Certifications
        <Badge variant="secondary">{certs.length}</Badge>
      </h3>
      <ul className="divide-y rounded-md border">
        {certs.map((c) => {
          const expired = c.expires_on ? parseLocalDate(c.expires_on) < today : false;
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 p-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">
                  {c.cert_type}{c.cert_type === "Other" && c.other_label ? ` — ${c.other_label}` : ""}
                </span>
                {c.expires_on && (
                  <span className={`ml-2 ${expired ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {expired ? "Expired " : "Exp. "}{formatLocalDate(c.expires_on)}
                  </span>
                )}
              </div>
              {c.file_path && (
                <button type="button" onClick={() => open(c.file_path!)}
                  className="inline-flex items-center gap-1 text-primary hover:underline shrink-0">
                  View <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
