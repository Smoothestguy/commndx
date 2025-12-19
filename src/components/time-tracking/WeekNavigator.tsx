import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from "date-fns";

interface WeekNavigatorProps {
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  showLabels?: boolean;
}

export function WeekNavigator({ currentWeek, onWeekChange, showLabels = true }: WeekNavigatorProps) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size={showLabels ? "sm" : "icon"}
        onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
        className="gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        {showLabels && <span className="hidden sm:inline">Previous Week</span>}
      </Button>
      
      <div className="text-sm font-medium min-w-[160px] text-center px-2">
        {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
      </div>

      <Button
        type="button"
        variant="outline"
        size={showLabels ? "sm" : "icon"}
        onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
        className="gap-1"
      >
        {showLabels && <span className="hidden sm:inline">Next Week</span>}
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onWeekChange(new Date())}
      >
        Today
      </Button>
    </div>
  );
}
