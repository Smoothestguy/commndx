import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppointmentEmptyStateProps {
  onAdd: () => void;
}

export function AppointmentEmptyState({ onAdd }: AppointmentEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Calendar className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No appointments scheduled</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        Schedule your first appointment to start managing your calendar.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        New Appointment
      </Button>
    </div>
  );
}
