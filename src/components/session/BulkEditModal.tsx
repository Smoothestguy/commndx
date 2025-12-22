import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES } from "./devActivityUtils";
import { DevActivityInput } from "@/hooks/useDevActivities";

interface BulkEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  projectNames: string[];
  onApply: (updates: Partial<DevActivityInput>) => void;
  isLoading?: boolean;
}

export function BulkEditModal({
  open,
  onOpenChange,
  selectedCount,
  projectNames,
  onApply,
  isLoading,
}: BulkEditModalProps) {
  const [applyType, setApplyType] = useState(false);
  const [applyProject, setApplyProject] = useState(false);
  const [applyDate, setApplyDate] = useState(false);
  const [applyTechnologies, setApplyTechnologies] = useState(false);

  const [activityType, setActivityType] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("");
  const [activityDate, setActivityDate] = useState<Date | undefined>(undefined);
  const [technologies, setTechnologies] = useState<string>("");

  const handleApply = () => {
    const updates: Partial<DevActivityInput> = {};

    if (applyType && activityType) {
      updates.activity_type = activityType;
    }
    if (applyProject) {
      updates.project_name = projectName === "__none__" ? undefined : projectName;
    }
    if (applyDate && activityDate) {
      updates.activity_date = format(activityDate, "yyyy-MM-dd");
    }
    if (applyTechnologies) {
      updates.technologies = technologies
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    onApply(updates);
  };

  const hasChanges = applyType || applyProject || applyDate || applyTechnologies;

  const resetForm = () => {
    setApplyType(false);
    setApplyProject(false);
    setApplyDate(false);
    setApplyTechnologies(false);
    setActivityType("");
    setProjectName("");
    setActivityDate(undefined);
    setTechnologies("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) resetForm();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bulk Edit {selectedCount} Activities</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Check the fields you want to update. Only checked fields will be applied to all
            selected activities.
          </p>

          {/* Activity Type */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="apply-type"
              checked={applyType}
              onCheckedChange={(checked) => setApplyType(!!checked)}
              className="mt-2"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="apply-type" className="cursor-pointer">
                Activity Type
              </Label>
              <Select
                value={activityType}
                onValueChange={setActivityType}
                disabled={!applyType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
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
          </div>

          {/* Project Name */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="apply-project"
              checked={applyProject}
              onCheckedChange={(checked) => setApplyProject(!!checked)}
              className="mt-2"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="apply-project" className="cursor-pointer">
                Project Name
              </Label>
              <Select
                value={projectName}
                onValueChange={setProjectName}
                disabled={!applyProject}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or clear project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No project</SelectItem>
                  {projectNames.map((project) => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Activity Date */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="apply-date"
              checked={applyDate}
              onCheckedChange={(checked) => setApplyDate(!!checked)}
              className="mt-2"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="apply-date" className="cursor-pointer">
                Activity Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !activityDate && "text-muted-foreground"
                    )}
                    disabled={!applyDate}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {activityDate ? format(activityDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={activityDate}
                    onSelect={setActivityDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Technologies */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="apply-tech"
              checked={applyTechnologies}
              onCheckedChange={(checked) => setApplyTechnologies(!!checked)}
              className="mt-2"
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="apply-tech" className="cursor-pointer">
                Technologies (comma-separated)
              </Label>
              <Input
                placeholder="React, TypeScript, Supabase"
                value={technologies}
                onChange={(e) => setTechnologies(e.target.value)}
                disabled={!applyTechnologies}
              />
              <p className="text-xs text-muted-foreground">
                This will replace existing technologies
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasChanges || isLoading}>
            {isLoading ? "Applying..." : `Apply to ${selectedCount} Activities`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
