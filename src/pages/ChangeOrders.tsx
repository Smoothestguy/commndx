import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { ChangeOrderCard } from "@/components/change-orders/ChangeOrderCard";
import { ChangeOrderStats } from "@/components/change-orders/ChangeOrderStats";
import { ChangeOrderEmptyState } from "@/components/change-orders/ChangeOrderEmptyState";
import { ChangeOrderFilters } from "@/components/change-orders/ChangeOrderFilters";
import {
  useChangeOrders,
  useDeleteChangeOrder,
  useHardDeleteChangeOrder,
  ChangeOrderStatus,
} from "@/integrations/supabase/hooks/useChangeOrders";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useUserRole } from "@/hooks/useUserRole";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ChangeOrders() {
  const navigate = useNavigate();
  const { data: changeOrders, isLoading } = useChangeOrders();
  const { data: projects } = useProjects();
  const deleteChangeOrder = useDeleteChangeOrder();
  const hardDeleteChangeOrder = useHardDeleteChangeOrder();
  const { isAdmin } = useUserRole();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChangeOrderStatus | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);

  const filteredChangeOrders = changeOrders?.filter((co) => {
    const matchesSearch =
      co.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      co.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      co.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || co.status === statusFilter;
    const matchesProject = projectFilter === "all" || co.project_id === projectFilter;
    return matchesSearch && matchesStatus && matchesProject;
  });

  const handleDelete = async () => {
    if (deleteId) {
      await deleteChangeOrder.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleHardDelete = async () => {
    if (hardDeleteId) {
      await hardDeleteChangeOrder.mutateAsync(hardDeleteId);
      setHardDeleteId(null);
    }
  };

  return (
    <PageLayout
      title="Change Orders"
      description="Manage change orders and scope modifications"
      actions={
        <Button onClick={() => navigate("/change-orders/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Change Order
        </Button>
      }
    >
      <div className="space-y-6">
        {changeOrders && changeOrders.length > 0 && (
          <ChangeOrderStats changeOrders={changeOrders} />
        )}

        <ChangeOrderFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          projects={projects?.map((p) => ({ id: p.id, name: p.name }))}
          projectFilter={projectFilter}
          onProjectChange={setProjectFilter}
        />

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredChangeOrders && filteredChangeOrders.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredChangeOrders.map((co) => (
              <ChangeOrderCard
                key={co.id}
                changeOrder={co}
                onDelete={(id) => setDeleteId(id)}
                onHardDelete={isAdmin ? (id) => setHardDeleteId(id) : undefined}
              />
            ))}
          </div>
        ) : (
          <ChangeOrderEmptyState />
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This change order will be moved to trash. You can restore it later from the Trash page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hardDeleteId} onOpenChange={() => setHardDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This action CANNOT be undone. This will permanently delete this change order and all its line items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleHardDelete} className="bg-destructive text-destructive-foreground">
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
