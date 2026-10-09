import { Award, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { splitRoleTags } from "@/lib/roleTags";
import type { CertSummary } from "@/hooks/useApplicantCertSummary";

type Meta = { role_tags?: string[] | null; staff_notes?: string | null } | null | undefined;

/** Role-tag badges (max 2 + overflow) and certification indicator, shown after the name. */
export function ApplicantTagBadges({
  applicant,
  certs,
  className,
}: {
  applicant: Meta;
  certs?: CertSummary;
  className?: string;
}) {
  const { shown, overflow } = splitRoleTags(applicant?.role_tags);
  if (!shown.length && !certs?.count) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map((t) => (
        <Badge key={t} variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
          {t}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge
          variant="secondary"
          className="h-5 px-1.5 text-[10px] font-normal"
          title={(applicant?.role_tags ?? []).join(", ")}
        >
          +{overflow}
        </Badge>
      )}
      {certs && certs.count > 0 &&
        (certs.forklift ? (
          <Badge
            variant="outline"
            className="h-5 gap-0.5 px-1.5 text-[10px] font-normal"
            title={`Certifications: ${certs.types.join(", ")}`}
          >
            <Award className="h-3 w-3" /> Forklift
          </Badge>
        ) : (
          <span
            className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"
            title={`Certifications: ${certs.types.join(", ")}`}
          >
            <Award className="h-3 w-3" />
            {certs.count}
          </span>
        ))}
    </span>
  );
}

/** One truncated muted line with the internal staff note. */
export function ApplicantNoteLine({ applicant, className }: { applicant: Meta; className?: string }) {
  const note = applicant?.staff_notes?.trim();
  if (!note) return null;
  return (
    <p
      className={cn("flex items-center gap-1 text-xs text-muted-foreground min-w-0", className)}
      title={note}
    >
      <StickyNote className="h-3 w-3 shrink-0" />
      <span className="line-clamp-1 break-all">{note}</span>
    </p>
  );
}
