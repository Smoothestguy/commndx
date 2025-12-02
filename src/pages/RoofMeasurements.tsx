import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useRoofMeasurements, useCreateRoofMeasurement, useDeleteRoofMeasurement } from "@/integrations/supabase/hooks/useRoofMeasurements";
import { MeasurementCard } from "@/components/roofing/measurements/MeasurementCard";
import { MeasurementForm } from "@/components/roofing/measurements/MeasurementForm";
import { MeasurementEmptyState } from "@/components/roofing/measurements/MeasurementEmptyState";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

export default function RoofMeasurements() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const { isAdmin, isManager } = useUserRole();

  const { data: measurements, isLoading } = useRoofMeasurements();
  const createMutation = useCreateRoofMeasurement();
  const deleteMutation = useDeleteRoofMeasurement();

  const canManage = isAdmin || isManager;

  const filteredMeasurements = measurements?.filter((measurement) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      measurement.customer?.name?.toLowerCase().includes(searchLower) ||
      measurement.project?.name?.toLowerCase().includes(searchLower) ||
      measurement.roof_type?.toLowerCase().includes(searchLower)
    );
  });

  const handleCreate = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success("Measurement created successfully");
      setFormOpen(false);
    } catch (error) {
      toast.error("Failed to create measurement");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this measurement?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Measurement deleted");
    } catch (error) {
      toast.error("Failed to delete measurement");
    }
  };

  const handleView = (id: string) => {
    navigate(`/roof-measurements/${id}`);
  };

  return (
    <PageLayout title="Roof Measurements" description="Track roof measurements and calculations">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search measurements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {canManage && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Measurement
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !filteredMeasurements?.length ? (
          <MeasurementEmptyState onAdd={() => setFormOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMeasurements.map((measurement) => (
              <MeasurementCard
                key={measurement.id}
                measurement={measurement}
                onView={handleView}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <MeasurementForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreate}
        isLoading={createMutation.isPending}
      />
    </PageLayout>
  );
}
