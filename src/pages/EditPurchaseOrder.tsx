import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { usePurchaseOrder } from "@/integrations/supabase/hooks/usePurchaseOrders";
import { PurchaseOrderEditForm } from "@/components/purchase-orders/PurchaseOrderEditForm";

const EditPurchaseOrder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: purchaseOrder, isLoading } = usePurchaseOrder(id || "");

  if (isLoading) {
    return (
      <PageLayout title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    );
  }

  if (!purchaseOrder) {
    return (
      <PageLayout title="Purchase Order Not Found">
        <Button variant="ghost" onClick={() => navigate("/purchase-orders")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Purchase Orders
        </Button>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Edit ${purchaseOrder.number}`}
      description={`Editing PO for ${purchaseOrder.vendor_name}`}
    >
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate(`/purchase-orders/${purchaseOrder.id}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Purchase Order
      </Button>

      <PurchaseOrderEditForm purchaseOrder={purchaseOrder} />
    </PageLayout>
  );
};

export default EditPurchaseOrder;
