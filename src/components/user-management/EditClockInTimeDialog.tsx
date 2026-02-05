import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, MapPin, Clock } from "lucide-react";
import { format, parseISO, isBefore, isAfter, startOfDay, endOfDay } from "date-fns";
import type { TimeEntryForAdmin } from "@/integrations/supabase/hooks/useAdminClockEdit";

interface EditClockInTimeDialogProps {
  entry: TimeEntryForAdmin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entryId: string, newClockInAt: string) => Promise<void>;
  isSaving: boolean;
}

export function EditClockInTimeDialog({
  entry,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: EditClockInTimeDialogProps) {
  const [newDateTime, setNewDateTime] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Reset state when dialog opens with new entry
  useMemo(() => {
    if (entry?.clock_in_at && open) {
      const clockInDate = parseISO(entry.clock_in_at);
      // Format for datetime-local input (YYYY-MM-DDTHH:mm)
      setNewDateTime(format(clockInDate, "yyyy-MM-dd'T'HH:mm"));
      setConfirmed(false);
    }
  }, [entry?.id, open]);

  const validation = useMemo(() => {
    if (!entry || !newDateTime) return { valid: false, warnings: [] };

    const warnings: string[] = [];
    const newTime = new Date(newDateTime);
    const now = new Date();

    // Check if in the future
    if (isAfter(newTime, now)) {
      warnings.push("New clock-in time cannot be in the future");
      return { valid: false, warnings };
    }

    // Check if after clock-out (if clocked out)
    if (entry.clock_out_at) {
      const clockOut = parseISO(entry.clock_out_at);
      if (isAfter(newTime, clockOut)) {
        warnings.push("New clock-in time cannot be after clock-out time");
        return { valid: false, warnings };
      }
    }

    // Check if on same day
    const entryDate = parseISO(entry.entry_date);
    const dayStart = startOfDay(entryDate);
    const dayEnd = endOfDay(entryDate);
    if (isBefore(newTime, dayStart) || isAfter(newTime, dayEnd)) {
      warnings.push("Clock-in time should be on the same day as the entry");
    }

    // Calculate new hours for informational warning
    if (entry.clock_out_at) {
      const clockOut = parseISO(entry.clock_out_at);
      const totalMs = clockOut.getTime() - newTime.getTime();
      const lunchMs = (entry.lunch_duration_minutes || 0) * 60 * 1000;
      const workMs = totalMs - lunchMs;
      const newHours = Math.max(0, workMs / (1000 * 60 * 60));
      const oldHours = entry.hours || 0;
      
      if (Math.abs(newHours - oldHours) > 0.01) {
        const hoursDiff = newHours - oldHours;
        warnings.push(
          `This will change total hours from ${oldHours.toFixed(2)}h to ${newHours.toFixed(2)}h (${hoursDiff > 0 ? '+' : ''}${hoursDiff.toFixed(2)}h)`
        );
      }
    }

    return { valid: true, warnings };
  }, [entry, newDateTime]);

  const handleSave = async () => {
    if (!entry || !newDateTime || !validation.valid || !confirmed) return;
    
    // Convert local datetime to ISO string
    const newClockInAt = new Date(newDateTime).toISOString();
    await onSave(entry.id, newClockInAt);
  };

  if (!entry) return null;

  const personnelName = entry.personnel
    ? `${entry.personnel.first_name} ${entry.personnel.last_name}`
    : "Unknown";
  const projectName = entry.project?.name || "Unknown Project";
  const entryDateFormatted = format(parseISO(entry.entry_date), "MMMM d, yyyy");
  const currentClockIn = entry.clock_in_at
    ? format(parseISO(entry.clock_in_at), "h:mm:ss a")
    : "N/A";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Edit Clock-In Time
          </DialogTitle>
          <DialogDescription>
            Adjust the clock-in time for this time entry. This change will be logged in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entry Details */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Personnel:</span>
              <span className="font-medium">{personnelName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Project:</span>
              <span className="font-medium">{projectName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium">{entryDateFormatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Clock-In:</span>
              <span className="font-medium">{currentClockIn}</span>
            </div>
            {entry.clock_out_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Clock-Out:</span>
                <span className="font-medium">
                  {format(parseISO(entry.clock_out_at), "h:mm:ss a")}
                </span>
              </div>
            )}
            {!entry.clock_out_at && (
              <div className="flex justify-between text-amber-600">
                <span>Status:</span>
                <span className="font-medium">Currently Active</span>
              </div>
            )}
          </div>

          {/* Location Info */}
          {(entry.clock_in_lat || entry.clock_in_lng) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>
                Original location preserved ({entry.clock_in_lat?.toFixed(4)}, {entry.clock_in_lng?.toFixed(4)})
              </span>
            </div>
          )}

          {/* New Time Input */}
          <div className="space-y-2">
            <Label htmlFor="new-clock-in">New Clock-In Time</Label>
            <Input
              id="new-clock-in"
              type="datetime-local"
              value={newDateTime}
              onChange={(e) => setNewDateTime(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Validation Warnings */}
          {validation.warnings.length > 0 && (
            <div className="space-y-2">
              {validation.warnings.map((warning, idx) => (
                <Alert
                  key={idx}
                  variant={validation.valid ? "default" : "destructive"}
                  className="py-2"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm ml-2">
                    {warning}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Confirmation Checkbox */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="confirm-change"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              disabled={!validation.valid}
            />
            <Label
              htmlFor="confirm-change"
              className="text-sm font-normal cursor-pointer"
            >
              I confirm this change is accurate and necessary
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!validation.valid || !confirmed || isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
