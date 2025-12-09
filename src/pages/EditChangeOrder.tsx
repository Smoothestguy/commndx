import { useParams } from "react-router-dom";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { ChangeOrderForm } from "@/components/change-orders/ChangeOrderForm";
import { useChangeOrder } from "@/integrations/supabase/hooks/useChangeOrders";
import { Loader2 } from "lucide-react";

export default function EditChangeOrder() {
  const { id } = useParams<{ id: string }>();
  const { data: changeOrder, isLoading } = useChangeOrder(id);

  if (isLoading) {
    return (
      <DetailPageLayout title="Edit Change Order">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DetailPageLayout>
    );
  }

  if (!changeOrder) {
    return (
      <DetailPageLayout title="Change Order Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            The change order you're looking for doesn't exist.
          </p>
        </div>
      </DetailPageLayout>
    );
  }

  return (
    <DetailPageLayout
      title={`Edit ${changeOrder.number}`}
      description="Modify change order details"
    >
      <ChangeOrderForm initialData={changeOrder} />
    </DetailPageLayout>
  );
}
