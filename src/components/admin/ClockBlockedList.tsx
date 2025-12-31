import { format } from "date-fns";
import { AlertTriangle, Check, Clock, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useBlockedTimeEntries, useClearClockBlock } from "@/integrations/supabase/hooks/useClockAlerts";

export function ClockBlockedList() {
  const { data: blockedEntries = [], isLoading } = useBlockedTimeEntries();
  const clearBlock = useClearClockBlock();

  const handleClearBlock = async (timeEntryId: string) => {
    try {
      await clearBlock.mutateAsync({ timeEntryId });
    } catch (error) {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading blocked entries...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Blocked Clock-Ins
        </CardTitle>
        <CardDescription>
          Personnel who were auto-clocked-out and need admin approval to clock back in
        </CardDescription>
      </CardHeader>
      <CardContent>
        {blockedEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Check className="h-12 w-12 mx-auto mb-2 opacity-50 text-green-500" />
            <p>No blocked clock-ins</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personnel</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Blocked At</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {entry.personnel?.first_name} {entry.personnel?.last_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {entry.project?.name || "Unknown Project"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {entry.clock_out_at
                        ? format(new Date(entry.clock_out_at), "MMM d, h:mm a")
                        : "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive" className="text-xs">
                      {entry.auto_clock_out_reason || "Left job site"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.clock_blocked_until ? (
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(entry.clock_blocked_until), "MMM d, h:mm a")}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClearBlock(entry.id)}
                      disabled={clearBlock.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
