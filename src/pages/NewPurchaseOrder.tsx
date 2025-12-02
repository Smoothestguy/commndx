import { PageLayout } from "@/components/layout/PageLayout";
import { PurchaseOrderForm } from "@/components/purchase-orders/PurchaseOrderForm";

const NewPurchaseOrder = () => {
  return (
    <PageLayout
      title="New Purchase Order"
      description="Create a purchase order for a job order"
    >
      <PurchaseOrderForm />
    </PageLayout>
  );
};

export default NewPurchaseOrder;
