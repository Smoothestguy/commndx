import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useRoofWarranties, useCreateRoofWarranty, useDeleteRoofWarranty } from "@/integrations/supabase/hooks/useRoofWarranties";
import { WarrantyCard } from "@/components/roofing/warranties/WarrantyCard";
import { WarrantyForm } from "@/components/roofing/warranties/WarrantyForm";
import { WarrantyEmptyState } from "@/components/roofing/warranties/WarrantyEmptyState";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

export default function Warranties() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const { isAdmin, isManager } = useUserRole();

  const { data: warranties, isLoading } = useRoofWarranties();
  const createMutation = useCreateRoofWarranty();
  const deleteMutation = useDeleteRoofWarranty();

  const canManage = isAdmin || isManager;

  const filteredWarranties = warranties?.filter((warranty) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      warranty.customer?.name?.toLowerCase().includes(searchLower) ||
      warranty.project?.name?.toLowerCase().includes(searchLower) ||
      warranty.provider.toLowerCase().includes(searchLower) ||
      warranty.status.toLowerCase().includes(searchLower)
    );
  });

  const handleCreate = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success("Warranty created successfully");
      setFormOpen(false);
    } catch (error) {
      toast.error("Failed to create warranty");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this warranty?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Warranty deleted");
    } catch (error) {
      toast.error("Failed to delete warranty");
    }
  };

  return (
    <PageLayout title="Roof Warranties" description="Track warranty coverage and expirations">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search warranties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {canManage && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Warranty
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !filteredWarranties?.length ? (
          <WarrantyEmptyState onAdd={() => setFormOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWarranties.map((warranty) => (
              <WarrantyCard
                key={warranty.id}
                warranty={warranty}
                onView={(id) => navigate(`/warranties/${id}`)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <WarrantyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreate}
        isLoading={createMutation.isPending}
      />
    </PageLayout>
  );
}
