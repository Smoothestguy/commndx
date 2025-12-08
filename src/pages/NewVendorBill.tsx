import { PageLayout } from "@/components/layout/PageLayout";
import { VendorBillForm } from "@/components/vendor-bills/VendorBillForm";

export default function NewVendorBill() {
  return (
    <PageLayout title="New Vendor Bill" description="Create a new bill from a vendor">
      <VendorBillForm />
    </PageLayout>
  );
}
