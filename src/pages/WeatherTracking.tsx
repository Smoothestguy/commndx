import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useWeatherLogs, useCreateWeatherLog, useDeleteWeatherLog } from "@/integrations/supabase/hooks/useWeatherLogs";
import { WeatherCard } from "@/components/roofing/weather/WeatherCard";
import { WeatherLogForm } from "@/components/roofing/weather/WeatherLogForm";
import { WeatherEmptyState } from "@/components/roofing/weather/WeatherEmptyState";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

export default function WeatherTracking() {
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const { isAdmin, isManager } = useUserRole();

  const { data: logs, isLoading } = useWeatherLogs();
  const createMutation = useCreateWeatherLog();
  const deleteMutation = useDeleteWeatherLog();

  const canManage = isAdmin || isManager;

  const filteredLogs = logs?.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      log.location.toLowerCase().includes(searchLower) ||
      log.project?.name?.toLowerCase().includes(searchLower) ||
      log.conditions?.toLowerCase().includes(searchLower)
    );
  });

  const handleCreate = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success("Weather log created successfully");
      setFormOpen(false);
    } catch (error) {
      toast.error("Failed to create weather log");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this weather log?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Weather log deleted");
    } catch (error) {
      toast.error("Failed to delete weather log");
    }
  };

  return (
    <PageLayout title="Weather Tracking" description="Track weather conditions for roofing work">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex-1 max-w-sm">
            <SearchInput
              placeholder="Search by location..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          {canManage && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Log Weather
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !filteredLogs?.length ? (
          <WeatherEmptyState onAdd={() => setFormOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLogs.map((log) => (
              <WeatherCard key={log.id} log={log} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      <WeatherLogForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreate}
        isLoading={createMutation.isPending}
      />
    </PageLayout>
  );
}
