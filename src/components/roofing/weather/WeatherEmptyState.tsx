import { Cloud, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeatherEmptyStateProps {
  onAdd: () => void;
}

export function WeatherEmptyState({ onAdd }: WeatherEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <Cloud className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Weather Logs Yet</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        Track weather conditions to plan roofing work effectively.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Log Weather
      </Button>
    </div>
  );
}
