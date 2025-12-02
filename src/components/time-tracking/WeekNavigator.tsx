import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from "date-fns";

interface WeekNavigatorProps {
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
}

export function WeekNavigator({ currentWeek, onWeekChange }: WeekNavigatorProps) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  return (
    <div className="flex items-center gap-4">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="text-sm font-medium min-w-[200px] text-center">
        {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onWeekChange(new Date())}
      >
        Today
      </Button>
    </div>
  );
}
