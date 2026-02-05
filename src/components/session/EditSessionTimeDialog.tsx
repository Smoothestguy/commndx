import { useState, useEffect } from "react";
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

interface Session {
  id: string;
  user_id: string;
  session_start: string;
  session_end: string | null;
  total_active_seconds: number;
  total_idle_seconds: number;
  is_active: boolean;
  clock_in_type: string;
}

interface EditSessionTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
}

export function EditSessionTimeDialog({
  open,
  onOpenChange,
  session,
}: EditSessionTimeDialogProps) {
  const { updateSession, isUpdating } = useSessionEdit();
  const [sessionStart, setSessionStart] = useState("");
  const [sessionEnd, setSessionEnd] = useState("");
  const [leaveActive, setLeaveActive] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (session) {
      // Format for datetime-local input
      const startDate = new Date(session.session_start);
      setSessionStart(format(startDate, "yyyy-MM-dd'T'HH:mm"));
      
      if (session.session_end) {
        const endDate = new Date(session.session_end);
        setSessionEnd(format(endDate, "yyyy-MM-dd'T'HH:mm"));
        setLeaveActive(false);
      } else {
        setSessionEnd("");
        setLeaveActive(true);
      }
      setConfirmed(false);
    }
  }, [session]);

  if (!session) return null;

  const now = new Date();
  const startDate = sessionStart ? new Date(sessionStart) : null;
  const endDate = sessionEnd && !leaveActive ? new Date(sessionEnd) : null;

  // Validation
  const startInFuture = startDate && startDate > now;
  const endInFuture = endDate && endDate > now;
  const endBeforeStart = startDate && endDate && endDate < startDate;
  const hasValidationError = startInFuture || endInFuture || endBeforeStart;

  // Calculate new duration
  const calculateNewSeconds = () => {
    if (!startDate) return 0;
    const end = endDate || now;
    const totalSeconds = Math.floor((end.getTime() - startDate.getTime()) / 1000);
    return Math.max(0, totalSeconds - (session.total_idle_seconds || 0));
  };

  const newActiveSeconds = calculateNewSeconds();
  const originalSeconds = session.total_active_seconds;
  const durationChanged = newActiveSeconds !== originalSeconds;

  const handleSave = () => {
    if (!session || hasValidationError || !confirmed) return;

    const newEnd = leaveActive ? null : new Date(sessionEnd).toISOString();

    updateSession({
      sessionId: session.id,
      sessionStart: new Date(sessionStart).toISOString(),
      sessionEnd: newEnd,
      originalSession: session,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Session Time</DialogTitle>
          <DialogDescription>
            Modify the start and end times for this session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            Date: {format(new Date(session.session_start), "MMMM d, yyyy")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-start">Session Start *</Label>
            <input
              id="session-start"
              type="datetime-local"
              value={sessionStart}
              onChange={(e) => setSessionStart(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {startInFuture && (
              <p className="text-xs text-destructive">Start time cannot be in the future</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-end">Session End</Label>
            <input
              id="session-end"
              type="datetime-local"
              value={sessionEnd}
              onChange={(e) => setSessionEnd(e.target.value)}
              disabled={leaveActive}
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
              id="leave-active"
              checked={leaveActive}
              onCheckedChange={(checked) => setLeaveActive(checked as boolean)}
            />
            <Label htmlFor="leave-active" className="text-sm font-normal">
              Leave as Active (no end time)
            </Label>
          </div>

          {durationChanged && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will change total time from {formatDuration(originalSeconds)} to{" "}
                {formatDuration(newActiveSeconds)}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="confirm-edit"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked as boolean)}
              disabled={hasValidationError}
            />
            <Label htmlFor="confirm-edit" className="text-sm font-normal">
              I confirm this change is accurate
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={hasValidationError || !confirmed || isUpdating}
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
