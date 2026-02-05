import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Clock, MapPin, Calendar } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  useAdminTimeEntries,
  useUpdateClockIn,
  usePersonnelList,
  type TimeEntryForAdmin,
} from "@/integrations/supabase/hooks/useAdminClockEdit";
import { EditClockInTimeDialog } from "./EditClockInTimeDialog";

const DATE_RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

export function TimeClockAdminTab() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Filters
  const [dateRange, setDateRange] = useState("7");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>("all");
  
  // Dialog state
  const [editingEntry, setEditingEntry] = useState<TimeEntryForAdmin | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    if (dateRange === "custom") {
      return {
        startDate: customStartDate || format(subDays(new Date(), 7), "yyyy-MM-dd"),
        endDate: customEndDate || format(new Date(), "yyyy-MM-dd"),
      };
    }
    const days = parseInt(dateRange);
    return {
      startDate: format(subDays(new Date(), days), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    };
  }, [dateRange, customStartDate, customEndDate]);

  // Queries
  const { data: entries, isLoading: entriesLoading } = useAdminTimeEntries(
    startDate,
    endDate,
    selectedPersonnelId === "all" ? undefined : selectedPersonnelId
  );
  const { data: personnelList } = usePersonnelList();
  const updateClockIn = useUpdateClockIn();

  const handleEditClick = (entry: TimeEntryForAdmin) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleSave = async (entryId: string, newClockInAt: string) => {
    if (!editingEntry) return;

    try {
      await updateClockIn.mutateAsync({
        entryId,
        newClockInAt,
        originalEntry: editingEntry,
      });

      toast({
        title: "Clock-in time updated",
        description: "The time entry has been updated and logged in the audit trail.",
      });

      setDialogOpen(false);
      setEditingEntry(null);
    } catch (error: any) {
      toast({
        title: "Error updating clock-in time",
        description: error.message || "Failed to update. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Clock Administration
          </CardTitle>
          <CardDescription>
            View and edit clock-in times for personnel. All changes are logged in the audit trail.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className={cn(
            "flex gap-4",
            isMobile ? "flex-col" : "flex-row items-end"
          )}>
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className={cn(isMobile ? "w-full" : "w-[180px]")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dateRange === "custom" && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className={cn(isMobile ? "w-full" : "w-[160px]")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className={cn(isMobile ? "w-full" : "w-[160px]")}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Personnel</Label>
              <Select value={selectedPersonnelId} onValueChange={setSelectedPersonnelId}>
                <SelectTrigger className={cn(isMobile ? "w-full" : "w-[200px]")}>
                  <SelectValue placeholder="All Personnel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Personnel</SelectItem>
                  {personnelList?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results */}
          {entriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !entries?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No time entries found for the selected filters.
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {entries.map((entry) => (
                <TimeEntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => handleEditClick(entry)}
                />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Personnel</th>
                      <th className="text-left p-3 text-sm font-medium">Project</th>
                      <th className="text-left p-3 text-sm font-medium">Date</th>
                      <th className="text-left p-3 text-sm font-medium">Clock In</th>
                      <th className="text-left p-3 text-sm font-medium">Clock Out</th>
                      <th className="text-left p-3 text-sm font-medium">Hours</th>
                      <th className="text-left p-3 text-sm font-medium">Source</th>
                      <th className="text-right p-3 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/30">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">
                              {entry.personnel?.first_name} {entry.personnel?.last_name}
                            </p>
                            {entry.personnel?.personnel_number && (
                              <p className="text-xs text-muted-foreground">
                                {entry.personnel.personnel_number}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="text-sm">{entry.project?.name || "—"}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-sm">
                            {format(parseISO(entry.entry_date), "MMM d, yyyy")}
                          </p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {entry.clock_in_at
                                ? format(parseISO(entry.clock_in_at), "h:mm a")
                                : "—"}
                            </span>
                            {(entry.clock_in_lat || entry.clock_in_lng) && (
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {entry.clock_out_at ? (
                            <span className="text-sm">
                              {format(parseISO(entry.clock_out_at), "h:mm a")}
                            </span>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Active</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="text-sm">
                            {entry.hours?.toFixed(2) || "—"}
                          </span>
                        </td>
                        <td className="p-3">
                          {entry.entry_source === "admin_edit" ? (
                            <Badge variant="outline" className="text-xs">Edited</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {entry.entry_source || "clock"}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(entry)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit clock-in</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EditClockInTimeDialog
        entry={editingEntry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        isSaving={updateClockIn.isPending}
      />
    </>
  );
}

// Mobile card component
function TimeEntryCard({
  entry,
  onEdit,
}: {
  entry: TimeEntryForAdmin;
  onEdit: () => void;
}) {
  const personnelName = entry.personnel
    ? `${entry.personnel.first_name} ${entry.personnel.last_name}`
    : "Unknown";

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{personnelName}</p>
          <p className="text-sm text-muted-foreground">{entry.project?.name}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 w-8 p-0"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {format(parseISO(entry.entry_date), "MMM d")}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {entry.clock_in_at
            ? format(parseISO(entry.clock_in_at), "h:mm a")
            : "—"}
          {" → "}
          {entry.clock_out_at
            ? format(parseISO(entry.clock_out_at), "h:mm a")
            : "Active"}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="secondary">{entry.hours?.toFixed(2) || "0.00"}h</Badge>
        {entry.entry_source === "admin_edit" && (
          <Badge variant="outline" className="text-xs">Edited</Badge>
        )}
        {(entry.clock_in_lat || entry.clock_in_lng) && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            GPS
          </span>
        )}
      </div>
    </div>
  );
}
