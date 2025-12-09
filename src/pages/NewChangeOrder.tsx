import { useSearchParams, useNavigate } from "react-router-dom";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { ChangeOrderForm } from "@/components/change-orders/ChangeOrderForm";

export default function NewChangeOrder() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  const purchaseOrderId = searchParams.get("purchaseOrderId") || undefined;

  return (
    <DetailPageLayout
      title="New Change Order"
      subtitle="Create a new change order for scope modifications"
      backPath="/change-orders"
    >
      <ChangeOrderForm
        defaultProjectId={projectId}
        defaultPurchaseOrderId={purchaseOrderId}
      />
    </DetailPageLayout>
  );
}
