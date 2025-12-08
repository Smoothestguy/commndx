import { useParams } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { VendorBillForm } from "@/components/vendor-bills/VendorBillForm";
import { useVendorBill } from "@/integrations/supabase/hooks/useVendorBills";

export default function EditVendorBill() {
  const { id } = useParams();
  const { data: bill, isLoading } = useVendorBill(id);

  if (isLoading) {
    return (
      <PageLayout title="Edit Vendor Bill">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </PageLayout>
    );
  }

  if (!bill) {
    return (
      <PageLayout title="Edit Vendor Bill">
        <div className="text-center py-8 text-muted-foreground">Bill not found</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Edit Vendor Bill" description={bill.number}>
      <VendorBillForm bill={bill} isEditing />
    </PageLayout>
  );
}
