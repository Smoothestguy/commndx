import { useParams, Navigate } from "react-router-dom";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { ChangeOrderForm } from "@/components/change-orders/ChangeOrderForm";
import { useChangeOrder } from "@/integrations/supabase/hooks/useChangeOrders";
import { useChangeOrderPermissions } from "@/hooks/useChangeOrderPermissions";
import { PermissionSummaryCard } from "@/components/shared/PermissionSummaryCard";
import { Loader2, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function EditChangeOrder() {
  const { id } = useParams<{ id: string }>();
  const { data: changeOrder, isLoading, error, isError } = useChangeOrder(id);
  const permissions = useChangeOrderPermissions(changeOrder);

  const backPath = changeOrder ? `/projects/${changeOrder.project_id}` : "/projects";

  if (isLoading || permissions.loading) {
    return (
      <DetailPageLayout title="Edit Change Order" backPath="/projects">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DetailPageLayout>
    );
  }

  if (isError) {
    return (
      <DetailPageLayout title="Error Loading Change Order" backPath="/projects">
        <div className="text-center py-12">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">Failed to load change order. Please try again.</p>
          <p className="text-sm text-muted-foreground mt-2">{(error as Error)?.message}</p>
        </div>
      </DetailPageLayout>
    );
  }

  if (!changeOrder) {
    return (
      <DetailPageLayout title="Change Order Not Found" backPath="/projects">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            The change order you're looking for doesn't exist.
          </p>
        </div>
      </DetailPageLayout>
    );
  }

  // Check if user has permission to view
  if (!permissions.canView) {
    return <Navigate to="/" replace />;
  }

  // Check if user can edit this change order
  const canEditDocument = permissions.canEdit;

  return (
    <DetailPageLayout
      title={`Edit ${changeOrder.number}`}
      subtitle="Modify change order details"
      backPath={backPath}
    >
      <div className="space-y-6">
        {/* Permission Summary Card */}
        <PermissionSummaryCard 
          permissions={permissions} 
          documentType="Change Order"
          status={changeOrder.status}
        />

        {/* Warning if read-only */}
        {!canEditDocument && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Read-Only Access</AlertTitle>
            <AlertDescription>
              {changeOrder.status !== 'draft' 
                ? `This change order is in "${changeOrder.status}" status and cannot be edited.`
                : "You do not have permission to edit this change order."}
            </AlertDescription>
          </Alert>
        )}

        <ChangeOrderForm 
          initialData={changeOrder} 
          permissions={permissions}
        />
      </div>
    </DetailPageLayout>
  );
}
