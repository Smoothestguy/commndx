import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Edit, Trash2 } from "lucide-react";
import { TimeEntry } from "@/integrations/supabase/hooks/useTimeEntries";
import { format } from "date-fns";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";

interface TimeEntryCardProps {
  entry: TimeEntry;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
}

export function TimeEntryCard({ entry, onEdit, onDelete }: TimeEntryCardProps) {
  const { data: projects } = useProjects();
  const project = projects?.find((p) => p.id === entry.project_id);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-medium">{project?.name || "Unknown Project"}</h4>
          <p className="text-sm text-muted-foreground">
            {format(new Date(entry.entry_date), "MMM d, yyyy")}
          </p>
        </div>
        <Badge variant={entry.billable ? "default" : "secondary"}>
          {entry.billable ? "Billable" : "Non-billable"}
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <Clock className="h-4 w-4" />
        <span className="font-medium">{Number(entry.hours).toFixed(2)} hours</span>
      </div>

      {entry.description && (
        <p className="text-sm text-muted-foreground mb-3">{entry.description}</p>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onEdit(entry)}
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(entry.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
