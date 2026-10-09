import { useQuery } from "@tanstack/react-query";
import { Award, ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getPathFromUrl } from "@/utils/signedUrlUtils";
import { formatLocalDate, parseLocalDate } from "@/lib/dateUtils";
import { CERT_BUCKET } from "./CertificationsFormSection";

/**
 * Cert files live in a PUBLIC bucket, so the URL is computed synchronously and
 * rendered as a plain anchor — no signing round-trip, no window.open() trick
 * (which mobile Safari blocks when it happens after an await).
 */
function certPublicUrl(path: string): string {
  const clean = getPathFromUrl(path, CERT_BUCKET);
  return supabase.storage.from(CERT_BUCKET).getPublicUrl(clean).data.publicUrl;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i;

const isImageFile = (path: string) => IMAGE_EXT.test(path) || path.startsWith("data:image/");

/** Certifications follow the person across postings, so query by applicant. */
export function useApplicationCertifications(applicantId?: string | null) {
  return useQuery({
    queryKey: ["applicant-certifications", applicantId],
    enabled: !!applicantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_certifications")
        .select("*")
        .eq("applicant_id", applicantId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function ApplicationCertifications({ applicantId }: { applicantId?: string | null }) {
  const { data: certs = [], isLoading } = useApplicationCertifications(applicantId);
  if (isLoading || certs.length === 0) return null;

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
          const url = c.file_path ? certPublicUrl(c.file_path) : null;
          const image = !!c.file_path && isImageFile(c.file_path);
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 p-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {image && url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                    aria-label={`View ${c.cert_type} certification`}
                  >
                    <img
                      src={url}
                      alt={`${c.cert_type} certification`}
                      loading="lazy"
                      className="h-10 w-10 rounded border object-cover"
                    />
                  </a>
                )}
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
              </div>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                >
                  {image ? <ExternalLink className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                  View
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
