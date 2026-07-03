import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";

export function QuickApplyStats({ postingId }: { postingId: string }) {
  const { data } = useQuery({
    queryKey: ["quick-apply-stats", postingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_apply_invites")
        .select("id, used_at")
        .eq("job_posting_id", postingId);
      if (error) throw error;
      const invited = data?.length ?? 0;
      const applied = data?.filter((r: any) => r.used_at).length ?? 0;
      return { invited, applied };
    },
    staleTime: 30_000,
  });

  if (!data || data.invited === 0) return null;
  return (
    <Badge variant="outline" className="gap-1 text-xs" title="Quick-apply invites: applied / invited">
      <Send className="h-3 w-3" />
      {data.applied}/{data.invited} applied
    </Badge>
  );
}
