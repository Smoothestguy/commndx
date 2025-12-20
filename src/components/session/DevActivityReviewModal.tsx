import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Check, X, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
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

export function DevActivityReviewModal({
  open,
  onOpenChange,
  activities: initialActivities,
  onComplete,
}: DevActivityReviewModalProps) {
  const [activities, setActivities] = useState<(ExtractedActivity & { selected: boolean; expanded: boolean })[]>([]);
  const { createActivities, projectNames } = useDevActivities();

  // Sync initialActivities prop to internal state when it changes
  useEffect(() => {
    setActivities(
      initialActivities.map((a) => ({ ...a, selected: true, expanded: false }))
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

  const handleSave = async () => {
    const selectedActivities = activities.filter((a) => a.selected);
    if (selectedActivities.length === 0) {
      onOpenChange(false);
      return;
    }

    const inputs: DevActivityInput[] = selectedActivities.map((a) => ({
      activity_type: a.activity_type,
      title: a.title,
      description: a.description || undefined,
      duration_minutes: a.duration_minutes || undefined,
      activity_date: a.activity_date,
      project_name: a.project_name || undefined,
      technologies: a.technologies,
      extraction_confidence: a.confidence,
    }));

    await createActivities.mutateAsync(inputs);
    onComplete();
    onOpenChange(false);
  };

  const selectedCount = activities.filter((a) => a.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review Extracted Activities
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const config = getActivityTypeConfig(activity.activity_type);
              const Icon = config.icon;

              return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 transition-colors ${
                    activity.selected ? "bg-card" : "bg-muted/30 opacity-60"
                  }`}
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
                          {format(new Date(activity.activity_date), "MMM d, yyyy")}
                        </span>
                      </div>

                      <Input
                        value={activity.title}
                        onChange={(e) => updateActivity(index, { title: e.target.value })}
                        className="mt-2 font-medium"
                        placeholder="Activity title"
                      />

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
                              <Label className="text-xs">Duration (minutes)</Label>
                              <Input
                                type="number"
                                value={activity.duration_minutes || ""}
                                onChange={(e) =>
                                  updateActivity(index, {
                                    duration_minutes: e.target.value ? parseInt(e.target.value) : null,
                                  })
                                }
                                className="mt-1"
                                placeholder="e.g., 60"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Date</Label>
                              <Input
                                type="date"
                                value={activity.activity_date}
                                onChange={(e) => updateActivity(index, { activity_date: e.target.value })}
                                className="mt-1"
                              />
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
            disabled={selectedCount === 0 || createActivities.isPending}
          >
            <Check className="h-4 w-4 mr-2" />
            Save {selectedCount} {selectedCount === 1 ? "Activity" : "Activities"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
