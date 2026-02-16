import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";

export function MissingTimeEntriesAlert() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: missingPersonnel = [] } = useQuery({
    queryKey: ["missing-time-entries", today],
    queryFn: async () => {
      // Get all active field personnel
      const { data: personnel, error: pError } = await supabase
        .from("personnel")
        .select("id, first_name, last_name")
        .eq("status", "active");
      if (pError) throw pError;

      if (!personnel || personnel.length === 0) return [];

      // Get personnel who have logged time today
      const { data: entries, error: eError } = await supabase
        .from("time_entries")
        .select("personnel_id")
        .eq("entry_date", today)
        .not("personnel_id", "is", null);
      if (eError) throw eError;

      const loggedIds = new Set((entries || []).map(e => e.personnel_id));
      
      return personnel.filter(p => !loggedIds.has(p.id)).map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
      }));
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 min
  });

  if (missingPersonnel.length === 0) return null;

  return (
    <Card className="glass border-border border-orange-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Missing Time Entries Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">
          {missingPersonnel.length} personnel have not logged time for {format(new Date(), "MMM d")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {missingPersonnel.slice(0, 10).map((p) => (
            <span
              key={p.id}
              className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded"
            >
              {p.name}
            </span>
          ))}
          {missingPersonnel.length > 10 && (
            <span className="text-xs text-muted-foreground">
              +{missingPersonnel.length - 10} more
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
