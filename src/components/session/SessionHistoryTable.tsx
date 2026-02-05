import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Eye, Clock, DollarSign, RefreshCw, Pencil, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { EditSessionTimeDialog } from "./EditSessionTimeDialog";
import { AddSessionDialog } from "./AddSessionDialog";



interface SessionHistoryTableProps {
  dateRange?: DateRange;
  onSelectSession: (sessionId: string | null) => void;
  selectedSessionId: string | null;
  targetUserId?: string | null;
  targetUserEmail?: string;
  isAdmin?: boolean;
}

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

const STORAGE_KEY = "session_tracking_state";

export function SessionHistoryTable({
  dateRange,
  onSelectSession,
  selectedSessionId,
  targetUserId,
  targetUserEmail,
  isAdmin = false,
}: SessionHistoryTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const userId = targetUserId || user?.id;
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Fetch hourly rate for the user
  const { data: hourlyRate = 0 } = useQuery({
    queryKey: ["personnel-rate", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { data } = await supabase
        .from("personnel")
        .select("hourly_rate")
        .eq("user_id", userId)
        .maybeSingle();
      return data?.hourly_rate ? Number(data.hourly_rate) : 0;
    },
    enabled: !!userId,
  });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["session-history", userId, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from("user_work_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("session_start", { ascending: false });

      if (dateRange?.from) {
        query = query.gte("session_start", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("session_start", dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Session[];
    },
    enabled: !!userId,
  });

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Calculate active time from timestamps (not stored value) for accuracy
  const getActiveSecondsFromTimestamps = (session: Session): number => {
    const start = new Date(session.session_start).getTime();
    const end = session.session_end 
      ? new Date(session.session_end).getTime() 
      : Date.now();
    const totalSeconds = Math.floor((end - start) / 1000);
    const idleSeconds = session.total_idle_seconds || 0;
    return Math.max(0, totalSeconds - idleSeconds);
  };

  const calculateEarnings = (seconds: number): number => {
    return (seconds / 3600) * hourlyRate;
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  const handleRecalculateIdle = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecalculatingId(sessionId);
    
    try {
      const { data, error } = await supabase.functions.invoke('fix-session-idle', {
        body: { sessionId, mode: 'recalc' }
      });
      
      if (error) {
        console.error('Error recalculating idle:', error);
        toast({
          title: "Failed to recalculate",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      // Clear localStorage if this is the current user's active session
      // This prevents the frontend from overwriting the correction
      const storedState = localStorage.getItem(STORAGE_KEY);
      if (storedState) {
        try {
          const parsed = JSON.parse(storedState);
          if (parsed.sessionId === sessionId) {
            localStorage.removeItem(STORAGE_KEY);
            console.log('Cleared localStorage to prevent overwrite');
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['session-history'] });
      queryClient.invalidateQueries({ queryKey: ['session-stats'] });
      queryClient.invalidateQueries({ queryKey: ['today-sessions'] });
      
      toast({
        title: "Idle time recalculated",
        description: `Corrected: ${formatDuration(data.previousIdleSeconds)} → ${formatDuration(data.newIdleSeconds)}`,
      });
    } catch (err) {
      console.error('Error:', err);
      toast({
        title: "Error",
        description: "Failed to recalculate idle time",
        variant: "destructive",
      });
    } finally {
      setRecalculatingId(null);
    }
  };

  const exportToCSV = () => {
    if (!sessions || sessions.length === 0) {
      toast({
        title: "No data to export",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ["Date", "Start Time", "End Time", "Active Time", "Idle Time", "Earnings", "Type"].join(","),
      ...sessions.map((s) => {
        const activeSeconds = getActiveSecondsFromTimestamps(s);
        return [
          format(new Date(s.session_start), "yyyy-MM-dd"),
          format(new Date(s.session_start), "HH:mm:ss"),
          s.session_end ? format(new Date(s.session_end), "HH:mm:ss") : "Active",
          formatDuration(activeSeconds),
          formatDuration(s.total_idle_seconds || 0),
          formatCurrency(calculateEarnings(activeSeconds)),
          s.clock_in_type,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: "Session history has been downloaded",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mobile Card View Component
  const MobileSessionCard = ({ session }: { session: Session }) => {
    const activeSeconds = getActiveSecondsFromTimestamps(session);
    const isSelected = selectedSessionId === session.id;
    
    return (
      <div 
        className={`border rounded-lg p-4 space-y-3 ${isSelected ? 'ring-2 ring-primary bg-muted/50' : 'bg-card'}`}
        onClick={() => onSelectSession(isSelected ? null : session.id)}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">
              {format(new Date(session.session_start), "MMM d, yyyy")}
            </p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(session.session_start), "h:mm a")} - {session.session_end ? format(new Date(session.session_end), "h:mm a") : "Now"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {session.is_active && (
              <Badge variant="default" className="bg-green-500 text-xs">Active</Badge>
            )}
            <Badge variant="outline" className="text-xs">{session.clock_in_type}</Badge>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-mono">{formatDuration(activeSeconds)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-green-500" />
              <span className="text-sm font-mono text-green-600 dark:text-green-400 font-medium">
                {formatCurrency(calculateEarnings(activeSeconds))}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg">Session History</CardTitle>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)} className="h-8 text-xs sm:text-sm">
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
              <span className="hidden sm:inline">Add Session</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportToCSV} className="h-8 text-xs sm:text-sm">
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {sessions && sessions.length > 0 ? (
          isMobile ? (
            <div className="space-y-3">
              {sessions.map((session) => (
                <MobileSessionCard key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Active Time</TableHead>
                  <TableHead>Idle Time</TableHead>
                  <TableHead>Earnings</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const activeSeconds = getActiveSecondsFromTimestamps(session);
                  return (
                    <TableRow
                      key={session.id}
                      className={
                        selectedSessionId === session.id ? "bg-muted/50" : ""
                      }
                    >
                      <TableCell>
                        {format(new Date(session.session_start), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {format(new Date(session.session_start), "h:mm a")}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSession(session);
                              }}
                              title="Edit session times"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {session.session_end ? (
                            format(new Date(session.session_end), "h:mm a")
                          ) : (
                            <Badge variant="default" className="bg-green-500">
                              Active
                            </Badge>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSession(session);
                              }}
                              title="Edit session times"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatDuration(activeSeconds)}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {formatDuration(session.total_idle_seconds || 0)}
                      </TableCell>
                      <TableCell className="font-mono text-green-600 dark:text-green-400 font-medium">
                        {formatCurrency(calculateEarnings(activeSeconds))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{session.clock_in_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleRecalculateIdle(session.id, e)}
                            disabled={recalculatingId === session.id}
                            title="Recalculate idle time from activity logs"
                          >
                            <RefreshCw className={`h-4 w-4 ${recalculatingId === session.id ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              onSelectSession(
                                selectedSessionId === session.id ? null : session.id
                              )
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No sessions found for the selected date range
          </div>
        )}
      </CardContent>

      {/* Edit Session Dialog */}
      <EditSessionTimeDialog
        open={!!editingSession}
        onOpenChange={(open) => !open && setEditingSession(null)}
        session={editingSession}
      />

      {/* Add Session Dialog */}
      <AddSessionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        targetUserId={userId || null}
        targetUserEmail={targetUserEmail}
      />
    </Card>
  );
}
