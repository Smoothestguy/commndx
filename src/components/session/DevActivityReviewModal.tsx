import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Check, X, ChevronDown, ChevronUp, Sparkles, AlertTriangle, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDevActivities, DevActivityInput } from "@/hooks/useDevActivities";
import { getActivityTypeConfig, ACTIVITY_TYPES } from "./devActivityUtils";

interface ExtractedActivity {
  title: string;
  description: string;
  activity_type: string;
  duration_minutes: number | null;
  activity_date: string;
  activity_time: string | null;
  project_name: string | null;
  technologies: string[];
  confidence: string;
}

interface DevActivityReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: ExtractedActivity[];
  onComplete: () => void;
}

// Default duration suggestions based on activity type
const DEFAULT_DURATIONS: Record<string, number> = {
  git_commit: 15,
  deployment: 30,
  database_migration: 45,
  schema_change: 30,
  feature_development: 60,
  bug_fix: 30,
  code_review: 20,
  configuration: 15,
  testing: 45,
  documentation: 30,
  other: 30,
};

// Format 24-hour time to 12-hour format
const formatTime12Hour = (time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

export function DevActivityReviewModal({
  open,
  onOpenChange,
  activities: initialActivities,
  onComplete,
}: DevActivityReviewModalProps) {
  const [activities, setActivities] = useState<(ExtractedActivity & { selected: boolean; expanded: boolean })[]>([]);
  const { createActivities, projectNames } = useDevActivities();

  // Sync initialActivities prop to internal state when it changes
  // Also apply default durations for activities without duration
  useEffect(() => {
    setActivities(
      initialActivities.map((a) => ({
        ...a,
        // Apply default duration if null
        duration_minutes: a.duration_minutes ?? DEFAULT_DURATIONS[a.activity_type] ?? 30,
        selected: true,
        expanded: false,
      }))
    );
  }, [initialActivities]);

  const updateActivity = (index: number, updates: Partial<ExtractedActivity>) => {
    setActivities((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...updates } : a))
    );
  };

  const toggleSelected = (index: number) => {
    setActivities((prev) =>
      prev.map((a, i) => (i === index ? { ...a, selected: !a.selected } : a))
    );
  };

  const toggleExpanded = (index: number) => {
    setActivities((prev) =>
      prev.map((a, i) => (i === index ? { ...a, expanded: !a.expanded } : a))
    );
  };

  const setAllDurations = (minutes: number) => {
    setActivities((prev) =>
      prev.map((a) => (a.selected ? { ...a, duration_minutes: minutes } : a))
    );
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <span className="text-green-500">🟢</span>;
      case "medium":
        return <span className="text-yellow-500">🟡</span>;
      case "low":
        return <span className="text-red-500">🔴</span>;
      default:
        return null;
    }
  };

  // Count selected activities missing duration
  const selectedActivities = activities.filter((a) => a.selected);
  const missingDurationCount = selectedActivities.filter(
    (a) => !a.duration_minutes || a.duration_minutes <= 0
  ).length;
  const canSave = selectedActivities.length > 0 && missingDurationCount === 0;

  const handleSave = async () => {
    if (!canSave) return;

    const inputs: DevActivityInput[] = selectedActivities.map((a) => ({
      activity_type: a.activity_type,
      title: a.title,
      description: a.description || undefined,
      duration_minutes: a.duration_minutes!, // We validated it's not null
      activity_date: a.activity_date,
      activity_time: a.activity_time || undefined,
      project_name: a.project_name || undefined,
      technologies: a.technologies,
      extraction_confidence: a.confidence,
    }));

    await createActivities.mutateAsync(inputs);
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review Extracted Activities
          </DialogTitle>
        </DialogHeader>

        {/* Duration warning and quick set buttons */}
        {selectedActivities.length > 0 && (
          <div className="space-y-3">
            {missingDurationCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-md">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {missingDurationCount} {missingDurationCount === 1 ? "activity needs" : "activities need"} duration
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Set all to:
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAllDurations(15)}
              >
                15m
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAllDurations(30)}
              >
                30m
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAllDurations(60)}
              >
                1h
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAllDurations(120)}
              >
                2h
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const config = getActivityTypeConfig(activity.activity_type);
              const Icon = config.icon;
              const hasDuration = activity.duration_minutes && activity.duration_minutes > 0;

              return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 transition-colors ${
                    activity.selected ? "bg-card" : "bg-muted/30 opacity-60"
                  } ${activity.selected && !hasDuration ? "border-amber-400 dark:border-amber-600" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={activity.selected}
                      onCheckedChange={() => toggleSelected(index)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={config.className}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        {getConfidenceBadge(activity.confidence)}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(activity.activity_date + "T00:00:00"), "MMM d, yyyy")}
                          {activity.activity_time && ` at ${formatTime12Hour(activity.activity_time)}`}
                        </span>
                        {activity.selected && !hasDuration && (
                          <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Needs duration
                          </Badge>
                        )}
                      </div>

                      <Input
                        value={activity.title}
                        onChange={(e) => updateActivity(index, { title: e.target.value })}
                        className="mt-2 font-medium"
                        placeholder="Activity title"
                      />

                      {/* Always show duration input for convenience */}
                      <div className="mt-2 flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Duration:</Label>
                        <Input
                          type="number"
                          value={activity.duration_minutes || ""}
                          onChange={(e) =>
                            updateActivity(index, {
                              duration_minutes: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          className={`w-24 h-8 text-sm ${!hasDuration && activity.selected ? "border-amber-400 focus:ring-amber-400" : ""}`}
                          placeholder="min"
                          min={1}
                        />
                        <span className="text-xs text-muted-foreground">minutes</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => toggleExpanded(index)}
                      >
                        {activity.expanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Less details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            More details
                          </>
                        )}
                      </Button>

                      {activity.expanded && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <Label className="text-xs">Description</Label>
                            <Textarea
                              value={activity.description || ""}
                              onChange={(e) => updateActivity(index, { description: e.target.value })}
                              className="mt-1"
                              rows={3}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Activity Type</Label>
                              <Select
                                value={activity.activity_type}
                                onValueChange={(value) => updateActivity(index, { activity_type: value })}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ACTIVITY_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label className="text-xs">Date</Label>
                              <Input
                                type="date"
                                value={activity.activity_date}
                                onChange={(e) => updateActivity(index, { activity_date: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">Project</Label>
                            <Input
                              value={activity.project_name || ""}
                              onChange={(e) => updateActivity(index, { project_name: e.target.value })}
                              className="mt-1"
                              placeholder="Project name"
                              list={`project-names-${index}`}
                            />
                            <datalist id={`project-names-${index}`}>
                              {projectNames.map((name) => (
                                <option key={name} value={name} />
                              ))}
                            </datalist>
                          </div>

                          <div>
                            <Label className="text-xs">Technologies (comma-separated)</Label>
                            <Input
                              value={activity.technologies.join(", ")}
                              onChange={(e) =>
                                updateActivity(index, {
                                  technologies: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                                })
                              }
                              className="mt-1"
                              placeholder="React, TypeScript, Supabase"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || createActivities.isPending}
            title={!canSave && missingDurationCount > 0 ? "Please add duration to all selected activities" : undefined}
          >
            <Check className="h-4 w-4 mr-2" />
            Save {selectedActivities.length} {selectedActivities.length === 1 ? "Activity" : "Activities"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
