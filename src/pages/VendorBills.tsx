import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useVendorBills, useDeleteVendorBill, VendorBillFilters as FilterType } from "@/integrations/supabase/hooks/useVendorBills";
import { VendorBillCard } from "@/components/vendor-bills/VendorBillCard";
import { VendorBillEmptyState } from "@/components/vendor-bills/VendorBillEmptyState";
import { VendorBillStats } from "@/components/vendor-bills/VendorBillStats";
import { VendorBillFilters } from "@/components/vendor-bills/VendorBillFilters";
import { VendorBillPaymentDialog } from "@/components/vendor-bills/VendorBillPaymentDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function VendorBills() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterType>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paymentBillId, setPaymentBillId] = useState<string | null>(null);

  const { data: bills, isLoading } = useVendorBills(filters);
  const deleteBill = useDeleteVendorBill();

  const filteredBills = bills?.filter(bill =>
    bill.number.toLowerCase().includes(search.toLowerCase()) ||
    bill.vendor_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const paymentBill = bills?.find(b => b.id === paymentBillId);

  return (
    <PageLayout title="Vendor Bills" description="Track bills from vendors and suppliers">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search bills..."
            className="w-full sm:w-80"
          />
          <Button onClick={() => navigate("/vendor-bills/new")}>
            <Plus className="h-4 w-4 mr-1" />
            New Bill
          </Button>
        </div>

        <VendorBillFilters filters={filters} onFiltersChange={setFilters} />

        {bills && bills.length > 0 && <VendorBillStats bills={bills} />}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredBills.length === 0 ? (
          <VendorBillEmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBills.map((bill) => (
              <VendorBillCard
                key={bill.id}
                bill={bill}
                onView={(id) => navigate(`/vendor-bills/${id}`)}
                onEdit={(id) => navigate(`/vendor-bills/${id}/edit`)}
                onDelete={(id) => setDeleteId(id)}
                onRecordPayment={(id) => setPaymentBillId(id)}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bill? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteBill.mutate(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {paymentBill && (
        <VendorBillPaymentDialog
          open={!!paymentBillId}
          onOpenChange={() => setPaymentBillId(null)}
          billId={paymentBill.id}
          remainingAmount={Number(paymentBill.remaining_amount)}
        />
      )}
    </PageLayout>
  );
}
