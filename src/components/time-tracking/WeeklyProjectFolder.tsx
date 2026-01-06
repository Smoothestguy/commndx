import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Save, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeDecimalInput } from "@/components/ui/time-decimal-input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
}

interface ProjectHours {
  [dateKey: string]: number;
}

interface WeeklyProjectFolderProps {
  project: Project;
  weekDays: Date[];
  existingHours: ProjectHours;
  onSave: (projectId: string, hours: ProjectHours) => Promise<void>;
  isWeekClosed?: boolean;
  defaultExpanded?: boolean;
}

export function WeeklyProjectFolder({
  project,
  weekDays,
  existingHours,
  onSave,
  isWeekClosed = false,
  defaultExpanded = false,
}: WeeklyProjectFolderProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [localHours, setLocalHours] = useState<ProjectHours>(existingHours);
  const [isSaving, setIsSaving] = useState(false);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return weekDays.some((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const existing = existingHours[dateKey] || 0;
      const local = localHours[dateKey] || 0;
      return existing !== local;
    });
  }, [weekDays, existingHours, localHours]);

  // Calculate total hours
  const totalHours = useMemo(() => {
    return weekDays.reduce((sum, day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      return sum + (localHours[dateKey] || 0);
    }, 0);
  }, [weekDays, localHours]);

  const handleHourChange = (dateKey: string, value: number) => {
    setLocalHours((prev) => ({
      ...prev,
      [dateKey]: value,
    }));
  };

  const handleSave = async () => {
    if (isWeekClosed) {
      toast.error("This week is closed. Cannot save entries.");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(project.id, localHours);
      toast.success(`Saved time entries for ${project.name}`);
    } catch (error) {
      console.error("Error saving time entries:", error);
      toast.error("Failed to save time entries");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLocalHours(existingHours);
  };

  return (
    <div className="border-b last:border-b-0">
      {/* Folder Header (Collapsed View) */}
      <div
        className={cn(
          "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors",
          isExpanded && "bg-muted/30"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Folder Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <FolderOpen className="h-5 w-5 text-primary" />
          ) : (
            <Folder className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Project Name */}
        <div className="flex-1 min-w-0">
          <span className="font-medium truncate">{project.name}</span>
        </div>

        {/* Total Hours Badge */}
        <div className="flex-shrink-0">
          <span
            className={cn(
              "text-sm font-semibold px-2 py-0.5 rounded",
              totalHours > 0
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground"
            )}
          >
            {totalHours.toFixed(1)}h
          </span>
        </div>

        {/* Unsaved indicator */}
        {hasChanges && (
          <div className="flex-shrink-0">
            <span className="text-xs text-amber-600 font-medium">Unsaved</span>
          </div>
        )}
      </div>

      {/* Expanded Content - Day Inputs */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2 bg-muted/20">
          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2 mb-3">
            {weekDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const isToday = format(new Date(), "yyyy-MM-dd") === dateKey;

              return (
                <div key={dateKey} className="text-center">
                  {/* Day Header */}
                  <div
                    className={cn(
                      "text-xs font-medium mb-1",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={cn(
                      "text-xs mb-2",
                      isToday ? "text-primary font-medium" : "text-muted-foreground"
                    )}
                  >
                    {format(day, "M/d")}
                  </div>
                  {/* Hour Input */}
                  <TimeDecimalInput
                    value={localHours[dateKey] || 0}
                    onValueChange={(val) => handleHourChange(dateKey, val)}
                    showPreview={false}
                    compact
                    className="w-full"
                    disabled={isWeekClosed}
                  />
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            {hasChanges && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              disabled={isSaving || !hasChanges || isWeekClosed}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
