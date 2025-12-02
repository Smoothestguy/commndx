import { Activity } from "lucide-react";

export function ActivityEmptyState() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
        <Activity className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Invitation activity will be tracked and displayed here.
      </p>
    </div>
  );
}
