import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoiceEmptyStateProps {
  onAddInvoice: () => void;
  isFiltered?: boolean;
}

export const InvoiceEmptyState = ({
  onAddInvoice,
  isFiltered = false,
}: InvoiceEmptyStateProps) => {
  return (
    <div className="glass rounded-xl p-12 text-center animate-fade-in">
      <div className="flex justify-center mb-4">
        <div className="p-4 rounded-full bg-primary/10">
          <Receipt className="h-12 w-12 text-primary" />
        </div>
      </div>
      <h3 className="font-heading text-xl font-semibold text-foreground mb-2">
        {isFiltered ? "No invoices found" : "No invoices yet"}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        {isFiltered
          ? "Try adjusting your filters or search to find what you're looking for"
          : "Start billing your customers by creating your first invoice"}
      </p>
      {!isFiltered && (
        <Button variant="glow" onClick={onAddInvoice}>
          Create Your First Invoice
        </Button>
      )}
    </div>
  );
};
