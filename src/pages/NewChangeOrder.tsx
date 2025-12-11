import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { ChangeOrderForm } from "@/components/change-orders/ChangeOrderForm";
import { useEffect } from "react";
import { toast } from "sonner";

export default function NewChangeOrder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get("projectId") || undefined;
  const purchaseOrderId = searchParams.get("purchaseOrderId") || undefined;

  // Redirect if no project context
  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <DetailPageLayout
      title="New Change Order"
      subtitle="Create a new change order for scope modifications"
      backPath={`/projects/${projectId}`}
    >
      <ChangeOrderForm
        defaultProjectId={projectId}
        defaultPurchaseOrderId={purchaseOrderId}
      />
    </DetailPageLayout>
  );
}
