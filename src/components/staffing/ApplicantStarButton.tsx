import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useToggleApplicantStar } from "@/hooks/useToggleApplicantStar";

interface Props {
  applicantId?: string | null;
  starredAt?: string | null;
  className?: string;
  size?: "sm" | "md";
}

export function ApplicantStarButton({ applicantId, starredAt, className, size = "sm" }: Props) {
  const { isAdmin, isManager } = useUserRole();
  const toggle = useToggleApplicantStar();
  const [local, setLocal] = useState<boolean>(!!starredAt);
  useEffect(() => setLocal(!!starredAt), [starredAt]);
  const starred = local;
  const canToggle = (isAdmin || isManager) && !!applicantId;
  const icon = (
    <Star
      className={cn(
        size === "md" ? "h-5 w-5" : "h-4 w-4",
        starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50",
      )}
    />
  );

  if (!canToggle) {
    return starred ? (
      <span className={cn("inline-flex items-center justify-center", className)} aria-label="Starred">
        {icon}
      </span>
    ) : (
      <span className={cn("inline-block", size === "md" ? "w-5" : "w-4", className)} />
    );
  }

  return (
    <button
      type="button"
      aria-label={starred ? "Unstar applicant" : "Star applicant"}
      aria-pressed={starred}
      disabled={toggle.isPending}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        const next = !starred;
        setLocal(next);
        toggle.mutate(
          { applicantId: applicantId!, starred: next },
          { onError: () => setLocal(!next) },
        );
      }}
      className={cn(
        "inline-flex items-center justify-center rounded p-1 hover:bg-muted transition-colors disabled:opacity-50",
        className,
      )}
    >
      {icon}
    </button>
  );
}

export function StarredCountChip({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      {count} starred
    </span>
  );
}
