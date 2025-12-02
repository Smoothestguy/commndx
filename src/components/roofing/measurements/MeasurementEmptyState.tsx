import { Ruler, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeasurementEmptyStateProps {
  onAdd: () => void;
}

export function MeasurementEmptyState({ onAdd }: MeasurementEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <Ruler className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Measurements Yet</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        Start recording roof measurements for your projects.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Add Measurement
      </Button>
    </div>
  );
}
