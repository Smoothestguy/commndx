import { Clock } from "lucide-react";

export function TimeEntryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Clock className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No time entries yet</h3>
      <p className="text-muted-foreground max-w-sm">
        Start tracking your time by adding your first entry. Log hours against projects to keep track of your work.
      </p>
    </div>
  );
}
