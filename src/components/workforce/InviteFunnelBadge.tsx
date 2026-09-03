import { useInviteFunnel } from "@/integrations/supabase/hooks/useWorkforce";

/** Compact "Invited 40 · Opened 22 · Applied 9" counter for a job posting. */
export function InviteFunnelBadge({ jobPostingId }: { jobPostingId: string }) {
  const { data } = useInviteFunnel(jobPostingId);
  if (!data || data.invited === 0) return null;
  return (
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      Invited {data.invited} · Opened {data.opened} · Applied {data.applied}
    </span>
  );
}
