import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useRoofInspections, useCreateRoofInspection, useDeleteRoofInspection } from "@/integrations/supabase/hooks/useRoofInspections";
import { InspectionCard } from "@/components/roofing/inspections/InspectionCard";
import { InspectionForm } from "@/components/roofing/inspections/InspectionForm";
import { InspectionEmptyState } from "@/components/roofing/inspections/InspectionEmptyState";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

export default function RoofInspections() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const { isAdmin, isManager } = useUserRole();

  const { data: inspections, isLoading } = useRoofInspections();
  const createMutation = useCreateRoofInspection();
  const deleteMutation = useDeleteRoofInspection();

  const canManage = isAdmin || isManager;

  const filteredInspections = inspections?.filter((inspection) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      inspection.customer?.name?.toLowerCase().includes(searchLower) ||
      inspection.project?.name?.toLowerCase().includes(searchLower) ||
      inspection.status.toLowerCase().includes(searchLower)
    );
  });

  const handleCreate = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success("Inspection created successfully");
      setFormOpen(false);
    } catch (error) {
      toast.error("Failed to create inspection");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this inspection?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Inspection deleted");
    } catch (error) {
      toast.error("Failed to delete inspection");
    }
  };

  return (
    <PageLayout title="Roof Inspections" description="Track and manage roof inspections">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex-1 max-w-sm">
            <SearchInput
              placeholder="Search inspections..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          {canManage && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Inspection
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !filteredInspections?.length ? (
          <InspectionEmptyState onAdd={() => setFormOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInspections.map((inspection) => (
              <InspectionCard
                key={inspection.id}
                inspection={inspection}
                onView={(id) => navigate(`/roof-inspections/${id}`)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <InspectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreate}
        isLoading={createMutation.isPending}
      />
    </PageLayout>
  );
}
