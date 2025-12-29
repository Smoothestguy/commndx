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
    <div className="flex items-center gap-1 sm:gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
        className="h-9 w-9 sm:h-10 sm:w-auto sm:px-3"
      >
        <ChevronLeft className="h-4 w-4" />
        {showLabels && <span className="hidden sm:inline ml-1">Previous</span>}
      </Button>
      
      <div className="text-xs sm:text-sm font-medium min-w-[120px] sm:min-w-[160px] text-center px-1 sm:px-2">
        {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
        className="h-9 w-9 sm:h-10 sm:w-auto sm:px-3"
      >
        {showLabels && <span className="hidden sm:inline mr-1">Next</span>}
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 sm:h-10 text-xs sm:text-sm px-2 sm:px-3"
        onClick={() => onWeekChange(new Date())}
      >
        Today
      </Button>
    </div>
  );
}
