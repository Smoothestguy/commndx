import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, LockOpen, Loader2 } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { useWeekCloseout, useReopenWeek } from "@/integrations/supabase/hooks/useWeekCloseouts";
import { useUserRole } from "@/hooks/useUserRole";
import { WeekCloseoutDialog } from "./WeekCloseoutDialog";

interface WeekCloseoutControlsProps {
  projectId: string | undefined;
  customerId: string | undefined;
  currentWeek: Date;
  onCloseoutComplete?: () => void;
}

export function WeekCloseoutControls({ projectId, customerId, currentWeek, onCloseoutComplete }: WeekCloseoutControlsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { isAdmin } = useUserRole();
  
  const { data: closeout, isLoading } = useWeekCloseout(projectId, currentWeek);
  const reopenWeek = useReopenWeek();
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekLabel = format(weekStart, 'MMM d');
  
  const handleReopen = () => {
    if (closeout) {
      reopenWeek.mutate(closeout.id);
    }
  };
  
  if (!projectId) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Lock className="h-4 w-4" />
        <span>Select a project to manage week closeout</span>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }
  
  const isClosed = closeout?.status === 'closed';
  
  return (
    <div className="flex items-center gap-3">
      {isClosed ? (
        <>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Week Closed
          </Badge>
          {closeout?.closed_at && (
            <span className="text-sm text-muted-foreground">
              Closed {format(new Date(closeout.closed_at), 'MMM d, h:mm a')}
            </span>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReopen}
              disabled={reopenWeek.isPending}
            >
              {reopenWeek.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LockOpen className="h-4 w-4 mr-2" />
              )}
              Reopen Week
            </Button>
          )}
        </>
      ) : (
        <>
          <Badge variant="outline" className="flex items-center gap-1">
            <LockOpen className="h-3 w-3" />
            Week Open
          </Badge>
          <Button
            variant="default"
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={!customerId}
          >
            <Lock className="h-4 w-4 mr-2" />
            Close Week of {weekLabel}
          </Button>
        </>
      )}
      
      {projectId && customerId && (
        <WeekCloseoutDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          projectId={projectId}
          customerId={customerId}
          currentWeek={currentWeek}
          onSuccess={onCloseoutComplete}
        />
      )}
    </div>
  );
}
