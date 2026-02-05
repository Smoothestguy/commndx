import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useSessionEdit } from "@/hooks/useSessionEdit";
import { formatDuration } from "@/utils/sessionTime";

interface AddSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string | null;
  targetUserEmail?: string;
  userName?: string;
}

export function AddSessionDialog({
  open,
  onOpenChange,
  targetUserId,
  targetUserEmail,
  userName,
}: AddSessionDialogProps) {
  const { createSession, isCreating } = useSessionEdit();
  const [sessionDate, setSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [markActive, setMarkActive] = useState(false);

  if (!targetUserId || !targetUserEmail) return null;

  const now = new Date();
  
  // Combine date and time
  const startDateTime = new Date(`${sessionDate}T${startTime}`);
  const endDateTime = new Date(`${sessionDate}T${endTime}`);

  // Validation
  const startInFuture = startDateTime > now;
  const endInFuture = !markActive && endDateTime > now;
  const endBeforeStart = !markActive && endDateTime < startDateTime;
  const hasValidationError = startInFuture || endInFuture || endBeforeStart;

  // Calculate duration
  const calculateSeconds = () => {
    if (markActive) {
      return Math.floor((now.getTime() - startDateTime.getTime()) / 1000);
    }
    return Math.floor((endDateTime.getTime() - startDateTime.getTime()) / 1000);
  };

  const estimatedSeconds = Math.max(0, calculateSeconds());

  const handleSave = () => {
    if (!targetUserId || !targetUserEmail || hasValidationError) return;

    const sessionStart = startDateTime.toISOString();
    const sessionEnd = markActive ? null : endDateTime.toISOString();

    createSession(
      {
        userId: targetUserId,
        userEmail: targetUserEmail,
        sessionStart,
        sessionEnd,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          // Reset form
          setSessionDate(format(new Date(), "yyyy-MM-dd"));
          setStartTime("09:00");
          setEndTime("17:00");
          setMarkActive(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Session</DialogTitle>
          <DialogDescription>
            Manually add a work session{userName ? ` for ${userName}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="session-date">Date *</Label>
            <input
              id="session-date"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-time">Start Time *</Label>
            <input
              id="start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {startInFuture && (
              <p className="text-xs text-destructive">Start time cannot be in the future</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-time">End Time</Label>
            <input
              id="end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={markActive}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {endInFuture && (
              <p className="text-xs text-destructive">End time cannot be in the future</p>
            )}
            {endBeforeStart && (
              <p className="text-xs text-destructive">End time cannot be before start time</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="mark-active"
              checked={markActive}
              onCheckedChange={(checked) => setMarkActive(checked as boolean)}
            />
            <Label htmlFor="mark-active" className="text-sm font-normal">
              Mark as Active Session (no end time)
            </Label>
          </div>

          {!hasValidationError && estimatedSeconds > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will create a session of approximately {formatDuration(estimatedSeconds)}
                {markActive ? " (and counting)" : ""}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={hasValidationError || isCreating}
          >
            {isCreating ? "Adding..." : "Add Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
