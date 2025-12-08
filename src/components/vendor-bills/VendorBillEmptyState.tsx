import { FileText } from "lucide-react";

export function VendorBillEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No vendor bills yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm">
        Create your first vendor bill to start tracking expenses from suppliers and contractors.
      </p>
    </div>
  );
}
