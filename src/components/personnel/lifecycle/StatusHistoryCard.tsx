import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Receipt } from "lucide-react";
import { useStatusHistory } from "@/integrations/supabase/hooks/usePersonnelStatus";
import { PersonnelStatusButton, StatusBadge } from "./PersonnelStatusButton";
import { AddExpenseDialog } from "./AddExpenseDialog";

/** Current status control + append-only status audit trail for one person. */
export function StatusHistoryCard({ personnelId }: { personnelId: string }) {
  const { data = [], isLoading } = useStatusHistory(personnelId);
  const [expOpen, setExpOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Lifecycle status</CardTitle>
        <div className="flex items-center gap-2">
          <PersonnelStatusButton personnelId={personnelId} />
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setExpOpen(true)}><Receipt className="h-4 w-4" />Add expense</Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs font-medium text-muted-foreground mb-2">Status history</p>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No status changes yet — treated as Available.</p>
        ) : (
          <ol className="relative border-l pl-4 space-y-3">
            {data.map((r) => (
              <li key={r.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} projectName={r.project_name} />
                  {r.status !== "standby" && r.status !== "activated" && r.project_name && <span className="text-xs text-muted-foreground">{r.project_name}</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(r.effective_at), "MMM d, yyyy HH:mm")} · by {r.set_by_name}</p>
                {r.note && <p className="text-sm mt-0.5">{r.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      <AddExpenseDialog open={expOpen} onOpenChange={setExpOpen} personnelId={personnelId} />
    </Card>
  );
}
