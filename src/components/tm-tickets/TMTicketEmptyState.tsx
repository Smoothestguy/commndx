import { FileText } from "lucide-react";

export function TMTicketEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <FileText className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No T&M Tickets</h3>
      <p className="text-muted-foreground max-w-sm">
        Create T&M tickets to track time and materials for extra work performed on-site.
      </p>
    </div>
  );
}
